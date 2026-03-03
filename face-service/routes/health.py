"""GET /health — service health check."""

from fastapi import APIRouter

from models import HealthResponse
import face_recognizer

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health():
    loaded = face_recognizer.is_model_loaded()
    status = "healthy" if loaded else "degraded"
    model_status = "loaded" if loaded else "not_loaded"

    return HealthResponse(
        status=status,
        face_detection=model_status,
        face_recognition=model_status,
        anti_spoofing="disabled",
    )
