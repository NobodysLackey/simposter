from __future__ import annotations

import hashlib
import json
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import requests

from .config import logger, settings

GOOGLE_BOOKS_HARD_DAILY_CAP = 50
GOOGLE_BOOKS_DEFAULT_DAILY_LIMIT = 25
GOOGLE_BOOKS_MIN_INTERVAL_SECONDS = 5
GOOGLE_BOOKS_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60
GOOGLE_BOOKS_CACHE_VERSION = "full-images-v2"

_USAGE_PATH = Path(settings.SETTINGS_DIR) / "google_books_usage.json"
_CACHE_PATH = Path(settings.SETTINGS_DIR) / "google_books_cache.json"
_LOCK = threading.Lock()


class GoogleBooksRequestBlocked(RuntimeError):
    """Raised when a local safety guard intentionally blocks a Google Books request."""


class GoogleBooksProviderError(RuntimeError):
    """Raised when Google Books rejects or cannot complete a request."""


def _read_json(path: Path, fallback: Dict[str, Any]) -> Dict[str, Any]:
    try:
        if path.exists():
            raw = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                return raw
    except Exception as exc:
        logger.warning("[GOOGLE_BOOKS] Could not read %s: %s", path, exc)
    return dict(fallback)


def _write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(path.suffix + ".tmp")
    temp_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    temp_path.replace(path)


def _utc_day() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _effective_limit(configured_limit: int) -> int:
    try:
        value = int(configured_limit)
    except (TypeError, ValueError):
        value = GOOGLE_BOOKS_DEFAULT_DAILY_LIMIT
    return max(1, min(value, GOOGLE_BOOKS_HARD_DAILY_CAP))


def _usage_state() -> Dict[str, Any]:
    state = _read_json(
        _USAGE_PATH,
        {"date": _utc_day(), "count": 0, "last_request_epoch": 0.0},
    )
    if state.get("date") != _utc_day():
        state = {"date": _utc_day(), "count": 0, "last_request_epoch": 0.0}
    state["count"] = max(0, int(state.get("count") or 0))
    state["last_request_epoch"] = float(state.get("last_request_epoch") or 0.0)
    return state


def get_google_books_usage_status(configured_limit: int) -> Dict[str, Any]:
    limit = _effective_limit(configured_limit)
    with _LOCK:
        state = _usage_state()
    count = int(state["count"])
    return {
        "date": state["date"],
        "used": count,
        "limit": limit,
        "remaining": max(0, limit - count),
        "hard_cap": GOOGLE_BOOKS_HARD_DAILY_CAP,
        "minimum_interval_seconds": GOOGLE_BOOKS_MIN_INTERVAL_SECONDS,
        "cache_days": GOOGLE_BOOKS_CACHE_TTL_SECONDS // (24 * 60 * 60),
    }


def _reserve_request(configured_limit: int) -> Dict[str, Any]:
    limit = _effective_limit(configured_limit)
    now = time.time()
    with _LOCK:
        state = _usage_state()
        count = int(state["count"])
        if count >= limit:
            raise GoogleBooksRequestBlocked(
                f"Google Books daily safety limit reached ({count}/{limit}). "
                "The limit resets at 00:00 UTC."
            )

        elapsed = now - float(state["last_request_epoch"])
        if state["last_request_epoch"] and elapsed < GOOGLE_BOOKS_MIN_INTERVAL_SECONDS:
            wait_seconds = max(1, int(GOOGLE_BOOKS_MIN_INTERVAL_SECONDS - elapsed + 0.999))
            raise GoogleBooksRequestBlocked(
                f"Google Books safety cooldown is active. Try again in {wait_seconds} seconds."
            )

        # Count the request before sending it because rejected/failed HTTP calls still consume quota.
        state["count"] = count + 1
        state["last_request_epoch"] = now
        _write_json(_USAGE_PATH, state)
        return {
            "date": state["date"],
            "used": state["count"],
            "limit": limit,
            "remaining": max(0, limit - int(state["count"])),
        }


