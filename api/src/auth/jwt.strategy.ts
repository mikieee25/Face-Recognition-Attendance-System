import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../entities/user.entity";

/**
 * Extract JWT from httpOnly cookie named `access_token`.
 * Falls back to Bearer Authorization header if cookie not present.
 */
const cookieExtractor = (req: any): string | null => {
  if (!req) return null;
  // cookie-parser populates req.cookies
  if (req.cookies && req.cookies["access_token"]) {
    return req.cookies["access_token"];
  }

  // fallback to Authorization header: "Bearer <token>"
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (authHeader && typeof authHeader === "string") {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0] === "Bearer") {
      return parts[1];
    }
  }

  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || "dev-jwt-secret",
    });
  }

  /**
   * Validate is invoked by Passport once the token is decoded.
   * Return the user object (without sensitive fields) to attach to req.user.
   * Returning null/undefined will cause the guard to reject the request.
   */
  async validate(payload: any) {
    if (!payload || !payload.sub) return null;
    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user) return null;
    // strip sensitive fields
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safe } = user as any;
    return safe;
  }
}
