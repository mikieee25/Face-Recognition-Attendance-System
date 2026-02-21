import { Injectable, ServiceUnavailableException } from "@nestjs/common";

export interface RegisterFaceResult {
  embeddings: number[][];
}

/**
 * FaceService stub — placeholder until task 9.1 implements the full HTTP client.
 * Currently throws ServiceUnavailableException to signal the face service is not yet wired.
 */
@Injectable()
export class FaceService {
  /**
   * Forward base64 images to the Face Service for embedding generation.
   * Returns an array of embedding vectors (one per image).
   * (Requirements 15.1, 15.2, 15.5)
   */
  async registerFace(
    personnelId: number,
    images: string[],
  ): Promise<RegisterFaceResult> {
    // TODO (task 9.1): implement HTTP POST to FACE_SERVICE_URL/register
    throw new ServiceUnavailableException(
      "Face recognition service unavailable",
    );
  }

  /**
   * Send a single image to the Face Service for recognition.
   * (Requirements 15.3, 15.4)
   */
  async recognize(
    image: string,
    stationId: number,
  ): Promise<{ personnelId: number; confidence: number }> {
    // TODO (task 9.1): implement HTTP POST to FACE_SERVICE_URL/recognize
    throw new ServiceUnavailableException(
      "Face recognition service unavailable",
    );
  }
}
