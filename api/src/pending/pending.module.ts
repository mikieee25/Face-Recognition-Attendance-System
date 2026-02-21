import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PendingApproval } from "../database/entities/pending-attendance.entity";
import { AttendanceRecord } from "../database/entities/attendance.entity";
import { PendingService } from "./pending.service";
import { PendingController } from "./pending.controller";

@Module({
  imports: [TypeOrmModule.forFeature([PendingApproval, AttendanceRecord])],
  controllers: [PendingController],
  providers: [PendingService],
  exports: [PendingService],
})
export class PendingModule {}
