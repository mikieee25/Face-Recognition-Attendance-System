"""Face detection using InsightFace's built-in RetinaFace detector.

The buffalo_l model pack includes a high-quality RetinaFace detector,
so we reuse it instead of loading a separate YOLO model.
"""

import logging

import numpy as np

import config

logger = logging.getLogger(__name__)

# The InsightFace app instance is set by the recognizer module on startup.
_app = None


def set_app(app):
    """Store the shared InsightFace FaceAnalysis app."""
    global _app
    _app = app


def detect_faces(image: np.ndarray) -> list:
    """Run face detection + alignment on *image* (BGR).

    Returns a list of InsightFace ``Face`` objects sorted by bounding-box
    area (largest first).
    """
    if _app is None:
        raise RuntimeError("InsightFace app not initialised")

    faces = _app.get(image)
    if not faces:
        return []

    # Sort by bbox area descending so the largest face comes first.
    def _bbox_area(face):
        bbox = face.bbox
        return (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])

    faces.sort(key=_bbox_area, reverse=True)
    return faces


def detect_face(image: np.ndarray):
    """Return the largest detected face with sufficient quality, or ``None``."""
    faces = detect_faces(image)
    if not faces:
        logger.info("No face detected in image")
        return None

    # Filter by detection confidence score
    min_score = config.MIN_FACE_DET_SCORE
    quality_faces = [f for f in faces if f.det_score >= min_score]
    if not quality_faces:
        logger.info(
            "Detected %d face(s) but none met quality threshold (%.2f)",
            len(faces),
            min_score,
        )
        return None

    logger.info(
        "Detected %d face(s), %d passed quality filter, using largest",
        len(faces),
        len(quality_faces),
    )
    return quality_faces[0]
