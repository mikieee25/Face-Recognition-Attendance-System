import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";

export interface RecognizeResult {
  personnelId: number;
  confidence: number;
}

export interface RegisterFaceResult {
  embeddings: number[][];
}

export interface InvalidateCacheResult {
  success: boolean;
  message: string;
}

@Injectable()
export class FaceService {
  private readonly logger = new Logger(FaceService.name);
  private readonly client: AxiosInstance;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>("faceServiceUrl") ??
      "http://localhost:5001";
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 120_000,
    });
  }

  async recognize(image: string, stationId: number): Promise<RecognizeResult> {
    const res = await this.withRetry(() =>
      this.client.post<{
        success: boolean;
        personnel_id: number;
        confidence: number;
        message?: string;
      }>("/recognize", {
        image,
        station_id: stationId,
      })
    );

    if (!res.data.success) {
      throw new Error(res.data.message ?? "Face recognition failed");
    }

    return {
      personnelId: res.data.personnel_id,
      confidence: res.data.confidence,
    };
  }

  async registerFace(
    personnelId: number,
    images: string[]
  ): Promise<RegisterFaceResult> {
    const res = await this.withRetry(() =>
      this.client.post<{ success: boolean; embeddings: number[][] }>(
        "/register",
        {
          personnel_id: personnelId,
          images,
        }
      )
    );

    if (!res.data.success || !res.data.embeddings?.length) {
      throw new Error(
        "Face service could not detect a valid face in the provided images. Please ensure the face is clearly visible and try again."
      );
    }

    return { embeddings: res.data.embeddings };
  }

  /** Retry up to 2 additional times on network errors (3 total attempts). */
  private async withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    let lastError: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err: unknown) {
        lastError = err;
        const isNetworkError = axios.isAxiosError(err) && !err.response;
        if (!isNetworkError) throw err; // non-network errors bubble immediately
        this.logger.warn(
          `Face service attempt ${i + 1} failed, ${
            i + 1 < attempts ? "retrying..." : "giving up."
          }`
        );
      }
    }
    throw new ServiceUnavailableException(
      "Face recognition service unavailable"
    );
  }

  /** Invalidate the in-memory embedding cache for a station or all stations. */
  async invalidateCache(stationId?: number): Promise<InvalidateCacheResult> {
    try {
      const res = await this.client.post<InvalidateCacheResult>(
        "/invalidate-cache",
        { station_id: stationId ?? null }
      );
      return res.data;
    } catch (err: unknown) {
      this.logger.warn(
        "Failed to invalidate face-service cache: %s",
        err instanceof Error ? err.message : String(err)
      );
      // Non-fatal — cache will expire on its own (TTL 60s)
      return { success: false, message: "Cache invalidation skipped" };
    }
  }

  /** Ping the face service — used by health check. */
  async ping(): Promise<boolean> {
    try {
      await this.client.get("/health", { timeout: 5_000 });
      return true;
    } catch {
      return false;
    }
  }
}
