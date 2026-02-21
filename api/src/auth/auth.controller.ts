import { Body, Controller, HttpCode, HttpStatus, Post, Res, Req, Get, UseGuards, ValidationPipe } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { Response, Request } from "express";
import { JwtAuthGuard } from "./jwt-auth.guard";

@ApiTags("Auth")
@Controller("api/v1/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("/register")
  @HttpCode(HttpStatus.CREATED)
  async register(@Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) payload: RegisterDto) {
    // Create a new user (AuthService.createUser will hash the password and return the user without password)
    const user = await this.authService.createUser(payload.username, payload.password, payload.name);
    return { success: true, data: { user } };
  }

  @Post("/login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() payload: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.authService.validateUser(payload.username, payload.password);
    if (!user) {
      return { success: false, message: "Invalid credentials" };
    }

    const result = await this.authService.login(user);

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: Number(process.env.JWT_COOKIE_MAX_AGE) || 1000 * 60 * 60, // default 1 hour
      path: "/",
    };

    // Set httpOnly cookie with the access token
    res.cookie("access_token", result.access_token, cookieOptions);

    // Return a minimal user object (AuthService.validateUser already strips password)
    return { success: true, data: { user: result.user } };
  }

  @UseGuards(JwtAuthGuard)
  @Get("/me")
  async me(@Req() req: Request) {
    // JwtStrategy should attach user to request
    const user = (req as any).user;
    return { success: true, data: { user } };
  }

  @UseGuards(JwtAuthGuard)
  @Post("/logout")
  async logout(@Res({ passthrough: true }) res: Response) {
    // Clear the cookie set during login
    res.clearCookie("access_token", { path: "/" });
    return { success: true, message: "Logged out" };
  }
}
