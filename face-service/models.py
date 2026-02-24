"""Pydantic request/response models matching the NestJS API contract."""

from typing import Optional
from pydantic import BaseModel


class RecognizeRequest(BaseModel):
    image: str
    station_id: int


class RecognizeResponse(BaseModel):
    success: bool
    personnel_id: Optional[int] = None
    confidence: float
    message: str


class RegisterRequest(BaseModel):
    personnel_id: int
    images: list[str]


class RegisterResponse(BaseModel):
    success: bool
    embeddings: list[list[float]]


class HealthResponse(BaseModel):
    status: str
    face_detection: str
    face_recognition: str
    anti_spoofing: str = "disabled"
