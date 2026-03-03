# BFP Face Recognition Microservice

Python FastAPI service that provides face detection, recognition, and registration for the BFP Attendance System.

## Quick Start

```bash
cd face-service
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env        # edit DB credentials as needed
python main.py
```

The service starts on `http://localhost:5001`.

## Endpoints

| Method | Path                  | Description                                        |
| ------ | --------------------- | -------------------------------------------------- |
| GET    | `/health`             | Health check & model status                        |
| POST   | `/recognize`          | Recognize a face from a base64 image               |
| POST   | `/register`           | Register face embeddings for a person              |

## Models

On first run the **InsightFace buffalo_l** model pack is downloaded automatically (~300 MB). It includes:

- **RetinaFace** — face detection & alignment
- **ArcFace** — 512-dim face embedding / recognition

No separate YOLO model is required.

## Anti-Spoofing

Anti-spoofing is currently disabled in this deployment to avoid false negatives.

## Accuracy Improvements

This service includes several accuracy enhancements:

- **Centroid averaging** — multiple embeddings per person are averaged into a single centroid for more stable matching.
- **L2 normalization** — all embeddings are L2-normalized at extraction and load time for reliable cosine similarity.
- **Detection quality filtering** — faces below the `MIN_FACE_DET_SCORE` confidence threshold are rejected.
- **Embedding cache** — in-memory TTL cache reduces database queries during recognition (60s TTL).

## Environment Variables

See `.env.example` for all available options.
