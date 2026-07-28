import json
import os
from pathlib import Path
from typing import List, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..config import logger, settings
from ..google_books_guard import (
    GOOGLE_BOOKS_DEFAULT_DAILY_LIMIT,
    GOOGLE_BOOKS_HARD_DAILY_CAP,
    GoogleBooksProviderError,
    GoogleBooksRequestBlocked,
    get_google_books_usage_status,
    test_google_books_api_key,
)

router = APIRouter()

_SETTINGS_PATH = Path(settings.SETTINGS_DIR) / "audiobook_settings.json"

AudibleRegion = Literal["au", "ca", "de", "es", "fr", "in", "it", "jp", "us", "uk"]


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
    audible_region: AudibleRegion = "us"
    google_books_api_key: str = Field(
        default_factory=lambda: os.getenv("GOOGLE_BOOKS_API_KEY", "")
    )
    google_books_daily_limit: int = Field(
        default=GOOGLE_BOOKS_DEFAULT_DAILY_LIMIT,
        ge=1,
        le=GOOGLE_BOOKS_HARD_DAILY_CAP,
    )


class GoogleBooksKeyTestRequest(BaseModel):
    api_key: str = Field(min_length=1)
    daily_limit: int = Field(
        default=GOOGLE_BOOKS_DEFAULT_DAILY_LIMIT,
        ge=1,
        le=GOOGLE_BOOKS_HARD_DAILY_CAP,
    )


def _apply_runtime_google_key(payload: AudiobookSettings) -> None:
    # Keep an environment-compatible runtime attribute without requiring the key
    # to be hard-coded anywhere in the repository.
    object.__setattr__(settings, "GOOGLE_BOOKS_API_KEY", payload.google_books_api_key)


def default_audiobook_settings() -> AudiobookSettings:
    payload = AudiobookSettings()
    _apply_runtime_google_key(payload)
    return payload


def load_audiobook_settings() -> AudiobookSettings:
    if not _SETTINGS_PATH.exists():
        return default_audiobook_settings()

    try:
        raw = json.loads(_SETTINGS_PATH.read_text(encoding="utf-8"))
        if not raw.get("google_books_api_key"):
            env_key = os.getenv("GOOGLE_BOOKS_API_KEY", "")
            if env_key:
                raw["google_books_api_key"] = env_key
        payload = AudiobookSettings(**raw)
        _apply_runtime_google_key(payload)
        return payload
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
        # The persisted JSON now contains an API key. Restrict it to the account
        # running SimPoster wherever the host filesystem supports POSIX modes.
        try:
            _SETTINGS_PATH.chmod(0o600)
        except OSError as exc:
            logger.warning("[AUDIOBOOK_SETTINGS] Could not restrict settings permissions: %s", exc)
        _apply_runtime_google_key(payload)
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


@router.get("/audiobook-settings/google-books-status")
def api_google_books_status():
    payload = load_audiobook_settings()
    return {
        "configured": bool(payload.google_books_api_key.strip()),
        **get_google_books_usage_status(payload.google_books_daily_limit),
    }


@router.post("/test-google-books")
def api_test_google_books(payload: GoogleBooksKeyTestRequest):
    try:
        return test_google_books_api_key(payload.api_key, payload.daily_limit)
    except (GoogleBooksRequestBlocked, GoogleBooksProviderError) as exc:
        return {
            "status": "error",
            "error": str(exc),
            "usage": get_google_books_usage_status(payload.daily_limit),
        }
    except Exception as exc:
        logger.error("[TEST_GOOGLE_BOOKS] Error testing API key: %s", exc)
        return {
            "status": "error",
            "error": "Google Books key test failed.",
            "usage": get_google_books_usage_status(payload.daily_limit),
        }
