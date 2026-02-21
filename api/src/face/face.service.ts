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

@Injectable()
export class FaceService {
  private readonly logger = new Logger(FaceService.name);
  private readonly client: AxiosInstance;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>("faceServiceUrl") ??
      "http://localhost:8000";
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30_000,
    });
  }

  async recognize(image: string, stationId: number): Promise<RecognizeResult> {
    return this.withRetry(() =>
      this.client.post<{
        success: boolean;
        personnel_id: number;
        confidence: number;
        message?: string;
      }>("/recognize", {
        image,
        station_id: stationId,
      }),
    ).then((res) => ({
      personnelId: res.data.personnel_id,
      confidence: res.data.confidence,
    }));
  }

  async registerFace(
    personnelId: number,
    images: string[],
  ): Promise<RegisterFaceResult> {
    return this.withRetry(() =>
      this.client.post<{ success: boolean; embeddings: number[][] }>(
        "/register",
        {
          personnel_id: personnelId,
          images,
        },
      ),
    ).then((res) => ({ embeddings: res.data.embeddings }));
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
          }`,
        );
      }
    }
    throw new ServiceUnavailableException(
      "Face recognition service unavailable",
    );
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
