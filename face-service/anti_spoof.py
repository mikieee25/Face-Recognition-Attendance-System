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

# Default model input size. Overridden automatically from ONNX input tensor shape
# when available.
MODEL_INPUT_SIZE = (128, 128)


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
        # Auto-detect expected input size from ONNX model input shape.
        # Typical shape: [None, 3, H, W]
        try:
            input_shape = _model.get_inputs()[0].shape
            h = input_shape[2] if len(input_shape) >= 4 else None
            w = input_shape[3] if len(input_shape) >= 4 else None
            if isinstance(h, int) and isinstance(w, int) and h > 0 and w > 0:
                global MODEL_INPUT_SIZE
                MODEL_INPUT_SIZE = (w, h)
                logger.info("Anti-spoof model input size detected: %sx%s", w, h)
            else:
                logger.info(
                    "Anti-spoof model input size is dynamic/unknown (%s). "
                    "Using default %sx%s.",
                    input_shape,
                    MODEL_INPUT_SIZE[0],
                    MODEL_INPUT_SIZE[1],
                )
        except Exception as exc:
            logger.warning(
                "Failed to inspect anti-spoof input shape: %s. Using default %sx%s.",
                exc,
                MODEL_INPUT_SIZE[0],
                MODEL_INPUT_SIZE[1],
            )
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
        # and keep a square crop with reflection padding near image borders.
        h, w = image.shape[:2]
        face_w = x2 - x1
        face_h = y2 - y1
        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2

        crop_size = max(1, int(max(face_w, face_h) * 2.7))
        x = int(cx - crop_size / 2)
        y = int(cy - crop_size / 2)

        crop_x1 = max(0, x)
        crop_y1 = max(0, y)
        crop_x2 = min(w, x + crop_size)
        crop_y2 = min(h, y + crop_size)

        top_pad = int(max(0, -y))
        left_pad = int(max(0, -x))
        bottom_pad = int(max(0, (y + crop_size) - h))
        right_pad = int(max(0, (x + crop_size) - w))

        if crop_x2 <= crop_x1 or crop_y2 <= crop_y1:
            return True, 1.0
        crop = image[crop_y1:crop_y2, crop_x1:crop_x2]
        if top_pad or bottom_pad or left_pad or right_pad:
            crop = cv2.copyMakeBorder(
                crop,
                top_pad,
                bottom_pad,
                left_pad,
                right_pad,
                cv2.BORDER_REFLECT_101,
            )

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
        # Real/live class index is configurable via ANTISPOOF_REAL_CLASS_INDEX.
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
