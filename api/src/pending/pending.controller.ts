import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { PendingService } from "./pending.service";

@ApiTags("Pending Approvals")
@ApiBearerAuth()
@Controller("api/v1/pending")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class PendingController {
  constructor(private readonly pendingService: PendingService) {}

  /**
   * GET /api/v1/pending
   * List all pending approval records (Admin only).
   * Requirements: 10.1, 10.2, 10.3
   */
  @Get()
  @ApiOperation({ summary: "List pending approval records (Admin only)" })
  async findAll() {
    return this.pendingService.findAll();
  }

  /**
   * GET /api/v1/pending/count
   * Count of pending approval records (Admin only).
   * Requirements: 10.12
   */
  @Get("count")
  @ApiOperation({ summary: "Count of pending approval records (Admin only)" })
  async count() {
    return this.pendingService.count();
  }

  /**
   * POST /api/v1/pending/:id/approve
   * Convert pending record to confirmed AttendanceRecord (Admin only).
   * Requirements: 10.7, 10.9
   */
  @Post(":id/approve")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Approve a pending record (Admin only)" })
  async approve(@Param("id", ParseIntPipe) id: number, @Request() req: any) {
    return this.pendingService.approve(id, req.user);
  }

  /**
   * POST /api/v1/pending/:id/reject
   * Reject a pending record (Admin only).
   * Requirements: 10.8, 10.9
   */
  @Post(":id/reject")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reject a pending record (Admin only)" })
  async reject(@Param("id", ParseIntPipe) id: number, @Request() req: any) {
    return this.pendingService.reject(id, req.user);
  }
}
