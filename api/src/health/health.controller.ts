import { Controller, Get } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { FaceService } from "../face/face.service";
import { ApiTags, ApiOperation } from "@nestjs/swagger";

@ApiTags("health")
@Controller("api/health")
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly faceService: FaceService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Health check — DB and Face Service status" })
  async check() {
    const [dbOk, faceOk] = await Promise.all([
      this.checkDb(),
      this.faceService.ping(),
    ]);

    return {
      status: dbOk && faceOk ? "ok" : "degraded",
      database: dbOk ? "connected" : "disconnected",
      faceService: faceOk ? "reachable" : "unreachable",
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDb(): Promise<boolean> {
    try {
      await this.dataSource.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }
}
