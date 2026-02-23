"""In-memory cache for station embeddings to reduce DB queries."""

import logging
import time
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# Cache structure: {station_id: (timestamp, embeddings_list)}
_cache: dict[int, tuple[float, list[tuple[int, np.ndarray]]]] = {}

# Cache TTL in seconds (default 60s — embeddings don't change often)
CACHE_TTL = 60.0


def get(station_id: int) -> Optional[list[tuple[int, np.ndarray]]]:
    """Return cached embeddings for station_id, or None if expired/missing."""
    entry = _cache.get(station_id)
    if entry is None:
        return None
    ts, embeddings = entry
    if time.time() - ts > CACHE_TTL:
        del _cache[station_id]
        logger.debug("Cache expired for station %d", station_id)
        return None
    logger.debug(
        "Cache hit for station %d (%d embeddings)", station_id, len(embeddings)
    )
    return embeddings


def put(station_id: int, embeddings: list[tuple[int, np.ndarray]]):
    """Store embeddings in cache."""
    _cache[station_id] = (time.time(), embeddings)
    logger.debug("Cached %d embeddings for station %d", len(embeddings), station_id)


def invalidate(station_id: Optional[int] = None):
    """Invalidate cache for a specific station, or all stations if None."""
    if station_id is not None:
        _cache.pop(station_id, None)
        logger.debug("Invalidated cache for station %d", station_id)
    else:
        _cache.clear()
        logger.debug("Invalidated all embedding caches")
