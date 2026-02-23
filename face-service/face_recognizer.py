"""Face recognition: embedding generation and comparison.

Uses InsightFace buffalo_l which produces 512-dimensional embeddings.
Also handles comparison against legacy 128-dim embeddings via cosine
similarity.
"""

import logging

import numpy as np
from insightface.app import FaceAnalysis

import config
import face_detector

logger = logging.getLogger(__name__)

app: FaceAnalysis | None = None


def load_model():
    """Download (if needed) and initialise the InsightFace model."""
    global app
    logger.info("Loading InsightFace model '%s' …", config.INSIGHTFACE_MODEL_NAME)
    app = FaceAnalysis(
        name=config.INSIGHTFACE_MODEL_NAME,
        providers=["CPUExecutionProvider"],
    )
    # det_size controls the input resolution for the detector
    app.prepare(ctx_id=0, det_size=(640, 640))
    face_detector.set_app(app)
    logger.info("InsightFace model loaded successfully")


def get_embedding(face) -> np.ndarray:
    """Extract the 512-dim embedding from an InsightFace ``Face`` object.

    The face object already contains the embedding after ``app.get()``
    has been called during detection.  The vector is L2-normalised before
    returning so that cosine similarity reduces to a simple dot product.
    """
    emb = face.embedding
    if emb is None:
        raise ValueError("Face object has no embedding")
    emb = emb.astype(np.float32)
    # L2-normalize for more reliable cosine similarity
    norm = np.linalg.norm(emb)
    if norm > 0:
        emb = emb / norm
    return emb


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Compute cosine similarity between two vectors of any dimension."""
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def compare_embeddings(
    embedding: np.ndarray,
    stored_embeddings: list[tuple[int, np.ndarray]],
) -> tuple[int | None, float]:
    """Compare *embedding* against stored embeddings using centroid averaging.

    Embeddings for the same ``personnel_id`` are grouped and averaged into
    a single centroid vector before comparison.  This reduces noise from
    individual registration photos and gives more stable matching.

    For legacy cross-dimension embeddings (e.g. 128-dim vs 512-dim) the
    comparison falls back to per-vector cosine similarity on the
    overlapping dimensions.

    Returns ``(personnel_id, confidence)`` of the best match, or
    ``(None, 0.0)`` when *stored_embeddings* is empty.
    """
    if not stored_embeddings:
        return None, 0.0

    # Group embeddings by personnel_id and compute centroids
    from collections import defaultdict

    groups: dict[int, list[np.ndarray]] = defaultdict(list)
    for pid, vec in stored_embeddings:
        groups[pid].append(vec)

    best_id: int | None = None
    best_score: float = -1.0

    for pid, vecs in groups.items():
        # Separate same-dim and cross-dim embeddings
        same_dim = [v for v in vecs if v.shape[0] == embedding.shape[0]]
        cross_dim = [v for v in vecs if v.shape[0] != embedding.shape[0]]

        scores = []

        # Average same-dim embeddings into centroid
        if same_dim:
            centroid = np.mean(same_dim, axis=0).astype(np.float32)
            centroid = centroid / (np.linalg.norm(centroid) + 1e-10)
            scores.append(_cosine_similarity(embedding, centroid))

        # For cross-dim, compare individually and take max
        for v in cross_dim:
            min_dim = min(embedding.shape[0], v.shape[0])
            scores.append(_cosine_similarity(embedding[:min_dim], v[:min_dim]))

        if scores:
            person_score = max(scores)
            if person_score > best_score:
                best_score = person_score
                best_id = pid

    # Clamp to [0, 1]
    best_score = max(0.0, min(1.0, best_score))
    return best_id, round(best_score, 4)


def is_model_loaded() -> bool:
    """Return True if the InsightFace model is ready."""
    return app is not None
