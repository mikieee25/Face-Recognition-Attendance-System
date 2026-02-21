import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { AttendanceService } from "./attendance.service";
import { CaptureAttendanceDto } from "./dto/capture-attendance.dto";
import { ManualAttendanceDto } from "./dto/manual-attendance.dto";
import { UpdateAttendanceDto } from "./dto/update-attendance.dto";
import { QueryAttendanceDto } from "./dto/query-attendance.dto";

@ApiTags("Attendance")
@ApiBearerAuth()
@Controller("api/v1/attendance")
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  /**
   * POST /api/v1/attendance/capture
   * Validate image, call FaceService.recognize(), route by confidence threshold.
   * Rate-limited: 10 requests per minute per user (Requirement 5.11, 16.4)
   * Requirements: 5.1, 5.2, 5.3, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.14
   */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("capture")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      "Capture attendance via face recognition (JPEG/PNG base64, max 10 MB)",
  })
  async capture(@Body() dto: CaptureAttendanceDto, @Request() req: any) {
    const record = await this.attendanceService.capture(dto, req.user);
    return { record };
  }

  /**
   * POST /api/v1/attendance/manual
   * Manual attendance entry — is_manual=true, created_by=user.id.
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9
   */
  @Post("manual")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a manual attendance entry" })
  async createManual(@Body() dto: ManualAttendanceDto, @Request() req: any) {
    const record = await this.attendanceService.createManual(dto, req.user);
    return { record };
  }

  /**
   * GET /api/v1/attendance
   * Paginated, filterable by date range/personnel/station/type; filtered by role.
   * Requirements: 7.1, 7.2, 7.3
   */
  @Get()
  @ApiOperation({ summary: "List attendance records (paginated, filtered)" })
  async findAll(@Query() query: QueryAttendanceDto, @Request() req: any) {
    return this.attendanceService.findAll(query, req.user);
  }

  /**
   * GET /api/v1/attendance/:id
   */
  @Get(":id")
  @ApiOperation({ summary: "Get a single attendance record" })
  async findOne(@Param("id", ParseIntPipe) id: number, @Request() req: any) {
    const record = await this.attendanceService.findOne(id, req.user);
    return { record };
  }

  /**
   * PATCH /api/v1/attendance/:id
   * Record modified_at and modified_by. (Requirements 7.7, 7.8, 7.9)
   */
  @Patch(":id")
  @ApiOperation({ summary: "Update an attendance record" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateAttendanceDto,
    @Request() req: any,
  ) {
    const record = await this.attendanceService.update(id, dto, req.user);
    return { record };
  }

  /**
   * DELETE /api/v1/attendance/:id
   * Admin only. (Requirement 7.10)
   */
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles("admin")
  @ApiOperation({ summary: "Delete an attendance record (Admin only)" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    await this.attendanceService.remove(id);
  }
}
