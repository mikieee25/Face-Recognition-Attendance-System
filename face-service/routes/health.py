"""GET /health — service health check."""

from fastapi import APIRouter

from models import HealthResponse
import anti_spoof
import config
import face_recognizer

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health():
    loaded = face_recognizer.is_model_loaded()
    status = "healthy" if loaded else "degraded"
    model_status = "loaded" if loaded else "not_loaded"

    if anti_spoof.is_enabled():
        anti_spoof_status = "loaded"
    elif not config.ANTISPOOF_ENABLED:
        anti_spoof_status = "disabled"
    else:
        anti_spoof_status = "not_loaded"

    return HealthResponse(
        status=status,
        face_detection=model_status,
        face_recognition=model_status,
        anti_spoofing=anti_spoof_status,
    )
