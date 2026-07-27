import re
import time
import xml.etree.ElementTree as ET
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote_plus

import requests
from fastapi import APIRouter, Query

from ..config import logger, plex_headers, plex_session, settings
from ..google_books_guard import (
    GoogleBooksProviderError,
    GoogleBooksRequestBlocked,
    get_google_books_usage_status,
    request_google_books,
)
from .audiobook_settings import load_audiobook_settings

router = APIRouter()

# Combined provider results are cached in memory for a full day. Google Books
# also has its own persistent seven-day cache in google_books_guard.py.
_CACHE_TTL_SECONDS = 24 * 60 * 60
_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}
_ASIN_CACHE_TTL_SECONDS = 24 * 60 * 60
_ASIN_CACHE: Dict[str, Tuple[float, str]] = {}
_ASIN_PATTERN = re.compile(r"(?<![A-Z0-9])([A-Z0-9]{10})(?![A-Z0-9])", re.IGNORECASE)
_AUDIBLE_DOMAINS = {
    "au": "api.audible.com.au",
    "ca": "api.audible.ca",
    "de": "api.audible.de",
    "es": "api.audible.es",
    "fr": "api.audible.fr",
    "in": "api.audible.in",
    "it": "api.audible.it",
    "jp": "api.audible.co.jp",
    "us": "api.audible.com",
    "uk": "api.audible.co.uk",
}


def _https(url: Optional[str]) -> str:
    value = str(url or "").strip()
    if value.startswith("http://"):
        return "https://" + value[7:]
    return value


def _clean_asin(value: Optional[str]) -> str:
    candidate = str(value or "").strip().upper()
    return candidate if re.fullmatch(r"[A-Z0-9]{10}", candidate) else ""


def _normalize_region(value: Optional[str]) -> str:
    candidate = str(value or "").strip().lower()
    return candidate if candidate in _AUDIBLE_DOMAINS else "us"


def _normalize_match_text(value: Optional[str]) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def _contributor_names(entries: Any) -> List[str]:
    if not isinstance(entries, list):
        return []
    names: List[str] = []
    for entry in entries:
        if isinstance(entry, dict):
            name = str(entry.get("name") or "").strip()
        else:
            name = str(entry or "").strip()
        if name:
            names.append(name)
    return names


def _largest_product_image(product_images: Any) -> str:
    if isinstance(product_images, str):
        return _https(product_images)
    if not isinstance(product_images, dict):
        return ""

    ranked: List[Tuple[int, str]] = []
    for key, value in product_images.items():
        url = _https(value)
        if not url:
            continue
        try:
            size = int(str(key))
        except ValueError:
            size = 0
        ranked.append((size, url))

    if not ranked:
        return ""
    ranked.sort(key=lambda item: item[0], reverse=True)
    return ranked[0][1]


def _cover(
    *,
    source: str,
    url: str,
    thumb: Optional[str] = None,
    title: str = "",
    author: str = "",
    identifier: str = "",
    asin: str = "",
    narrator: str = "",
    year: Optional[int] = None,
    group: str = "book",
    region: str = "",
    score: float = 0.0,
) -> Optional[Dict[str, Any]]:
    full_url = _https(url)
    if not full_url:
        return None
    return {
        "source": source,
        "url": full_url,
        "thumb": _https(thumb) or full_url,
        "title": title,
        "author": author,
        "id": identifier,
        "provider_id": identifier,
        "asin": asin,
        "narrator": narrator,
        "year": year,
        "group": group,
        "region": region,
        "match_score": score,
    }


def _extract_asin(rating_key: str, force_refresh: bool = False) -> str:
    cached = _ASIN_CACHE.get(rating_key)
    if cached and not force_refresh and time.time() - cached[0] < _ASIN_CACHE_TTL_SECONDS:
        return cached[1]

    try:
        response = plex_session.get(
            f"{settings.PLEX_URL}/library/metadata/{rating_key}",
            headers=plex_headers(),
            timeout=12,
        )
        response.raise_for_status()
        root = ET.fromstring(response.text)
    except Exception as exc:
        logger.debug("[AUDIOBOOK_COVERS] Could not inspect Plex metadata for ASIN: %s", exc)
        _ASIN_CACHE[rating_key] = (time.time(), "")
        return ""

    candidates: List[str] = []
    for element in root.iter():
        for key in ("guid", "id", "key", "tag", "title", "summary"):
            value = element.get(key)
            if value:
                candidates.append(value)
        if element.text and element.text.strip():
            candidates.append(element.text.strip())

    asin = ""
    for candidate in candidates:
        lowered = candidate.lower()
        if "audible" not in lowered and "audnexus" not in lowered and "asin" not in lowered:
            continue
        match = _ASIN_PATTERN.search(candidate.upper())
        if match:
            asin = match.group(1).upper()
            break

    _ASIN_CACHE[rating_key] = (time.time(), asin)
    return asin


