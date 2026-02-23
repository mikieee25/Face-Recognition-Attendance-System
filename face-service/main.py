"""BFP Attendance System — Face Recognition Microservice.

FastAPI application that provides face detection, recognition, and
registration endpoints consumed by the NestJS API.
"""

import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

import config
import database
import face_recognizer
import anti_spoof
from routes.health import router as health_router
from routes.recognize import router as recognize_router
from routes.register import router as register_router
from routes.migrate import router as migrate_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle hook."""
    logger.info("Starting face-service on %s:%s", config.HOST, config.PORT)

    # Load ML models (synchronous but only runs once)
    face_recognizer.load_model()

    # Load anti-spoofing model if enabled
    if config.ANTISPOOF_ENABLED:
        anti_spoof.load_model()

    # Create DB pool
    await database.create_pool()

    yield

    # Shutdown
    await database.close_pool()
    logger.info("face-service stopped")


app = FastAPI(
    title="BFP Face Recognition Service",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow all origins for internal service communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Placeholder auth middleware — logs the shared-secret header but does not
# enforce it yet.  Flip ``ENFORCE_SECRET`` to ``True`` when ready.
ENFORCE_SECRET = False


@app.middleware("http")
async def check_shared_secret(request: Request, call_next):
    secret = request.headers.get("x-face-service-secret")
    if secret:
        logger.debug("Received shared secret header")
    elif ENFORCE_SECRET and request.url.path != "/health":
        from fastapi.responses import JSONResponse

        return JSONResponse(
            status_code=401,
            content={"detail": "Missing shared secret"},
        )
    return await call_next(request)


# Register routers
app.include_router(health_router)
app.include_router(recognize_router)
app.include_router(register_router)
app.include_router(migrate_router)


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=config.HOST,
        port=config.PORT,
        reload=False,
        log_level="info",
    )
