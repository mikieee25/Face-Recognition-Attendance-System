"""POST /recognize — identify a person from a face image."""

import logging

from fastapi import APIRouter

from models import RecognizeRequest, RecognizeResponse
from utils import decode_base64_image
import anti_spoof
import config
import database
import embedding_cache
import face_detector
import face_recognizer

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/recognize", response_model=RecognizeResponse)
async def recognize(body: RecognizeRequest):
    # 1. Decode image
    try:
        image = decode_base64_image(body.image)
    except Exception as exc:
        logger.error("Image decode failed: %s", exc)
        return RecognizeResponse(
            success=False,
            personnel_id=None,
            confidence=0.0,
            message="Invalid image data",
        )

    # 2. Detect face
    face = face_detector.detect_face(image)
    if face is None:
        return RecognizeResponse(
            success=False,
            personnel_id=None,
            confidence=0.0,
            message="No face detected",
        )

    # 3. Anti-spoofing check
    if config.ANTISPOOF_ENABLED and anti_spoof.is_enabled():
        is_real, spoof_confidence = anti_spoof.check_liveness(image, face.bbox)
        if not is_real:
            return RecognizeResponse(
                success=False,
                personnel_id=None,
                confidence=0.0,
                message=f"Spoofing detected (confidence: {spoof_confidence:.2f}). Please use a live face.",
            )

    # 4. Extract embedding
    try:
        embedding = face_recognizer.get_embedding(face)
    except Exception as exc:
        logger.error("Embedding extraction failed: %s", exc)
        return RecognizeResponse(
            success=False,
            personnel_id=None,
            confidence=0.0,
            message="Embedding extraction failed",
        )

    # 5. Load stored embeddings for the station (with cache)
    try:
        stored = embedding_cache.get(body.station_id)
        if stored is None:
            stored = await database.get_embeddings_by_station(body.station_id)
            embedding_cache.put(body.station_id, stored)
    except Exception as exc:
        logger.error("Database query failed: %s", exc)
        return RecognizeResponse(
            success=False,
            personnel_id=None,
            confidence=0.0,
            message="Database error",
        )

    if not stored:
        return RecognizeResponse(
            success=False,
            personnel_id=None,
            confidence=0.0,
            message="No registered faces for this station",
        )

    # 6. Compare
    personnel_id, confidence = face_recognizer.compare_embeddings(embedding, stored)

    if personnel_id is None:
        return RecognizeResponse(
            success=False,
            personnel_id=None,
            confidence=0.0,
            message="Face not recognized",
        )

    # Return the match — threshold enforcement is done by the NestJS API
    return RecognizeResponse(
        success=True,
        personnel_id=personnel_id,
        confidence=confidence,
        message="Face recognized",
    )
