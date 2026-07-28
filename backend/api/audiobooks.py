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
from .audiobook_settings import load_audiobook_settings

router = APIRouter()


class AudiobookRenderRequest(BaseModel):
    rating_key: str
    library_id: Optional[str] = None
    title: str
    author: str = ""
    narrator: str = ""
    series: str = ""
    series_number: str = ""
    year: Optional[int] = None
    background_url: str
    logo_url: Optional[str] = None
    options: Dict[str, Any] = Field(default_factory=dict)
    save_to_disk: bool = False
    send_to_plex: bool = False
    save_beside_media: Optional[bool] = None
    output_directory: Optional[str] = None
    filename: str = "cover.jpg"


def _fetch_xml(url: str, timeout: int = 15) -> ET.Element:
    try:
        response = plex_session.get(url, headers=plex_headers(), timeout=timeout)
        response.raise_for_status()
        return ET.fromstring(response.text)
    except Exception as exc:
        logger.warning("[AUDIOBOOKS] Plex request failed: %s (%s)", url, exc)
        raise HTTPException(status_code=502, detail=f"Plex request failed: {exc}") from exc


def _album_cover_url(rating_key: str) -> str:
    return f"/api/audiobook/{rating_key}/cover"


def _substitute_metadata(text: str, req: AudiobookRenderRequest) -> str:
    values = {
        "title": req.title,
        "author": req.author,
        "narrator": req.narrator,
        "series": req.series,
        "series_number": req.series_number,
        "year": str(req.year or ""),
    }
    result = text
    for key, value in values.items():
        result = result.replace(f"{{{key}}}", value or "")
    return result


def _render_options(req: AudiobookRenderRequest) -> Dict[str, Any]:
    options = dict(req.options or {})
    options["book_title"] = req.title
    options["author"] = req.author
    options["narrator"] = req.narrator
    options["series"] = req.series
    options["series_number"] = req.series_number
    options["movie_title"] = req.title
    options["movie_year"] = str(req.year or "")
    options["media_type"] = "audiobook"

    custom_text = options.get("custom_text")
    if isinstance(custom_text, str):
        options["custom_text"] = _substitute_metadata(custom_text, req)

    metadata = dict(options.get("metadata") or {})
    metadata.update(
        {
            "title": req.title,
            "author": req.author,
            "narrator": req.narrator,
            "series": req.series,
            "series_number": req.series_number,
            "year": req.year,
            "media_type": "audiobook",
        }
    )
    options["metadata"] = metadata
    return options


def _image_settings() -> tuple[str, int, str]:
    """Return extension, quality/compression value, and Pillow format."""
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
    """Resolve the album directory from the first playable Plex track."""
    root = _fetch_xml(f"{settings.PLEX_URL}/library/metadata/{rating_key}/children")
    for part in root.findall(".//Part"):
        file_path = part.get("file")
        if not file_path:
            continue
        parent = Path(file_path).parent
        if parent.exists() and parent.is_dir():
            return parent
    return None


def _safe_component(value: str, fallback: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9 _().'-]", "", value or fallback).strip()
    return cleaned or fallback


def _fallback_output_directory(req: AudiobookRenderRequest) -> Path:
    audiobook_settings = load_audiobook_settings()
    template = req.output_directory or audiobook_settings.fallback_save_path

    replacements = {
        "{library}": _safe_component(req.library_id or "Audiobooks", "Audiobooks"),
        "{author}": _safe_component(req.author, "Unknown Author"),
        "{title}": _safe_component(req.title, "Unknown Title"),
        "{year}": str(req.year or ""),
        "{key}": _safe_component(req.rating_key, "unknown"),
    }
    rendered = template
    for variable, value in replacements.items():
        rendered = rendered.replace(variable, value)

    path = Path(rendered).expanduser()
    if not path.is_absolute():
        path = Path(settings.CONFIG_DIR) / path
    return path


def _save_beside_media(req: AudiobookRenderRequest) -> bool:
    if req.save_beside_media is not None:
        return req.save_beside_media
    return load_audiobook_settings().save_beside_media


@router.get("/audiobook-libraries")
def api_audiobook_libraries():
    root = _fetch_xml(f"{settings.PLEX_URL}/library/sections")
    libraries = []
    for directory in root.findall(".//Directory"):
        library_type = (directory.get("type") or "").lower()
        if library_type not in {"artist", "music"}:
            continue
        libraries.append(
            {
                "id": directory.get("key"),
                "title": directory.get("title") or "Music",
                "type": library_type,
            }
        )
    return libraries


@router.get("/audiobooks")
def api_audiobooks(library_id: str = Query(...)):
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
                "author": directory.get("parentTitle") or "",
                "artist_key": directory.get("parentRatingKey"),
                "year": int(year_value) if year_value and year_value.isdigit() else None,
                "addedAt": int(added_value) if added_value and added_value.isdigit() else None,
                "poster": _album_cover_url(rating_key),
                "library_id": str(library_id),
                "guid": directory.get("guid"),
            }
        )

    albums.sort(key=lambda album: ((album.get("author") or "").lower(), album["title"].lower()))
    return albums


@router.get("/audiobook/{rating_key}/cover")
def api_audiobook_cover(rating_key: str):
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


@router.post("/audiobook/preview")
def api_audiobook_preview(req: AudiobookRenderRequest):
    image = render_poster_image(
        "audiobookcover",
        req.background_url,
        req.logo_url or None,
        _render_options(req),
    )
    buffer = BytesIO()
    image.convert("RGB").save(buffer, "JPEG", quality=90)
    return {
        "image_base64": base64.b64encode(buffer.getvalue()).decode("ascii"),
        "width": image.width,
        "height": image.height,
    }


@router.post("/audiobook/save")
def api_audiobook_save(req: AudiobookRenderRequest):
    if not req.save_to_disk and not req.send_to_plex:
        raise HTTPException(status_code=400, detail="Choose save_to_disk and/or send_to_plex")

    image = render_poster_image(
        "audiobookcover",
        req.background_url,
        req.logo_url or None,
        _render_options(req),
    )

    result: Dict[str, Any] = {"status": "ok", "saved_path": None, "sent_to_plex": False}

    if req.save_to_disk:
        use_media_directory = _save_beside_media(req)
        album_dir = _album_media_directory(req.rating_key) if use_media_directory else None
        used_fallback = album_dir is None
        target_dir = album_dir or _fallback_output_directory(req)
        requested_name = Path(req.filename or "cover.jpg").stem or "cover"
        output_path = _save_image(image, target_dir / requested_name)
        result["saved_path"] = str(output_path)
        result["used_fallback_path"] = used_fallback
        if use_media_directory and used_fallback:
            result["warning"] = (
                "Plex's audiobook folder is not mounted inside the SimPoster container; "
                "the cover was saved to the configured fallback location instead."
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
            logger.error("[AUDIOBOOKS] Plex artwork upload failed: %s", exc)
            raise HTTPException(status_code=502, detail=f"Plex artwork upload failed: {exc}") from exc
        result["sent_to_plex"] = True

    return result
