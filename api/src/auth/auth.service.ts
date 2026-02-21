import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  InternalServerErrorException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DeepPartial } from "typeorm";
import { Response } from "express";
import * as bcrypt from "bcrypt";
import { User } from "../database/entities/user.entity";

const SALT_ROUNDS = 12;

export type SafeUser = Omit<User, "password">;

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // ─── Cookie helpers ────────────────────────────────────────────────────────

  private setTokenCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ): void {
    const isProduction = process.env.NODE_ENV === "production";

    const base = {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict" as const,
      path: "/",
    };

    res.cookie("access_token", accessToken, {
      ...base,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("refresh_token", refreshToken, {
      ...base,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  private clearTokenCookies(res: Response): void {
    res.clearCookie("access_token", { path: "/" });
    res.clearCookie("refresh_token", { path: "/" });
  }

  // ─── Token generation ──────────────────────────────────────────────────────

  private generateAccessToken(user: SafeUser): string {
    const payload = { sub: user.id, username: user.username };
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>("jwt.secret"),
      expiresIn: this.configService.get<string>("jwt.accessExpiry") ?? "15m",
    });
  }

  private generateRefreshToken(user: SafeUser): string {
    const payload = { sub: user.id, username: user.username };
    return this.jwtService.sign(payload, {
      secret:
        this.configService.get<string>("jwt.refreshSecret") ??
        "dev-jwt-refresh-secret",
      expiresIn: this.configService.get<string>("jwt.refreshExpiry") ?? "7d",
    });
  }

  private stripPassword(user: User): SafeUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safe } = user as any;
    return safe as SafeUser;
  }

  // ─── Public methods ────────────────────────────────────────────────────────

  /**
   * Validate credentials and set httpOnly cookies.
   * Returns the safe user object (no password).
   */
  async login(
    username: string,
    password: string,
    res: Response,
  ): Promise<SafeUser> {
    const user = await this.userRepo.findOne({ where: { username } });

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (!user.isActive) {
      throw new UnauthorizedException("Account is deactivated");
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const safeUser = this.stripPassword(user);
    const accessToken = this.generateAccessToken(safeUser);
    const refreshToken = this.generateRefreshToken(safeUser);

    this.setTokenCookies(res, accessToken, refreshToken);

    return safeUser;
  }

  /**
   * Clear auth cookies.
   */
  logout(res: Response): void {
    this.clearTokenCookies(res);
  }

  /**
   * Validate refresh token and issue new access + refresh tokens.
   */
  async refreshTokens(refreshToken: string, res: Response): Promise<SafeUser> {
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret:
          this.configService.get<string>("jwt.refreshSecret") ??
          "dev-jwt-refresh-secret",
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("User not found or deactivated");
    }

    const safeUser = this.stripPassword(user);
    const newAccessToken = this.generateAccessToken(safeUser);
    const newRefreshToken = this.generateRefreshToken(safeUser);

    this.setTokenCookies(res, newAccessToken, newRefreshToken);

    return safeUser;
  }

  /**
   * Return the currently authenticated user by ID.
   */
  async getMe(userId: number): Promise<SafeUser> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException("User not found");
    }
    return this.stripPassword(user);
  }

  /**
   * Hash a password with bcrypt (saltRounds=12).
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * Create a new user with hashed password.
   */
  async createUser(
    username: string,
    email: string,
    password: string,
    extra?: Partial<User>,
  ): Promise<SafeUser> {
    const [existing] = await this.userRepo.find({
      where: [{ username }, { email }],
      take: 1,
    });
    if (existing) {
      throw new ConflictException("Username or email already exists");
    }

    try {
      const hash = await this.hashPassword(password);
      const user = this.userRepo.create({
        username,
        email,
        password: hash,
        ...extra,
      } as DeepPartial<User>);
      const saved = await this.userRepo.save(user);
      return this.stripPassword(saved);
    } catch {
      throw new InternalServerErrorException("Failed to create user");
    }
  }
}