def _google_books(title: str, author: str, force_refresh: bool) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    audiobook_settings = load_audiobook_settings()
    payload, usage = request_google_books(
        api_key=audiobook_settings.google_books_api_key,
        title=title,
        author=author,
        configured_daily_limit=audiobook_settings.google_books_daily_limit,
        max_results=8,
        force_refresh=force_refresh,
        use_cache=True,
    )

    covers: List[Dict[str, Any]] = []
    for item in payload.get("items", []):
        info = item.get("volumeInfo") or {}
        links = info.get("imageLinks") or {}
        url = (
            links.get("extraLarge")
            or links.get("large")
            or links.get("medium")
            or links.get("small")
            or links.get("thumbnail")
            or links.get("smallThumbnail")
        )
        published = str(info.get("publishedDate") or "")
        year = int(published[:4]) if published[:4].isdigit() else None
        cover = _cover(
            source="google",
            url=url,
            thumb=url,
            title=str(info.get("title") or ""),
            author=", ".join(info.get("authors") or []),
            identifier=str(item.get("id") or ""),
            year=year,
            group="book",
        )
        if cover:
            covers.append(cover)
    return covers, usage


def _open_library(title: str, author: str) -> List[Dict[str, Any]]:
    params: Dict[str, Any] = {
        "title": title,
        "limit": 12,
        "fields": "key,title,author_name,cover_i,edition_key,isbn,first_publish_year",
    }
    if author:
        params["author"] = author

    response = requests.get(
        "https://openlibrary.org/search.json",
        params=params,
        headers={"User-Agent": "SimPoster audiobook cover search"},
        timeout=15,
    )
    response.raise_for_status()

    covers: List[Dict[str, Any]] = []
    for item in response.json().get("docs", []):
        cover_id = item.get("cover_i")
        if not cover_id:
            continue
        large_url = f"https://covers.openlibrary.org/b/id/{cover_id}-L.jpg?default=false"
        year_value = item.get("first_publish_year")
        year = int(year_value) if isinstance(year_value, int) else None
        cover = _cover(
            source="openlibrary",
            url=large_url,
            thumb=large_url,
            title=str(item.get("title") or ""),
            author=", ".join(item.get("author_name") or []),
            identifier=str(item.get("key") or cover_id),
            year=year,
            group="book",
        )
        if cover:
            covers.append(cover)
    return covers


def _audnexus(asin: str, region: str) -> List[Dict[str, Any]]:
    clean_asin = _clean_asin(asin)
    if not clean_asin:
        return []

    response = requests.get(
        f"https://api.audnex.us/books/{quote_plus(clean_asin)}",
        params={"region": region},
        headers={"User-Agent": "SimPoster audiobook cover search"},
        timeout=18,
    )
    if response.status_code == 404:
        return []
    response.raise_for_status()
    item = response.json() or {}
    author_names = _contributor_names(item.get("authors"))
    narrator_names = _contributor_names(item.get("narrators"))
    release_date = str(item.get("releaseDate") or "")
    year = int(release_date[:4]) if release_date[:4].isdigit() else None
    cover = _cover(
        source="audnexus",
        url=item.get("image"),
        thumb=item.get("image"),
        title=str(item.get("title") or ""),
        author=", ".join(author_names),
        narrator=", ".join(narrator_names),
        identifier=str(item.get("asin") or clean_asin),
        asin=clean_asin,
        year=year,
        group="audiobook",
        region=region,
        score=1000.0,
    )
    return [cover] if cover else []


