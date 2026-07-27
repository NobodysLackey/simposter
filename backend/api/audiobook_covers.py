import re
import time
import xml.etree.ElementTree as ET
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


def _https(url: Optional[str]) -> str:
    value = str(url or "").strip()
    if value.startswith("http://"):
        return "https://" + value[7:]
    return value


def _cover(
    *,
    source: str,
    url: str,
    thumb: Optional[str] = None,
    title: str = "",
    author: str = "",
    identifier: str = "",
    asin: str = "",
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
        "asin": asin,
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
        for key in ("guid", "id", "key", "tag"):
            value = element.get(key)
            if value:
                candidates.append(value)

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

        # Use Google's advertised image URLs exactly as returned. Forcing unsupported
        # zoom/width parameters can make the image host return an "Image not available"
        # graphic even when the original cover URL is valid.
        url = (
            links.get("extraLarge")
            or links.get("large")
            or links.get("medium")
            or links.get("small")
            or links.get("thumbnail")
            or links.get("smallThumbnail")
        )
        cover = _cover(
            source="google",
            url=url,
            # Load the selected full rendition in the picker so the quality marker
            # measures the image SimPoster will actually render.
            thumb=url,
            title=str(info.get("title") or ""),
            author=", ".join(info.get("authors") or []),
            identifier=str(item.get("id") or ""),
        )
        if cover:
            covers.append(cover)
    return covers, usage


def _open_library(title: str, author: str) -> List[Dict[str, Any]]:
    params: Dict[str, Any] = {
        "title": title,
        "limit": 12,
        "fields": "key,title,author_name,cover_i,edition_key,isbn",
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
        cover = _cover(
            source="openlibrary",
            url=large_url,
            thumb=large_url,
            title=str(item.get("title") or ""),
            author=", ".join(item.get("author_name") or []),
            identifier=str(item.get("key") or cover_id),
        )
        if cover:
            covers.append(cover)
    return covers


def _audnexus(asin: str) -> List[Dict[str, Any]]:
    if not asin:
        return []
    response = requests.get(
        f"https://api.audnex.us/books/{quote_plus(asin)}",
        params={"region": "us"},
        timeout=18,
    )
    if response.status_code == 404:
        return []
    response.raise_for_status()
    item = response.json() or {}
    authors = item.get("authors") or []
    author_names = [entry.get("name", "") if isinstance(entry, dict) else str(entry) for entry in authors]
    cover = _cover(
        source="audnexus",
        url=item.get("image"),
        thumb=item.get("image"),
        title=str(item.get("title") or ""),
        author=", ".join(name for name in author_names if name),
        identifier=str(item.get("asin") or asin),
        asin=asin,
    )
    return [cover] if cover else []


def _dedupe(covers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    result: List[Dict[str, Any]] = []
    seen = set()
    for cover in covers:
        normalized = re.sub(r"[?&](?:zoom|edge|source|printsec|w)=[^&]+", "", cover["url"]).lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        result.append(cover)
    return result


@router.get("/audiobook/{rating_key}/cover-options")
def api_audiobook_cover_options(
    rating_key: str,
    title: str = Query(..., min_length=1),
    author: str = Query(""),
    google: bool = Query(True),
    openlibrary: bool = Query(True),
    audnexus: bool = Query(True),
    force_refresh: bool = Query(False),
):
    provider_key = f"{rating_key}|{title}|{author}|{google}|{openlibrary}|{audnexus}"
    cached = _CACHE.get(provider_key)
    if cached and not force_refresh and time.time() - cached[0] < _CACHE_TTL_SECONDS:
        response = dict(cached[1])
        response["cached"] = True
        return response

    asin = _extract_asin(rating_key, force_refresh=force_refresh) if audnexus else ""
    covers: List[Dict[str, Any]] = []
    errors: Dict[str, str] = {}
    audiobook_settings = load_audiobook_settings()
    google_usage = get_google_books_usage_status(audiobook_settings.google_books_daily_limit)

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

    if audnexus and asin:
        try:
            covers.extend(_audnexus(asin))
        except Exception as exc:
            logger.warning("[AUDIOBOOK_COVERS] Audnexus lookup failed: %s", exc)
            errors["audnexus"] = "Audnexus lookup failed."

    source_order = {"audnexus": 0, "google": 1, "openlibrary": 2}
    covers = _dedupe(covers)
    covers.sort(key=lambda item: source_order.get(item.get("source", ""), 99))
    response = {
        "covers": covers,
        "asin": asin or None,
        "errors": errors,
        "cached": False,
        "google_usage": google_usage,
    }
    _CACHE[provider_key] = (time.time(), response)
    return response
