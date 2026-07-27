import json
from pathlib import Path
from typing import List, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..config import logger, settings

router = APIRouter()

_SETTINGS_PATH = Path(settings.SETTINGS_DIR) / "audiobook_settings.json"


class AudiobookLibraryMapping(BaseModel):
    id: str
    title: str = ""
    display_name: str = ""
    enabled: bool = True
    default_preset_id: str = ""


class AudiobookSettings(BaseModel):
    enabled: bool = True
    library_mappings: List[AudiobookLibraryMapping] = Field(default_factory=list)
    default_preset_id: str = "default"
    save_beside_media: bool = True
    fallback_save_path: str = "/config/output/{library}/{author}/{title}"
    default_text_enabled: bool = False
    default_text: str = "{title}\n{author}"
    default_logo_mode: Literal["original", "match", "hex", "none"] = "none"
    default_matte: int = Field(default=0, ge=0, le=50)
    default_fade: int = Field(default=15, ge=0, le=100)
    default_grain: int = Field(default=15, ge=0, le=60)
    default_vignette: int = Field(default=15, ge=0, le=100)


def default_audiobook_settings() -> AudiobookSettings:
    return AudiobookSettings()


def load_audiobook_settings() -> AudiobookSettings:
    if not _SETTINGS_PATH.exists():
        return default_audiobook_settings()

    try:
        raw = json.loads(_SETTINGS_PATH.read_text(encoding="utf-8"))
        return AudiobookSettings(**raw)
    except Exception as exc:
        logger.warning("[AUDIOBOOK_SETTINGS] Could not read settings: %s", exc)
        return default_audiobook_settings()


def save_audiobook_settings(payload: AudiobookSettings) -> AudiobookSettings:
    try:
        _SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = _SETTINGS_PATH.with_suffix(".json.tmp")
        temporary_path.write_text(
            json.dumps(payload.model_dump(), indent=2),
            encoding="utf-8",
        )
        temporary_path.replace(_SETTINGS_PATH)
        return payload
    except Exception as exc:
        logger.error("[AUDIOBOOK_SETTINGS] Could not save settings: %s", exc)
        raise HTTPException(status_code=500, detail=f"Could not save audiobook settings: {exc}") from exc


@router.get("/audiobook-settings")
def api_get_audiobook_settings():
    return load_audiobook_settings()


@router.post("/audiobook-settings")
def api_save_audiobook_settings(payload: AudiobookSettings):
    return save_audiobook_settings(payload)
