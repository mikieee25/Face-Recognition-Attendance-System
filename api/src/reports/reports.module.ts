import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AttendanceRecord } from "../database/entities/attendance.entity";
import { Personnel } from "../database/entities/personnel.entity";
import { ReportsService } from "./reports.service";
import { ReportsController } from "./reports.controller";

@Module({
  imports: [TypeOrmModule.forFeature([AttendanceRecord, Personnel])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
