import {
  Controller,
  Get,
  Query,
  Request,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { ReportsService } from "./reports.service";
import { QueryReportsDto } from "./dto/query-reports.dto";
import { QueryCalendarDto } from "./dto/query-calendar.dto";

@ApiTags("Reports")
@ApiBearerAuth()
@Controller("api/v1/reports")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin", "station_user")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * GET /api/v1/reports
   * Filtered report with pagination, scoped by role.
   * Requirements: 9.2, 9.3, 9.10, 9.11
   */
  @Get()
  @ApiOperation({ summary: "Get filtered attendance report (paginated)" })
  async getReports(@Query() query: QueryReportsDto, @Request() req: any) {
    return this.reportsService.getReports(query, req.user);
  }

  /**
   * GET /api/v1/reports/monthly
   * Monthly summary: days present, absent, late, hours worked.
   * Requirements: 9.8, 9.9
   */
  @Get("monthly")
  @ApiOperation({ summary: "Get monthly attendance summary per personnel" })
  async getMonthlySummary(
    @Query() query: QueryReportsDto,
    @Request() req: any
  ) {
    return this.reportsService.getMonthlySummary(query, req.user);
  }

  /**
   * GET /api/v1/reports/export
   * Generate and stream Excel/CSV file.
   * Requirements: 9.6, 9.7
   */
  @Get("export")
  @ApiOperation({ summary: "Export attendance report as Excel or CSV" })
  async exportReports(
    @Query() query: QueryReportsDto,
    @Request() req: any,
    @Res() res: Response
  ) {
    await this.reportsService.exportReports(query, req.user, res);
  }

  /**
   * GET /api/v1/reports/calendar
   * Monthly calendar attendance view per personnel.
   */
  @Get("calendar")
  @ApiOperation({ summary: "Get monthly calendar attendance per personnel" })
  async getCalendar(@Query() query: QueryCalendarDto, @Request() req: any) {
    return this.reportsService.getCalendar(query, req.user);
  }

  @Get("calendar-date-summary")
  @ApiOperation({ summary: "Get monthly calendar attendance summary by date" })
  async getCalendarDateSummary(
    @Query() query: QueryCalendarDto,
    @Request() req: any
  ) {
    return this.reportsService.getCalendarDateSummary(query, req.user);
  }
}
