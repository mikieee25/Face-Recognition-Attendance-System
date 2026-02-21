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
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

@ApiTags("Users")
@ApiBearerAuth()
@Controller("api/v1/users")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /api/v1/users — List all users (Requirement 11.1, 11.2)
   */
  @Get()
  @ApiOperation({ summary: "List all users (Admin only)" })
  async findAll() {
    const users = await this.usersService.findAll();
    return { users };
  }

  /**
   * POST /api/v1/users — Create a user (Requirement 11.1, 11.2, 11.3)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new user (Admin only)" })
  async create(@Body() dto: CreateUserDto) {
    const user = await this.usersService.create(dto);
    return { user };
  }

  /**
   * PATCH /api/v1/users/:id — Update a user (Requirement 11.1, 11.2)
   */
  @Patch(":id")
  @ApiOperation({ summary: "Update a user (Admin only)" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ) {
    const user = await this.usersService.update(id, dto);
    return { user };
  }

  /**
   * DELETE /api/v1/users/:id — Delete a user (Requirement 11.1, 11.2, 11.12)
   */
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a user (Admin only)" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    await this.usersService.remove(id);
  }
}
