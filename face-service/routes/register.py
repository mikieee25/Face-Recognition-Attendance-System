"""POST /register — register face embeddings for a person."""

import logging

from fastapi import APIRouter

from models import RegisterRequest, RegisterResponse
from utils import decode_base64_image
import anti_spoof
import config
import database
import embedding_cache
import face_detector
import face_recognizer

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/register", response_model=RegisterResponse)
async def register(body: RegisterRequest):
    embeddings = []

    # For registration, fail closed when liveness is required but unavailable.
    if config.ANTISPOOF_ENABLED and not anti_spoof.is_enabled():
        logger.error(
            "Registration blocked: anti-spoofing is enabled but model is unavailable"
        )
        return RegisterResponse(success=False, embeddings=[])

    for idx, img_b64 in enumerate(body.images):
        # Decode image
        try:
            image = decode_base64_image(img_b64)
        except Exception as exc:
            logger.error("Image %d decode failed: %s", idx, exc)
            return RegisterResponse(success=False, embeddings=[])

        # Detect face
        face = face_detector.detect_face(image)
        if face is None:
            logger.warning(
                "No face in image %d for personnel %d", idx, body.personnel_id
            )
            continue

        # Registration must enforce liveness to prevent photo/screen enrollment.
        if config.ANTISPOOF_ENABLED:
            is_real, spoof_confidence = anti_spoof.check_liveness(image, face.bbox)
            if not is_real:
                logger.warning(
                    "Spoof detected in registration image %d for personnel %d "
                    "(confidence=%.3f); skipping image",
                    idx,
                    body.personnel_id,
                    spoof_confidence,
                )
                continue

        # Extract embedding
        emb = face_recognizer.get_embedding(face)
        embeddings.append(emb)

    if not embeddings:
        return RegisterResponse(success=False, embeddings=[])

    # Save to database
    try:
        await database.save_embeddings(body.personnel_id, embeddings)
    except Exception as exc:
        logger.error("Failed to save embeddings: %s", exc)
        return RegisterResponse(success=False, embeddings=[])

    # Invalidate embedding cache for the personnel's station
    try:
        async with database.pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "SELECT station_id FROM personnel WHERE id = %s",
                    (body.personnel_id,),
                )
                row = await cur.fetchone()
                if row:
                    embedding_cache.invalidate(row[0])
    except Exception as exc:
        logger.warning("Failed to invalidate cache after registration: %s", exc)

    logger.info(
        "Registered %d embeddings for personnel %d",
        len(embeddings),
        body.personnel_id,
    )
    return RegisterResponse(
        success=True,
        embeddings=[emb.tolist() for emb in embeddings],
    )
