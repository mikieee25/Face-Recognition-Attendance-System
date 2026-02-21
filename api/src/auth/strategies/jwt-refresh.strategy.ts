import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Request } from "express";
import { User } from "../../database/entities/user.entity";
import { SafeUser } from "../auth.service";

/**
 * Extract JWT refresh token from httpOnly cookie `refresh_token`.
 */
const refreshCookieExtractor = (req: Request): string | null => {
  return (req as any)?.cookies?.refresh_token ?? null;
};

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  "jwt-refresh",
) {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: refreshCookieExtractor,
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>("jwt.refreshSecret") ??
        "dev-jwt-refresh-secret",
      passReqToCallback: false,
    });
  }

  async validate(payload: any): Promise<SafeUser> {
    if (!payload?.sub) throw new UnauthorizedException();

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw new UnauthorizedException();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safe } = user as any;
    return safe as SafeUser;
  }
}
