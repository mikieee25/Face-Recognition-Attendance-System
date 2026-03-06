"""POST /invalidate-cache — invalidate the in-memory embedding cache."""

import logging
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

import embedding_cache

logger = logging.getLogger(__name__)
router = APIRouter()


class InvalidateCacheRequest(BaseModel):
    station_id: Optional[int] = None


class InvalidateCacheResponse(BaseModel):
    success: bool
    message: str


@router.post("/invalidate-cache", response_model=InvalidateCacheResponse)
async def invalidate_cache(body: InvalidateCacheRequest):
    """Invalidate the in-memory embedding cache.

    - If station_id is provided, only that station's cache is cleared.
    - If station_id is None or omitted, all cached embeddings are cleared.
    """
    if body.station_id is not None:
        embedding_cache.invalidate(body.station_id)
        msg = f"Cache invalidated for station {body.station_id}"
        logger.info(msg)
    else:
        embedding_cache.invalidate()
        msg = "All embedding caches invalidated"
        logger.info(msg)

    return InvalidateCacheResponse(success=True, message=msg)
