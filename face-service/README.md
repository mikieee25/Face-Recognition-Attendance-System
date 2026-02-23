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
| POST   | `/migrate-embeddings` | Find personnel with only legacy 128-dim embeddings |

## Models

On first run the **InsightFace buffalo_l** model pack is downloaded automatically (~300 MB). It includes:

- **RetinaFace** — face detection & alignment
- **ArcFace** — 512-dim face embedding / recognition

No separate YOLO model is required.

## Anti-Spoofing

The service supports optional face anti-spoofing to detect printed photos and screen replays.

1. Download a MiniFASNet ONNX model and place it at `models/minifasnet_v2.onnx` (or set `ANTISPOOF_MODEL_PATH`).
2. Set `ANTISPOOF_ENABLED=true` in your `.env` file (enabled by default).
3. The `/recognize` endpoint will automatically check liveness before matching.

If the model file is not found, anti-spoofing is gracefully disabled and recognition continues normally.

## Accuracy Improvements

This service includes several accuracy enhancements:

- **Centroid averaging** — multiple embeddings per person are averaged into a single centroid for more stable matching.
- **L2 normalization** — all embeddings are L2-normalized at extraction and load time for reliable cosine similarity.
- **Detection quality filtering** — faces below the `MIN_FACE_DET_SCORE` confidence threshold are rejected.
- **Embedding cache** — in-memory TTL cache reduces database queries during recognition (60s TTL).
- **Anti-spoofing** — optional liveness detection rejects printed photos and screen replays.

## Migration from Legacy Embeddings

Personnel registered with the old 128-dim model can be identified via:

```bash
curl -X POST http://localhost:5001/migrate-embeddings
```

This returns a list of personnel IDs that need to be re-registered with new face photos using the `/register` endpoint to generate 512-dim embeddings.

## Environment Variables

See `.env.example` for all available options.
