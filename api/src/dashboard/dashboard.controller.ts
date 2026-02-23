import { Controller, Get, Query, Request, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { DashboardService } from "./dashboard.service";

@ApiTags("Dashboard")
@ApiBearerAuth()
@Controller("api/v1/dashboard")
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("stats")
  @ApiOperation({ summary: "Today's present/absent/shifting/on-leave counts" })
  async getStats(@Request() req: any) {
    return this.dashboardService.getStats(req.user);
  }

  @Get("summary")
  @ApiOperation({ summary: "Daily attendance summary for date range" })
  @ApiQuery({ name: "dateFrom", required: false })
  @ApiQuery({ name: "dateTo", required: false })
  async getSummary(
    @Request() req: any,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
  ) {
    return this.dashboardService.getSummary(req.user, dateFrom, dateTo);
  }

  @Get("personnel-status")
  @ApiOperation({ summary: "Personnel list with status for a given date" })
  @ApiQuery({ name: "date", required: false })
  @ApiQuery({ name: "status", required: false })
  async getPersonnelStatus(
    @Request() req: any,
    @Query("date") date?: string,
    @Query("status") status?: string,
  ) {
    return this.dashboardService.getPersonnelStatus(req.user, date, status);
  }

  @Get("recent")
  @ApiOperation({ summary: "Last 10 attendance records" })
  async getRecent(@Request() req: any) {
    return this.dashboardService.getRecent(req.user);
  }
}
