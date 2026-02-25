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
        # MiniFASNet training/inference pipeline uses RGB ordering.
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
        blob = rgb.astype(np.float32) / 255.0
        blob = blob.transpose(2, 0, 1)  # HWC -> CHW
        blob = np.expand_dims(blob, axis=0)  # Add batch dim

        # Run inference
        input_name = _model.get_inputs()[0].name
        output = _model.run(None, {input_name: blob})[0]

        # Output is usually [batch, N] logits, where N can be 2 or 3.
        # Silent-Face models generally use class index 1 as "real/live".
        logits = output[0]
        if np.ndim(logits) != 1:
            logits = np.ravel(logits)

        if logits.size >= 2:
            # Numerically stable softmax
            shifted = logits - np.max(logits)
            exp_scores = np.exp(shifted)
            probs = exp_scores / np.sum(exp_scores)

            real_idx = config.ANTISPOOF_REAL_CLASS_INDEX
            if real_idx < 0 or real_idx >= probs.size:
                logger.warning(
                    "Invalid ANTISPOOF_REAL_CLASS_INDEX=%s for %s classes. "
                    "Falling back to class index 1 when possible.",
                    real_idx,
                    probs.size,
                )
                real_idx = 1 if probs.size > 1 else 0

            real_score = float(probs[real_idx])
            logger.debug(
                "Anti-spoof raw class probabilities=%s (real_idx=%s)",
                np.array2string(probs, precision=4, suppress_small=True),
                real_idx,
            )
        else:
            # Single-logit fallback (sigmoid)
            real_score = float(1.0 / (1.0 + np.exp(-logits[0])))

        is_real = real_score > config.ANTISPOOF_THRESHOLD
        logger.info(
            "Anti-spoof check: is_real=%s, confidence=%.3f", is_real, real_score
        )
        return is_real, real_score

    except Exception as exc:
        logger.warning("Anti-spoof check failed: %s. Allowing through.", exc)
        return True, 1.0