def _cache_key(title: str, author: str, max_results: int) -> str:
    normalized = "|".join(
        [
            GOOGLE_BOOKS_CACHE_VERSION,
            title.strip().casefold(),
            author.strip().casefold(),
            str(int(max_results)),
        ]
    )
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _get_cached_response(cache_key: str) -> Optional[Dict[str, Any]]:
    with _LOCK:
        cache = _read_json(_CACHE_PATH, {})
        entry = cache.get(cache_key)
        if not isinstance(entry, dict):
            return None
        created = float(entry.get("created_epoch") or 0.0)
        if time.time() - created > GOOGLE_BOOKS_CACHE_TTL_SECONDS:
            cache.pop(cache_key, None)
            _write_json(_CACHE_PATH, cache)
            return None
        payload = entry.get("payload")
        return payload if isinstance(payload, dict) else None


def _store_cached_response(cache_key: str, payload: Dict[str, Any]) -> None:
    with _LOCK:
        cache = _read_json(_CACHE_PATH, {})
        cache[cache_key] = {
            "created_epoch": time.time(),
            "payload": payload,
        }
        # Bound the local cache so it cannot grow indefinitely.
        if len(cache) > 500:
            ordered = sorted(
                cache.items(),
                key=lambda item: float((item[1] or {}).get("created_epoch") or 0.0),
                reverse=True,
            )
            cache = dict(ordered[:500])
        _write_json(_CACHE_PATH, cache)


def request_google_books(
    *,
    api_key: str,
    title: str,
    author: str = "",
    configured_daily_limit: int = GOOGLE_BOOKS_DEFAULT_DAILY_LIMIT,
    max_results: int = 8,
    force_refresh: bool = False,
    use_cache: bool = True,
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    key = str(api_key or "").strip()
    if not key:
        raise GoogleBooksRequestBlocked(
            "Google Books API key is not configured. Add and test it in Audiobook Settings."
        )

    clean_title = str(title or "").strip()
    clean_author = str(author or "").strip()
    if not clean_title:
        raise GoogleBooksRequestBlocked("A title is required for Google Books search.")

    capped_results = max(1, min(int(max_results), 12))
    cache_key = _cache_key(clean_title, clean_author, capped_results)
    if use_cache and not force_refresh:
        cached = _get_cached_response(cache_key)
        if cached is not None:
            return cached, {
                **get_google_books_usage_status(configured_daily_limit),
                "cached": True,
            }

    usage = _reserve_request(configured_daily_limit)
    terms = [f'intitle:"{clean_title}"']
    if clean_author:
        terms.append(f'inauthor:"{clean_author}"')

    try:
        response = requests.get(
            "https://www.googleapis.com/books/v1/volumes",
            params={
                "q": " ".join(terms),
                "printType": "books",
                "maxResults": capped_results,
                "key": key,
            },
            timeout=15,
        )
    except requests.RequestException as exc:
        raise GoogleBooksProviderError("Google Books could not be reached.") from exc

    if response.status_code == 429:
        raise GoogleBooksProviderError(
            "Google Books temporarily rate-limited this project. Cached and Open Library results remain available."
        )
    if response.status_code in {400, 401, 403}:
        try:
            message = (
                response.json().get("error", {}).get("message")
                or "The API key was rejected or the Books API is not enabled."
            )
        except Exception:
            message = "The API key was rejected or the Books API is not enabled."
        raise GoogleBooksProviderError(str(message))
    if not response.ok:
        raise GoogleBooksProviderError(
            f"Google Books returned HTTP {response.status_code}."
        )

    payload = response.json()
    if not isinstance(payload, dict):
        payload = {}
    if use_cache:
        _store_cached_response(cache_key, payload)
    return payload, {**usage, "cached": False}


def test_google_books_api_key(
    api_key: str,
    configured_daily_limit: int = GOOGLE_BOOKS_DEFAULT_DAILY_LIMIT,
) -> Dict[str, Any]:
    payload, usage = request_google_books(
        api_key=api_key,
        title="The Hobbit",
        author="J. R. R. Tolkien",
        configured_daily_limit=configured_daily_limit,
        max_results=1,
        force_refresh=True,
        use_cache=False,
    )
    items = payload.get("items") or []
    example = "Google Books public-volume lookup succeeded"
    if items:
        info = (items[0] or {}).get("volumeInfo") or {}
        example = str(info.get("title") or example)
    return {"status": "ok", "example": example, "usage": usage}
