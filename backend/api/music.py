import base64
import re
import xml.etree.ElementTree as ET
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field

from ..config import logger, plex_headers, plex_session, settings
from ..rendering import render_poster_image

router = APIRouter()


class MusicRenderRequest(BaseModel):
    rating_key: str
    library_id: Optional[str] = None
    title: str
    artist: str = ""
    year: Optional[int] = None
    background_url: str
    options: Dict[str, Any] = Field(default_factory=dict)
    save_to_disk: bool = False
    send_to_plex: bool = False
    save_beside_media: bool = True
    output_directory: str = "/config/output/Music/{artist}/{title}"
    filename: str = "cover.jpg"


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


def _safe_component(value: str, fallback: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9 _().'-]", "", value or fallback).strip()
    return cleaned or fallback


def _substitute_metadata(text: str, req: MusicRenderRequest) -> str:
    values = {
        "title": req.title,
        "artist": req.artist,
        "year": str(req.year or ""),
    }
    result = text
    for key, value in values.items():
        result = result.replace(f"{{{key}}}", value or "")
    return result


def _render_options(req: MusicRenderRequest) -> Dict[str, Any]:
    options = dict(req.options or {})
    options["movie_title"] = req.title
    options["movie_year"] = str(req.year or "")
    options["media_type"] = "music"

    custom_text = options.get("custom_text")
    if isinstance(custom_text, str):
        options["custom_text"] = _substitute_metadata(custom_text, req)

    metadata = dict(options.get("metadata") or {})
    metadata.update(
        {
            "title": req.title,
            "artist": req.artist,
            "year": req.year,
            "media_type": "music",
        }
    )
    options["metadata"] = metadata
    return options


def _image_settings() -> tuple[str, int, str]:
    try:
        from .. import database as db

        image_quality = (db.get_ui_settings() or {}).get("imageQuality", {})
        output_format = str(image_quality.get("outputFormat", "jpg")).lower()
        if output_format == "png":
            return ".png", int(image_quality.get("pngCompression", 6)), "PNG"
        if output_format == "webp":
            return ".webp", int(image_quality.get("webpQuality", 90)), "WEBP"
        return ".jpg", int(image_quality.get("jpgQuality", 95)), "JPEG"
    except Exception:
        return ".jpg", 95, "JPEG"


def _save_image(image, output_path: Path) -> Path:
    extension, quality, pil_format = _image_settings()
    output_path = output_path.with_suffix(extension)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if pil_format == "PNG":
        image.save(output_path, "PNG", compress_level=quality)
    elif pil_format == "WEBP":
        image.convert("RGB").save(output_path, "WEBP", quality=quality)
    else:
        image.convert("RGB").save(output_path, "JPEG", quality=quality)
    return output_path


def _album_media_directory(rating_key: str) -> Optional[Path]:
    root = _fetch_xml(f"{settings.PLEX_URL}/library/metadata/{rating_key}/children")
    for part in root.findall(".//Part"):
        file_path = part.get("file")
        if not file_path:
            continue
        parent = Path(file_path).parent
        if parent.exists() and parent.is_dir():
            return parent
    return None


def _fallback_output_directory(req: MusicRenderRequest) -> Path:
    rendered = req.output_directory
    replacements = {
        "{library}": _safe_component(req.library_id or "Music", "Music"),
        "{artist}": _safe_component(req.artist, "Unknown Artist"),
        "{title}": _safe_component(req.title, "Unknown Album"),
        "{year}": str(req.year or ""),
        "{key}": _safe_component(req.rating_key, "unknown"),
    }
    for variable, value in replacements.items():
        rendered = rendered.replace(variable, value)

    path = Path(rendered).expanduser()
    if not path.is_absolute():
        path = Path(settings.CONFIG_DIR) / path
    return path


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


@router.post("/music/preview")
def api_music_preview(req: MusicRenderRequest):
    image = render_poster_image(
        "audiobookcover",
        req.background_url,
        None,
        _render_options(req),
    )
    buffer = BytesIO()
    image.convert("RGB").save(buffer, "JPEG", quality=90)
    return {
        "image_base64": base64.b64encode(buffer.getvalue()).decode("ascii"),
        "width": image.width,
        "height": image.height,
    }


@router.post("/music/save")
def api_music_save(req: MusicRenderRequest):
    if not req.save_to_disk and not req.send_to_plex:
        raise HTTPException(status_code=400, detail="Choose save_to_disk and/or send_to_plex")

    image = render_poster_image(
        "audiobookcover",
        req.background_url,
        None,
        _render_options(req),
    )

    result: Dict[str, Any] = {"status": "ok", "saved_path": None, "sent_to_plex": False}

    if req.save_to_disk:
        album_dir = _album_media_directory(req.rating_key) if req.save_beside_media else None
        used_fallback = album_dir is None
        target_dir = album_dir or _fallback_output_directory(req)
        requested_name = Path(req.filename or "cover.jpg").stem or "cover"
        output_path = _save_image(image, target_dir / requested_name)
        result["saved_path"] = str(output_path)
        result["used_fallback_path"] = used_fallback
        if req.save_beside_media and used_fallback:
            result["warning"] = (
                "Plex's album folder is not mounted inside the SimPoster container; "
                "the cover was saved to the fallback location instead."
            )

    if req.send_to_plex:
        buffer = BytesIO()
        image.convert("RGB").save(buffer, "JPEG", quality=95)
        response = requests.post(
            f"{settings.PLEX_URL}/library/metadata/{req.rating_key}/posters",
            headers={**plex_headers(), "Content-Type": "image/jpeg"},
            data=buffer.getvalue(),
            timeout=20,
        )
        try:
            response.raise_for_status()
        except Exception as exc:
            logger.error("[MUSIC] Plex artwork upload failed: %s", exc)
            raise HTTPException(status_code=502, detail=f"Plex artwork upload failed: {exc}") from exc
        result["sent_to_plex"] = True

    return result
