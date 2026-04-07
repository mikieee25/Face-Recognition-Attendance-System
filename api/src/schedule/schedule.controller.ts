import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from "@nestjs/common";
import { ScheduleService } from "./schedule.service";
import { UpdateScheduleDto } from "./dto/update-schedule.dto";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("Schedule")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("api/v1/schedule")
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get()
  @ApiOperation({ summary: "Get all schedules" })
  getAllSchedules(@Query("date") date?: string) {
    return this.scheduleService.getAllSchedules(date);
  }

  @Get("personnel/:personnelId")
  @ApiOperation({
    summary: "Get schedule for a personnel for a specific month and year",
  })
  getPersonnelSchedule(
    @Param("personnelId", ParseIntPipe) personnelId: number,
    @Query("year", ParseIntPipe) year: number,
    @Query("month", ParseIntPipe) month: number
  ) {
    return this.scheduleService.getPersonnelSchedule(personnelId, year, month);
  }

  @Post("personnel/:personnelId")
  @ApiOperation({ summary: "Update schedule for a personnel" })
  updateSchedule(
    @Param("personnelId", ParseIntPipe) personnelId: number,
    @Body() dto: UpdateScheduleDto
  ) {
    return this.scheduleService.updateSchedule(personnelId, dto);
  }
}
