"""POST /register — register face embeddings for a person."""

import logging

from fastapi import APIRouter

from models import RegisterRequest, RegisterResponse
from utils import decode_base64_image
import database
import embedding_cache
import face_detector
import face_recognizer

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/register", response_model=RegisterResponse)
async def register(body: RegisterRequest):
    embeddings = []

    for idx, img_b64 in enumerate(body.images):
        # Decode image
        try:
            image = decode_base64_image(img_b64)
        except Exception as exc:
            logger.error("Image %d decode failed: %s", idx, exc)
            return RegisterResponse(success=False, embeddings=[])

        # Detect face.
        # Registration is more tolerant than recognition so users can enroll
        # in suboptimal lighting/angles and still generate embeddings.
        face = face_detector.detect_face(image)
        if face is None:
            fallback_faces = face_detector.detect_faces(image)
            if fallback_faces:
                face = fallback_faces[0]
                logger.warning(
                    "Image %d for personnel %d passed fallback face selection "
                    "(det_score=%.3f below MIN_FACE_DET_SCORE)",
                    idx,
                    body.personnel_id,
                    float(getattr(face, "det_score", 0.0)),
                )
            else:
                logger.warning(
                    "No face in image %d for personnel %d", idx, body.personnel_id
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
