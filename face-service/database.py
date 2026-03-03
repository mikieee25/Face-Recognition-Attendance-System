"""Async MySQL database connection pool and query helpers."""

import json
import logging
from typing import Optional

import aiomysql
import numpy as np

import config

logger = logging.getLogger(__name__)

pool: Optional[aiomysql.Pool] = None


def _l2_normalize(vec: np.ndarray) -> np.ndarray:
    """L2-normalize a vector so cosine similarity reduces to dot product."""
    norm = np.linalg.norm(vec)
    if norm > 0:
        return vec / norm
    return vec


async def create_pool():
    """Create the global connection pool. Called on app startup."""
    global pool
    pool = await aiomysql.create_pool(
        host=config.DB_HOST,
        port=config.DB_PORT,
        user=config.DB_USER,
        password=config.DB_PASS,
        db=config.DB_NAME,
        autocommit=True,
        minsize=2,
        maxsize=10,
    )
    logger.info("Database connection pool created")


async def close_pool():
    """Close the connection pool. Called on app shutdown."""
    global pool
    if pool:
        pool.close()
        await pool.wait_closed()
        logger.info("Database connection pool closed")


async def get_embeddings_by_station(station_id: int) -> list[tuple[int, np.ndarray]]:
    """Load all face embeddings for personnel at the given station.

    Returns a list of (personnel_id, embedding_vector) tuples.
    """
    results: list[tuple[int, np.ndarray]] = []

    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            # 512-dim embeddings from face_embeddings
            await cur.execute(
                """
                SELECT fe.personnel_id, fe.embedding
                FROM face_embeddings fe
                JOIN personnel p ON p.id = fe.personnel_id
                WHERE p.station_id = %s
                """,
                (station_id,),
            )
            rows = await cur.fetchall()
            for personnel_id, embedding_json in rows:
                try:
                    raw = (
                        embedding_json
                        if isinstance(embedding_json, str)
                        else json.dumps(embedding_json)
                    )
                    vec = np.array(json.loads(raw), dtype=np.float32)
                    if vec.size > 0:
                        results.append((personnel_id, _l2_normalize(vec)))
                except (json.JSONDecodeError, ValueError, TypeError) as exc:
                    logger.warning(
                        "Skipping bad face_embeddings row for personnel %s: %s",
                        personnel_id,
                        exc,
                    )

    logger.info("Loaded %d embeddings for station %d", len(results), station_id)
    return results


async def save_embeddings(personnel_id: int, embeddings: list[np.ndarray]) -> None:
    """Persist 512-dim embeddings into the ``face_embeddings`` table."""
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            for emb in embeddings:
                emb_json = json.dumps(emb.tolist())
                await cur.execute(
                    """
                    INSERT INTO face_embeddings (personnel_id, embedding, created_at)
                    VALUES (%s, %s, NOW())
                    """,
                    (personnel_id, emb_json),
                )
    logger.info("Saved %d embeddings for personnel %d", len(embeddings), personnel_id)