def _audible_product(asin: str, region: str) -> List[Dict[str, Any]]:
    clean_asin = _clean_asin(asin)
    if not clean_asin:
        return []

    domain = _AUDIBLE_DOMAINS[region]
    response = requests.get(
        f"https://{domain}/1.0/catalog/products/{quote_plus(clean_asin)}",
        params={
            "response_groups": "contributors,media,product_desc,product_attrs",
            "image_sizes": "2400,1215,900,500",
        },
        headers={
            "Accept": "application/json",
            "User-Agent": "SimPoster audiobook cover search",
        },
        timeout=18,
    )
    if response.status_code == 404:
        return []
    if response.status_code == 429:
        raise RuntimeError("Audible temporarily rate-limited exact ASIN lookup.")
    response.raise_for_status()

    payload = response.json() or {}
    item = payload.get("product") if isinstance(payload.get("product"), dict) else payload
    if not isinstance(item, dict):
        return []

    image = _largest_product_image(item.get("product_images"))
    if not image:
        return []
    authors = _contributor_names(item.get("authors"))
    narrators = _contributor_names(item.get("narrators"))
    release_date = str(item.get("release_date") or "")
    year = int(release_date[:4]) if release_date[:4].isdigit() else None
    cover = _cover(
        source="audible",
        url=image,
        thumb=image,
        title=str(item.get("title") or ""),
        author=", ".join(authors),
        narrator=", ".join(narrators),
        identifier=clean_asin,
        asin=clean_asin,
        year=year,
        group="audiobook",
        region=region,
        score=1200.0,
    )
    return [cover] if cover else []


def _audible_match_score(
    item: Dict[str, Any],
    requested_title: str,
    requested_author: str,
    requested_narrator: str,
) -> float:
    item_title = _normalize_match_text(item.get("title"))
    title = _normalize_match_text(requested_title)
    authors = _normalize_match_text(" ".join(_contributor_names(item.get("authors"))))
    author = _normalize_match_text(requested_author)
    narrators = _normalize_match_text(" ".join(_contributor_names(item.get("narrators"))))
    narrator = _normalize_match_text(requested_narrator)

    score = SequenceMatcher(None, item_title, title).ratio() * 100 if title else 0
    if title and item_title == title:
        score += 80
    elif title and (title in item_title or item_title in title):
        score += 35

    if author:
        score += SequenceMatcher(None, authors, author).ratio() * 35
        if author == authors:
            score += 35
        elif author in authors or authors in author:
            score += 18

    if narrator:
        score += SequenceMatcher(None, narrators, narrator).ratio() * 20
        if narrator == narrators:
            score += 20
        elif narrator in narrators or narrators in narrator:
            score += 10

    return score


def _audible_search(
    title: str,
    author: str,
    narrator: str,
    region: str,
) -> List[Dict[str, Any]]:
    if not title.strip():
        return []

    params: Dict[str, Any] = {
        "title": title.strip(),
        "num_results": 8,
        "products_sort_by": "Relevance",
        "response_groups": "contributors,media,product_desc,product_attrs",
        "image_sizes": "2400,1215,900,500",
    }
    if author.strip():
        params["author"] = author.strip()
    if narrator.strip():
        params["narrator"] = narrator.strip()

    domain = _AUDIBLE_DOMAINS[region]
    response = requests.get(
        f"https://{domain}/1.0/catalog/products",
        params=params,
        headers={
            "Accept": "application/json",
            "User-Agent": "SimPoster audiobook cover search",
        },
        timeout=18,
    )
    if response.status_code == 429:
        raise RuntimeError("Audible temporarily rate-limited cover discovery.")
    response.raise_for_status()

    payload = response.json() or {}
    covers: List[Dict[str, Any]] = []
    for item in payload.get("products", []):
        if not isinstance(item, dict):
            continue
        asin = _clean_asin(item.get("asin"))
        image = _largest_product_image(item.get("product_images"))
        if not asin or not image:
            continue

        authors = _contributor_names(item.get("authors"))
        narrators = _contributor_names(item.get("narrators"))
        release_date = str(item.get("release_date") or "")
        year = int(release_date[:4]) if release_date[:4].isdigit() else None
        score = _audible_match_score(item, title, author, narrator)
        cover = _cover(
            source="audible",
            url=image,
            thumb=image,
            title=str(item.get("title") or ""),
            author=", ".join(authors),
            narrator=", ".join(narrators),
            identifier=asin,
            asin=asin,
            year=year,
            group="audiobook",
            region=region,
            score=score,
        )
        if cover:
            covers.append(cover)

    covers.sort(key=lambda item: float(item.get("match_score") or 0), reverse=True)
    return covers[:8]


