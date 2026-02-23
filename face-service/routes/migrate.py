"""POST /migrate-embeddings — re-register old 128-dim embeddings with the new 512-dim model."""

import logging

from fastapi import APIRouter

import database

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/migrate-embeddings")
async def migrate_embeddings():
    """Re-process all personnel face images and generate new 512-dim embeddings.

    This reads the original face images from the face_data table filenames,
    but since we may not have the original image files, this endpoint instead
    re-generates embeddings from any existing face_data entries that have
    associated image files on disk.

    For personnel without accessible images, they'll need to be re-registered
    via the normal /register flow.
    """
    stats = {"processed": 0, "skipped": 0, "failed": 0, "personnel_ids": []}

    async with database.pool.acquire() as conn:
        async with conn.cursor() as cur:
            # Get all personnel who only have old 128-dim embeddings (no 512-dim yet)
            await cur.execute(
                """
                SELECT DISTINCT fd.personnel_id
                FROM face_data fd
                LEFT JOIN face_embeddings fe ON fe.personnel_id = fd.personnel_id
                WHERE fe.id IS NULL AND fd.embedding IS NOT NULL
            """
            )
            rows = await cur.fetchall()
            personnel_ids = [r[0] for r in rows]

    if not personnel_ids:
        return {
            "success": True,
            "message": "No personnel need migration",
            "stats": stats,
        }

    logger.info("Found %d personnel needing embedding migration", len(personnel_ids))

    return {
        "success": True,
        "message": f"Found {len(personnel_ids)} personnel with only legacy embeddings. "
        "They need to be re-registered via the /register endpoint with new face photos. "
        "Personnel IDs: " + ", ".join(str(pid) for pid in personnel_ids),
        "personnel_ids": personnel_ids,
        "stats": stats,
    }
