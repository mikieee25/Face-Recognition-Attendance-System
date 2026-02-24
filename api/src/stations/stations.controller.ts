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
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { StationsService } from "./stations.service";
import { CreateStationDto } from "./dto/create-station.dto";
import { UpdateStationDto } from "./dto/update-station.dto";

@ApiTags("Stations")
@ApiBearerAuth()
@Controller("api/v1/stations")
@UseGuards(JwtAuthGuard)
export class StationsController {
  constructor(private readonly stationsService: StationsService) {}

  /**
   * GET /api/v1/stations — All authenticated users can list stations (Requirement 12.1).
   */
  @Get()
  @ApiOperation({ summary: "List all stations (all authenticated users)" })
  async findAll() {
    return this.stationsService.findAll();
  }

  /**
   * POST /api/v1/stations — Admin only (Requirements 12.2, 12.3).
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles("admin")
  @ApiOperation({ summary: "Create a station (Admin only)" })
  async create(@Body() dto: CreateStationDto) {
    return this.stationsService.create(dto);
  }

  /**
   * PATCH /api/v1/stations/:id — Admin only (Requirement 12.2).
   */
  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles("admin")
  @ApiOperation({ summary: "Update a station (Admin only)" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateStationDto,
  ) {
    return this.stationsService.update(id, dto);
  }

  /**
   * DELETE /api/v1/stations/:id — Admin only (Requirement 12.2).
   */
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles("admin")
  @ApiOperation({ summary: "Delete a station (Admin only)" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    await this.stationsService.remove(id);
  }
}
