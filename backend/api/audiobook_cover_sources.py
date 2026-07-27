from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse, urlunparse

import requests
from fastapi import APIRouter, Query

from ..config import logger

router = APIRouter()
_TIMEOUT = 12
_USER_AGENT = "SimPoster/1.0 (audiobook cover search)"
_ASIN_RE = re.compile(r"^[A-Z0-9]{10}$", re.IGNORECASE)

def _https_url(value: Any) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    url = value.strip().replace("http://", "https://", 1)
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return urlunparse(parsed._replace(scheme="https"))

def _dedupe(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    output: list[dict[str, Any]] = []
    for item in results:
        url = item.get("url")
        if not isinstance(url, str) or url in seen:
            continue
        seen.add(url)
        output.append(item)
    return output

def _google_books(title: str, author: str, limit: int) -> list[dict[str, Any]]:
    query = f'intitle:"{title}"'
    if author.strip():
        query += f'+inauthor:"{author}"'
    response = requests.get(
        "https://www.googleapis.com/books/v1/volumes",
        params={"q": query, "maxResults": min(max(limit, 1), 20), "printType": "books", "orderBy": "relevance"},
        headers={"User-Agent": _USER_AGENT},
        timeout=_TIMEOUT,
    )
    response.raise_for_status()
    output: list[dict[str, Any]] = []
    for item in response.json().get("items", []):
        info = item.get("volumeInfo") or {}
        links = info.get("imageLinks") or {}
        image = next((_https_url(links.get(key)) for key in ("extraLarge","large","medium","small","thumbnail","smallThumbnail") if links.get(key)), None)
        if not image:
            continue
        output.append({
            "url": image,
            "thumb": _https_url(links.get("thumbnail")) or image,
            "source": "google",
            "title": info.get("title") or title,
            "author": ", ".join(info.get("authors") or []) or author,
            "year": str(info.get("publishedDate") or "")[:4] or None,
            "provider_id": item.get("id"),
        })
    return output

def _open_library(title: str, author: str, limit: int) -> list[dict[str, Any]]:
    params: dict[str, Any] = {
        "title": title,
        "limit": min(max(limit, 1), 20),
        "fields": "key,title,author_name,first_publish_year,cover_i,isbn",
    }
    if author.strip():
        params["author"] = author
    response = requests.get(
        "https://openlibrary.org/search.json",
        params=params,
        headers={"User-Agent": _USER_AGENT},
        timeout=_TIMEOUT,
    )
    response.raise_for_status()
    output: list[dict[str, Any]] = []
    for item in response.json().get("docs", []):
        cover_id = item.get("cover_i")
        if not cover_id:
            continue
        output.append({
            "url": f"https://covers.openlibrary.org/b/id/{cover_id}-L.jpg",
            "thumb": f"https://covers.openlibrary.org/b/id/{cover_id}-M.jpg",
            "source": "openlibrary",
            "title": item.get("title") or title,
            "author": ", ".join(item.get("author_name") or []) or author,
            "year": item.get("first_publish_year"),
            "provider_id": item.get("key"),
            "isbn": (item.get("isbn") or [None])[0],
        })
    return output

def _audnexus(asin: str) -> list[dict[str, Any]]:
    normalized = asin.strip().upper()
    if not _ASIN_RE.fullmatch(normalized):
        return []
    response = requests.get(
        f"https://api.audnex.us/books/{normalized}",
        params={"region": "us"},
        headers={"User-Agent": _USER_AGENT},
        timeout=_TIMEOUT,
    )
    if response.status_code == 404:
        return []
    response.raise_for_status()
    item = response.json()
    image = _https_url(item.get("image"))
    if not image:
        return []
    return [{
        "url": image,
        "thumb": image,
        "source": "audnexus",
        "title": item.get("title"),
        "author": ", ".join(a.get("name","") for a in item.get("authors",[]) if isinstance(a,dict) and a.get("name")),
        "year": str(item.get("releaseDate") or "")[:4] or item.get("copyright"),
        "provider_id": item.get("asin") or normalized,
        "asin": item.get("asin") or normalized,
        "narrator": ", ".join(n.get("name","") for n in item.get("narrators",[]) if isinstance(n,dict) and n.get("name")),
    }]

@router.get("/audiobook-cover-options")
def api_audiobook_cover_options(
    title: str = Query(..., min_length=1),
    author: str = "",
    asin: str = "",
    google: bool = True,
    open_library: bool = True,
    audnexus: bool = True,
    limit: int = Query(default=12, ge=1, le=20),
):
    results: list[dict[str, Any]] = []
    errors: dict[str, str] = {}
    if google:
        try:
            results.extend(_google_books(title, author, limit))
        except Exception as exc:
            logger.warning("[AUDIOBOOK_COVERS] Google Books search failed: %s", exc)
            errors["google"] = str(exc)
    if open_library:
        try:
            results.extend(_open_library(title, author, limit))
        except Exception as exc:
            logger.warning("[AUDIOBOOK_COVERS] Open Library search failed: %s", exc)
            errors["openlibrary"] = str(exc)
    if audnexus and asin.strip():
        try:
            results.extend(_audnexus(asin))
        except Exception as exc:
            logger.warning("[AUDIOBOOK_COVERS] Audnexus lookup failed: %s", exc)
            errors["audnexus"] = str(exc)
    return {"results": _dedupe(results), "errors": errors, "audnexus_requires_asin": True}
