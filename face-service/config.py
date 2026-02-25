"""Application configuration loaded from environment variables."""

import os
from dotenv import load_dotenv

load_dotenv()

# Database
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "root")
DB_PASS = os.getenv("DB_PASS", "")
DB_NAME = os.getenv("DB_NAME", "bfp_sorsogon_attendance")

# Service
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "5001"))

# Models
INSIGHTFACE_MODEL_NAME = os.getenv("INSIGHTFACE_MODEL_NAME", "buffalo_l")

# Face detection quality threshold
MIN_FACE_DET_SCORE = float(os.getenv("MIN_FACE_DET_SCORE", "0.5"))

# Anti-spoofing
ANTISPOOF_ENABLED = os.getenv("ANTISPOOF_ENABLED", "true").lower() == "true"
ANTISPOOF_MODEL_PATH = os.getenv("ANTISPOOF_MODEL_PATH", "")
ANTISPOOF_THRESHOLD = float(os.getenv("ANTISPOOF_THRESHOLD", "0.5"))
ANTISPOOF_REAL_CLASS_INDEX = int(os.getenv("ANTISPOOF_REAL_CLASS_INDEX", "1"))