def _dedupe(covers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    result: List[Dict[str, Any]] = []
    seen = set()
    for cover in covers:
        asin = _clean_asin(cover.get("asin"))
        if asin:
            identity = f"asin:{asin}"
        else:
            identity = re.sub(
                r"[?&](?:zoom|edge|source|printsec|w)=[^&]+",
                "",
                cover["url"],
            ).lower()
        if identity in seen:
            continue
        seen.add(identity)
        result.append(cover)
    return result


@router.get("/audiobook/{rating_key}/cover-options")
def api_audiobook_cover_options(
    rating_key: str,
    title: str = Query(..., min_length=1),
    author: str = Query(""),
    narrator: str = Query(""),
    google: bool = Query(True),
    openlibrary: bool = Query(True),
    audnexus: bool = Query(True),
    audible_search: bool = Query(True),
    asin_override: str = Query(""),
    region: str = Query(""),
    force_refresh: bool = Query(False),
):
    audiobook_settings = load_audiobook_settings()
    selected_region = _normalize_region(region or audiobook_settings.audible_region)
    manual_asin = _clean_asin(asin_override)
    plex_asin = _extract_asin(rating_key, force_refresh=force_refresh) if audnexus else ""
    exact_asin = manual_asin or plex_asin

    provider_key = "|".join(
        [
            rating_key,
            title,
            author,
            narrator,
            str(google),
            str(openlibrary),
            str(audnexus),
            str(audible_search),
            exact_asin,
            selected_region,
        ]
    )
    cached = _CACHE.get(provider_key)
    if cached and not force_refresh and time.time() - cached[0] < _CACHE_TTL_SECONDS:
        response = dict(cached[1])
        response["cached"] = True
        return response

    covers: List[Dict[str, Any]] = []
    errors: Dict[str, str] = {}
    google_usage = get_google_books_usage_status(audiobook_settings.google_books_daily_limit)

    if audnexus and exact_asin:
        exact_results: List[Dict[str, Any]] = []
        exact_errors: List[str] = []
        try:
            exact_results.extend(_audible_product(exact_asin, selected_region))
        except Exception as exc:
            logger.warning("[AUDIOBOOK_COVERS] Audible exact lookup failed: %s", exc)
            exact_errors.append("Audible")
        try:
            exact_results.extend(_audnexus(exact_asin, selected_region))
        except Exception as exc:
            logger.warning("[AUDIOBOOK_COVERS] Audnexus exact lookup failed: %s", exc)
            exact_errors.append("Audnexus")
        covers.extend(exact_results)
        if not exact_results and exact_errors:
            errors["audible_exact"] = "Exact Audible ASIN lookup failed."

    if audnexus and audible_search:
        try:
            covers.extend(_audible_search(title, author, narrator, selected_region))
        except Exception as exc:
            logger.warning("[AUDIOBOOK_COVERS] Audible catalog search failed: %s", exc)
            errors["audible"] = str(exc) if "rate-limited" in str(exc) else "Audible audiobook search failed."

    if google:
        try:
            google_covers, google_usage = _google_books(title, author, force_refresh)
            covers.extend(google_covers)
        except (GoogleBooksRequestBlocked, GoogleBooksProviderError) as exc:
            logger.info("[AUDIOBOOK_COVERS] Google Books skipped: %s", exc)
            errors["google"] = str(exc)
        except Exception as exc:
            logger.warning("[AUDIOBOOK_COVERS] Google Books search failed: %s", exc)
            errors["google"] = "Google Books search failed."

    if openlibrary:
        try:
            covers.extend(_open_library(title, author))
        except Exception as exc:
            logger.warning("[AUDIOBOOK_COVERS] Open Library search failed: %s", exc)
            errors["openlibrary"] = "Open Library search failed."

    source_order = {"audible": 0, "audnexus": 1, "google": 2, "openlibrary": 3}
    covers = _dedupe(covers)
    covers.sort(
        key=lambda item: (
            source_order.get(item.get("source", ""), 99),
            -float(item.get("match_score") or 0),
        )
    )

    audiobook_covers = [item for item in covers if item.get("group") == "audiobook"]
    book_covers = [item for item in covers if item.get("group") != "audiobook"]
    resolved_asin = exact_asin or next(
        (_clean_asin(item.get("asin")) for item in audiobook_covers if _clean_asin(item.get("asin"))),
        "",
    )
    asin_source = "manual" if manual_asin else "plex" if plex_asin else "search" if resolved_asin else None

    response = {
        "covers": covers,
        "groups": {
            "audiobook": audiobook_covers,
            "book": book_covers,
        },
        "asin": resolved_asin or None,
        "detected_asin": plex_asin or None,
        "asin_source": asin_source,
        "region": selected_region,
        "errors": errors,
        "cached": False,
        "google_usage": google_usage,
    }
    _CACHE[provider_key] = (time.time(), response)
    return response
