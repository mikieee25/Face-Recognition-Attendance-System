import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { FaceModule } from "../face/face.module";

@Module({
  imports: [FaceModule],
  controllers: [HealthController],
})
export class HealthModule {}
