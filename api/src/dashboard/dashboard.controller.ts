import { Controller, Get, Request, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { DashboardService } from "./dashboard.service";

@ApiTags("Dashboard")
@ApiBearerAuth()
@Controller("api/v1/dashboard")
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * GET /api/v1/dashboard/stats
   * Today's present/absent/late/on-time counts scoped by role.
   * Requirements: 8.2, 8.3, 8.4, 8.5
   */
  @Get("stats")
  @ApiOperation({ summary: "Get today's attendance statistics (role-scoped)" })
  async getStats(@Request() req: any) {
    return this.dashboardService.getStats(req.user);
  }

  /**
   * GET /api/v1/dashboard/recent
   * Last 10 confirmed attendance records scoped by role.
   * Requirement: 8.8
   */
  @Get("recent")
  @ApiOperation({ summary: "Get last 10 attendance records (role-scoped)" })
  async getRecent(@Request() req: any) {
    return this.dashboardService.getRecent(req.user);
  }

  /**
   * GET /api/v1/dashboard/charts
   * Weekly and monthly attendance data scoped by role.
   * Requirement: 8.10
   */
  @Get("charts")
  @ApiOperation({
    summary: "Get weekly and monthly attendance chart data (role-scoped)",
  })
  async getCharts(@Request() req: any) {
    return this.dashboardService.getCharts(req.user);
  }
}
