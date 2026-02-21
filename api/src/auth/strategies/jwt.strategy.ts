import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../../database/entities/user.entity";
import { SafeUser } from "../auth.service";

/**
 * Extract JWT access token from httpOnly cookie `access_token`.
 * Falls back to Bearer Authorization header.
 */
const cookieExtractor = (req: any): string | null => {
  if (req?.cookies?.access_token) {
    return req.cookies.access_token;
  }
  const auth: string | undefined =
    req?.headers?.authorization ?? req?.headers?.Authorization;
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7);
  }
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("jwt.secret") ?? "dev-jwt-secret",
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
