import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * JwtAuthGuard
 * Simple wrapper around Passport's JWT auth strategy so we can use
 * @UseGuards(JwtAuthGuard) in controllers to protect endpoints.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}
