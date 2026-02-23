"""Utility functions for image encoding/decoding."""

import base64
import logging

import cv2
import numpy as np

logger = logging.getLogger(__name__)


def decode_base64_image(base64_str: str) -> np.ndarray:
    """Decode a base64-encoded image string to an OpenCV BGR image.

    Handles optional data URI prefix (e.g. 'data:image/jpeg;base64,...').
    """
    if "," in base64_str:
        base64_str = base64_str.split(",", 1)[1]

    img_bytes = base64.b64decode(base64_str)
    img_array = np.frombuffer(img_bytes, dtype=np.uint8)
    image = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

    if image is None:
        raise ValueError("Failed to decode image from base64 string")

    return image


def encode_image_base64(image: np.ndarray) -> str:
    """Encode an OpenCV BGR image to a base64 string (JPEG)."""
    _, buffer = cv2.imencode(".jpg", image)
    return base64.b64encode(buffer).decode("utf-8")
