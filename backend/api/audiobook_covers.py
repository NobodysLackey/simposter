import re
import time
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote_plus

import requests
from fastapi import APIRouter, Query

from ..config import logger, plex_headers, plex_session, settings

router = APIRouter()

_CACHE_TTL_SECONDS = 60 * 60
_CACHE: Dict[str, Tuple[float, List[Dict[str, Any]]]] = {}
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


def _extract_asin(rating_key: str) -> str:
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
        return ""

    candidates: List[str] = []
    for element in root.iter():
        for key in ("guid", "id", "key", "tag"):
            value = element.get(key)
            if value:
                candidates.append(value)

    for candidate in candidates:
        lowered = candidate.lower()
        if "audible" not in lowered and "audnexus" not in lowered and "asin" not in lowered:
            continue
        match = _ASIN_PATTERN.search(candidate.upper())
        if match:
            return match.group(1).upper()
    return ""


def _google_books(title: str, author: str) -> List[Dict[str, Any]]:
    terms = [f'intitle:"{title}"']
    if author:
        terms.append(f'inauthor:"{author}"')
    response = requests.get(
        "https://www.googleapis.com/books/v1/volumes",
        params={"q": " ".join(terms), "printType": "books", "maxResults": 12, "projection": "lite"},
        timeout=15,
    )
    response.raise_for_status()

    covers: List[Dict[str, Any]] = []
    for item in response.json().get("items", []):
        info = item.get("volumeInfo") or {}
        links = info.get("imageLinks") or {}
        url = links.get("extraLarge") or links.get("large") or links.get("medium") or links.get("small") or links.get("thumbnail")
        thumb = links.get("thumbnail") or links.get("smallThumbnail") or url
        cover = _cover(
            source="google",
            url=url,
            thumb=thumb,
            title=str(info.get("title") or ""),
            author=", ".join(info.get("authors") or []),
            identifier=str(item.get("id") or ""),
        )
        if cover:
            covers.append(cover)
    return covers


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
        cover = _cover(
            source="openlibrary",
            url=f"https://covers.openlibrary.org/b/id/{cover_id}-L.jpg?default=false",
            thumb=f"https://covers.openlibrary.org/b/id/{cover_id}-M.jpg?default=false",
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
        normalized = re.sub(r"[?&](?:zoom|edge|source|printsec)=[^&]+", "", cover["url"]).lower()
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
        return {"covers": cached[1], "asin": _extract_asin(rating_key), "cached": True}

    asin = _extract_asin(rating_key) if audnexus else ""
    covers: List[Dict[str, Any]] = []
    errors: Dict[str, str] = {}

    providers = []
    if google:
        providers.append(("google", lambda: _google_books(title, author)))
    if openlibrary:
        providers.append(("openlibrary", lambda: _open_library(title, author)))
    if audnexus and asin:
        providers.append(("audnexus", lambda: _audnexus(asin)))

    for name, provider in providers:
        try:
            covers.extend(provider())
        except Exception as exc:
            logger.warning("[AUDIOBOOK_COVERS] %s search failed: %s", name, exc)
            errors[name] = str(exc)

    source_order = {"audnexus": 0, "google": 1, "openlibrary": 2}
    covers = _dedupe(covers)
    covers.sort(key=lambda item: source_order.get(item.get("source", ""), 99))
    _CACHE[provider_key] = (time.time(), covers)
    return {"covers": covers, "asin": asin or None, "errors": errors, "cached": False}
