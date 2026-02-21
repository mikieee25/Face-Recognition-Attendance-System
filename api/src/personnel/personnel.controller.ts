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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PersonnelService } from "./personnel.service";
import { CreatePersonnelDto } from "./dto/create-personnel.dto";
import { UpdatePersonnelDto } from "./dto/update-personnel.dto";
import { RegisterFaceDto } from "./dto/register-face.dto";

@ApiTags("Personnel")
@ApiBearerAuth()
@Controller("api/v1/personnel")
@UseGuards(JwtAuthGuard)
export class PersonnelController {
  constructor(private readonly personnelService: PersonnelService) {}

  /**
   * GET /api/v1/personnel
   * Admin: all personnel. station_user: station-filtered. (Requirements 3.1, 3.5)
   */
  @Get()
  @ApiOperation({ summary: "List personnel (filtered by role)" })
  async findAll(@Request() req: any) {
    const personnel = await this.personnelService.findAll(req.user);
    return { personnel };
  }

  /**
   * GET /api/v1/personnel/:id
   */
  @Get(":id")
  @ApiOperation({ summary: "Get a single personnel record" })
  async findOne(@Param("id", ParseIntPipe) id: number, @Request() req: any) {
    const personnel = await this.personnelService.findOne(id, req.user);
    return { personnel };
  }

  /**
   * POST /api/v1/personnel
   * Requires first_name, last_name, rank, station_id. (Requirements 3.2, 3.3, 3.4)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create personnel" })
  async create(@Body() dto: CreatePersonnelDto, @Request() req: any) {
    const personnel = await this.personnelService.create(dto, req.user);
    return { personnel };
  }

  /**
   * PATCH /api/v1/personnel/:id
   */
  @Patch(":id")
  @ApiOperation({ summary: "Update personnel" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdatePersonnelDto,
    @Request() req: any,
  ) {
    const personnel = await this.personnelService.update(id, dto, req.user);
    return { personnel };
  }

  /**
   * DELETE /api/v1/personnel/:id
   * Requires confirmation (force=true) if face images are registered. (Requirement 3.9)
   */
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      "Delete personnel (pass ?force=true to confirm deletion when face images exist)",
  })
  @ApiQuery({
    name: "force",
    required: false,
    type: Boolean,
    description:
      "Set to true to confirm deletion when face images are registered",
  })
  async remove(
    @Param("id", ParseIntPipe) id: number,
    @Query("force") force: string,
    @Request() req: any,
  ) {
    await this.personnelService.remove(id, req.user, force === "true");
  }

  /**
   * POST /api/v1/personnel/:id/face
   * Register face images for a personnel member.
   * Validates MIME type and size before forwarding to FaceService.
   * (Requirements 4.4, 4.5, 4.6, 4.7, 4.8, 15.11, 15.12)
   */
  @Post(":id/face")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      "Register face images for a personnel member (min 3, max 10 JPEG/PNG images ≤ 10 MB each)",
  })
  async registerFace(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: RegisterFaceDto,
    @Request() req: any,
  ) {
    await this.personnelService.registerFace(id, dto.images, req.user);
    return { message: "Face registered successfully" };
  }
}
