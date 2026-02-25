"""Face anti-spoofing using Silent-Face-Anti-Spoofing (MiniFASNet).

Classifies whether a detected face is from a live person or a printed
photo / screen replay. Uses a lightweight ONNX model (~1MB).
"""

import logging
import os

import cv2
import numpy as np

import config

logger = logging.getLogger(__name__)

_model = None
_enabled = True

# Model input size for MiniFASNet
MODEL_INPUT_SIZE = (80, 80)


def load_model():
    """Load the anti-spoofing ONNX model."""
    global _model, _enabled

    model_path = os.getenv("ANTISPOOF_MODEL_PATH", "")

    if not model_path:
        # Try to find the model in common locations
        candidates = [
            "models/minifasnet_v2.onnx",
            "minifasnet_v2.onnx",
        ]
        for c in candidates:
            if os.path.exists(c):
                model_path = c
                break

    if not model_path or not os.path.exists(model_path):
        logger.warning(
            "Anti-spoofing model not found. Spoofing detection disabled. "
            "Download the model and set ANTISPOOF_MODEL_PATH env var to enable."
        )
        _enabled = False
        return

    try:
        import onnxruntime as ort

        _model = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])
        logger.info("Anti-spoofing model loaded from %s", model_path)
    except Exception as exc:
        logger.warning(
            "Failed to load anti-spoofing model: %s. Spoofing detection disabled.", exc
        )
        _enabled = False


def is_enabled() -> bool:
    """Return True if anti-spoofing is available."""
    return _enabled and _model is not None


def check_liveness(image: np.ndarray, face_bbox: np.ndarray) -> tuple[bool, float]:
    """Check if the face in the image is from a live person.

    Args:
        image: Full BGR image
        face_bbox: [x1, y1, x2, y2] bounding box from face detection

    Returns:
        (is_real, confidence) — True if live person, confidence 0-1
    """
    if not is_enabled():
        # If model not loaded, assume real (don't block recognition)
        return True, 1.0

    try:
        x1, y1, x2, y2 = [int(v) for v in face_bbox]

        # Add margin around face (2.7x the face size, common for anti-spoof models)
        h, w = image.shape[:2]
        face_w = x2 - x1
        face_h = y2 - y1
        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2

        margin = max(face_w, face_h) * 1.35
        nx1 = max(0, int(cx - margin))
        ny1 = max(0, int(cy - margin))
        nx2 = min(w, int(cx + margin))
        ny2 = min(h, int(cy + margin))

        crop = image[ny1:ny2, nx1:nx2]
        if crop.size == 0:
            return True, 1.0

        # Preprocess
        resized = cv2.resize(crop, MODEL_INPUT_SIZE)
        blob = resized.astype(np.float32) / 255.0
        blob = blob.transpose(2, 0, 1)  # HWC -> CHW
        blob = np.expand_dims(blob, axis=0)  # Add batch dim

        # Run inference
        input_name = _model.get_inputs()[0].name
        output = _model.run(None, {input_name: blob})[0]

        # Output is typically [batch, 2] — [fake_score, real_score]
        # or [batch, 1] — sigmoid output
        if output.shape[-1] == 2:
            scores = np.exp(output[0]) / np.sum(np.exp(output[0]))  # softmax
            real_score = float(scores[1])
        else:
            real_score = float(1.0 / (1.0 + np.exp(-output[0][0])))  # sigmoid

        threshold = float(config.ANTISPOOF_THRESHOLD)
        is_real = real_score >= threshold
        logger.info(
            "Anti-spoof check: is_real=%s, confidence=%.3f, threshold=%.3f",
            is_real,
            real_score,
            threshold,
        )
        return is_real, real_score

    except Exception as exc:
        logger.warning("Anti-spoof check failed: %s. Allowing through.", exc)
        return True, 1.0
