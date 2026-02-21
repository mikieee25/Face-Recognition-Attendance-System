import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AttendanceRecord } from "../database/entities/attendance.entity";
import { PendingApproval } from "../database/entities/pending-attendance.entity";
import { Personnel } from "../database/entities/personnel.entity";
import { AttendanceService } from "./attendance.service";
import { AttendanceController } from "./attendance.controller";
import { FaceModule } from "../face/face.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([AttendanceRecord, PendingApproval, Personnel]),
    FaceModule,
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
