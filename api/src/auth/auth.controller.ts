import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Get,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { JwtRefreshGuard } from "./guards/jwt-refresh.guard";

@ApiTags("Auth")
@Controller("api/v1/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/v1/auth/login
   * Rate-limited: 5 requests per minute per IP (Requirement 16.3)
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Login with username and password" })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.login(dto.username, dto.password, res);
    return { user };
  }

  /**
   * POST /api/v1/auth/refresh
   * Uses refresh token cookie to issue new access + refresh tokens.
   */
  @UseGuards(JwtRefreshGuard)
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Refresh access token using refresh token cookie" })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = (req as any).cookies?.refresh_token;
    const user = await this.authService.refreshTokens(refreshToken, res);
    return { user };
  }

  /**
   * POST /api/v1/auth/logout
   * Clears both auth cookies.
   */
  @UseGuards(JwtAuthGuard)
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Logout and clear auth cookies" })
  async logout(@Res({ passthrough: true }) res: Response) {
    this.authService.logout(res);
    return { message: "Logged out successfully" };
  }

  /**
   * GET /api/v1/auth/me
   * Returns the currently authenticated user.
   */
  @UseGuards(JwtAuthGuard)
  @Get("me")
  @ApiOperation({ summary: "Get current authenticated user" })
  async getMe(@Req() req: Request) {
    const userId = (req as any).user?.id;
    const user = await this.authService.getMe(userId);
    return { user };
  }
}

