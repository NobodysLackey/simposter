import xml.etree.ElementTree as ET
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from ..config import logger, plex_headers, plex_session, settings

router = APIRouter()


def _fetch_xml(url: str, timeout: int = 15) -> ET.Element:
    try:
        response = plex_session.get(url, headers=plex_headers(), timeout=timeout)
        response.raise_for_status()
        return ET.fromstring(response.text)
    except Exception as exc:
        logger.warning("[MUSIC] Plex request failed: %s (%s)", url, exc)
        raise HTTPException(status_code=502, detail=f"Plex request failed: {exc}") from exc


def _album_cover_url(rating_key: str) -> str:
    return f"/api/music/{rating_key}/cover"


@router.get("/music/albums")
def api_music_albums(library_id: str = Query(...)):
    root = _fetch_xml(f"{settings.PLEX_URL}/library/sections/{library_id}/all?type=9")
    albums: List[Dict[str, Any]] = []

    for directory in root.findall(".//Directory"):
        rating_key = directory.get("ratingKey")
        title = directory.get("title")
        if not rating_key or not title:
            continue

        year_value = directory.get("year")
        added_value = directory.get("addedAt")
        albums.append(
            {
                "key": rating_key,
                "title": title,
                "artist": directory.get("parentTitle") or "",
                "artist_key": directory.get("parentRatingKey"),
                "year": int(year_value) if year_value and year_value.isdigit() else None,
                "addedAt": int(added_value) if added_value and added_value.isdigit() else None,
                "poster": _album_cover_url(rating_key),
                "library_id": str(library_id),
                "guid": directory.get("guid"),
            }
        )

    albums.sort(key=lambda album: ((album.get("artist") or "").lower(), album["title"].lower()))
    return albums


@router.get("/music/{rating_key}/cover")
def api_music_cover(rating_key: str):
    try:
        response = plex_session.get(
            f"{settings.PLEX_URL}/library/metadata/{rating_key}/thumb",
            headers=plex_headers(),
            timeout=15,
        )
        response.raise_for_status()
        return Response(
            content=response.content,
            media_type=response.headers.get("content-type", "image/jpeg"),
            headers={"Cache-Control": "private, max-age=300"},
        )
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Cover not available: {exc}") from exc
