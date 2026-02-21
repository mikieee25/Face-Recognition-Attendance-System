import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";

const KIOSK_ALLOWED = [
  { method: "POST", path: "/api/v1/attendance/capture" },
  { method: "POST", path: "/api/v1/attendance/manual" },
] as const;

/**
 * KioskGuard — enforces access restrictions for users with role `kiosk`.
 *
 * Kiosk users may only access:
 *   POST /api/v1/attendance/capture
 *   POST /api/v1/attendance/manual
 *
 * All other endpoints return HTTP 403.
 * Non-kiosk users pass through unconditionally.
 *
 * Requirements: 13.3, 13.4, 13.5, 13.6, 13.7, 13.9
 */
@Injectable()
export class KioskGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // No user yet (unauthenticated) — let other guards handle it
    if (!user) return true;

    // Non-kiosk users pass through
    if (user.role !== "kiosk") return true;

    const { method, path } = request as { method: string; path: string };

    const isAllowed = KIOSK_ALLOWED.some(
      (allowed) => allowed.method === method && path.startsWith(allowed.path),
    );

    if (!isAllowed) {
      throw new ForbiddenException("Access denied");
    }

    return true;
  }
}
