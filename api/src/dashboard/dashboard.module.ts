import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AttendanceRecord } from "../database/entities/attendance.entity";
import { Personnel } from "../database/entities/personnel.entity";
import { DashboardService } from "./dashboard.service";
import { DashboardController } from "./dashboard.controller";

@Module({
  imports: [TypeOrmModule.forFeature([AttendanceRecord, Personnel])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
