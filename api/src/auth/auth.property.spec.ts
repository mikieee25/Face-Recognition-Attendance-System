// Feature: bfp-attendance-system-migration, Property 1: Token Expiry Invariant
// Validates: Requirements 2.2

import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require("supertest") as typeof import("supertest");
import * as fc from "fast-check";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require("cookie-parser");
import { getRepositoryToken } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { JwtRefreshStrategy } from "./strategies/jwt-refresh.strategy";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { JwtRefreshGuard } from "./guards/jwt-refresh.guard";
import { User } from "../database/entities/user.entity";
import { ResponseInterceptor } from "../common/interceptors/response.interceptor";
import {
  HttpExceptionFilter,
  AllExceptionsFilter,
} from "../common/filters/http-exception.filter";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { CanActivate } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";

// No-op throttler guard for tests — bypasses rate limiting
class NoopThrottlerGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}

// ─── JWT decode helper (no signature verification) ────────────────────────────

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  const payload = Buffer.from(parts[1], "base64url").toString("utf8");
  return JSON.parse(payload);
}

// ─── Test credentials ─────────────────────────────────────────────────────────

const TEST_USERS = [
  { username: "test_admin", password: "AdminPass1!" },
  { username: "test_station", password: "StationPass1!" },
  { username: "test_kiosk", password: "KioskPass1!" },
];

// ─── Tolerance constants ──────────────────────────────────────────────────────

const TOLERANCE_SECONDS = 10; // ±10s tolerance for timing
const FIFTEEN_MINUTES_SECONDS = 15 * 60;
const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

describe("Auth Property Tests", () => {
  let app: INestApplication;
  let mockUserRepo: Record<string, jest.Mock>;

  beforeAll(async () => {
    // Pre-hash passwords for test users
    const hashedUsers = await Promise.all(
      TEST_USERS.map(async (u) => ({
        id: TEST_USERS.indexOf(u) + 1,
        username: u.username,
        email: `${u.username}@test.com`,
        passwordHash: await bcrypt.hash(u.password, 10),
        role: "station_user" as const,
        stationId: 1,
        isActive: true,
        createdAt: new Date(),
        profilePicture: null,
        mustChangePassword: false,
      })),
    );

    // Mock repository that returns test users by username or id
    mockUserRepo = {
      findOne: jest.fn(({ where }) => {
        if (where?.username) {
          return Promise.resolve(
            hashedUsers.find((u) => u.username === where.username) ?? null,
          );
        }
        if (where?.id) {
          return Promise.resolve(
            hashedUsers.find((u) => u.id === where.id) ?? null,
          );
        }
        return Promise.resolve(null);
      }),
      find: jest.fn(() => Promise.resolve([])),
      create: jest.fn(),
      save: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              jwt: {
                secret: "test-jwt-secret",
                refreshSecret: "test-jwt-refresh-secret",
                accessExpiry: "15m",
                refreshExpiry: "7d",
              },
            }),
          ],
        }),
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 1000 }]),
        PassportModule.register({ defaultStrategy: "jwt" }),
        JwtModule.registerAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => ({
            secret:
              configService.get<string>("jwt.secret") ?? "test-jwt-secret",
            signOptions: {
              expiresIn: configService.get<string>("jwt.accessExpiry") ?? "15m",
            },
          }),
        }),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtStrategy,
        JwtRefreshStrategy,
        JwtAuthGuard,
        JwtRefreshGuard,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
        {
          provide: APP_GUARD,
          useClass: NoopThrottlerGuard,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Property 2: Invalid Credentials Always Rejected ────────────────────────
  // **Validates: Requirements 2.3**
  // Feature: bfp-attendance-system-migration, Property 2: Invalid credentials always 401
  // For any combination of username/password that doesn't match stored hashes
  // (including non-existent usernames), the login endpoint must always return 401.

  it("Property 2: Invalid Credentials Always Rejected — arbitrary credentials return 401", async () => {
    // Use fc.string({ minLength: 1 }) to avoid empty strings that trigger DTO
    // validation (HTTP 400) before credential checking (HTTP 401).
    // The `invalid_` prefix ensures no collision with seeded test users.
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        async (username, password) => {
          const res = await request(app.getHttpServer())
            .post("/api/v1/auth/login")
            .send({ username: `invalid_${username}`, password });
          expect(res.status).toBe(401);
        },
      ),
      { numRuns: 100 },
    );
  }, 60000);

  // ─── Property 1: Token Expiry Invariant ─────────────────────────────────────
  // **Validates: Requirements 2.2**
  // Feature: bfp-attendance-system-migration, Property 1: Token Expiry Invariant
  // For any valid credentials, decode returned tokens and assert:
  //   access expiry  = now + 15 minutes (±tolerance)
  //   refresh expiry = now + 7 days     (±tolerance)

  it("Property 1: Token Expiry Invariant — access token expires in 15min, refresh in 7d", async () => {
    // Arbitrarily pick from the set of valid test users
    const validUserArb = fc.constantFrom(...TEST_USERS);

    await fc.assert(
      fc.asyncProperty(validUserArb, async ({ username, password }) => {
        const nowSeconds = Math.floor(Date.now() / 1000);

        const res = await request(app.getHttpServer())
          .post("/api/v1/auth/login")
          .send({ username, password });

        // Login must succeed
        expect(res.status).toBe(200);

        // Extract Set-Cookie headers
        const rawCookies = res.headers["set-cookie"];
        const setCookieHeader: string[] = Array.isArray(rawCookies)
          ? rawCookies
          : rawCookies
          ? [rawCookies]
          : [];
        expect(setCookieHeader.length).toBeGreaterThanOrEqual(2);

        // Parse access_token and refresh_token from cookies
        let accessTokenRaw: string | undefined;
        let refreshTokenRaw: string | undefined;

        for (const cookie of setCookieHeader) {
          const [nameValue] = cookie.split(";");
          const [name, value] = nameValue.split("=");
          if (name.trim() === "access_token") accessTokenRaw = value.trim();
          if (name.trim() === "refresh_token") refreshTokenRaw = value.trim();
        }

        expect(accessTokenRaw).toBeDefined();
        expect(refreshTokenRaw).toBeDefined();

        // Decode payloads (no signature verification — just inspect claims)
        const accessPayload = decodeJwtPayload(accessTokenRaw!);
        const refreshPayload = decodeJwtPayload(refreshTokenRaw!);

        const accessExp = accessPayload["exp"] as number;
        const refreshExp = refreshPayload["exp"] as number;

        expect(typeof accessExp).toBe("number");
        expect(typeof refreshExp).toBe("number");

        // Access token: exp should be approximately now + 15 minutes
        const expectedAccessExp = nowSeconds + FIFTEEN_MINUTES_SECONDS;
        expect(accessExp).toBeGreaterThanOrEqual(
          expectedAccessExp - TOLERANCE_SECONDS,
        );
        expect(accessExp).toBeLessThanOrEqual(
          expectedAccessExp + TOLERANCE_SECONDS,
        );

        // Refresh token: exp should be approximately now + 7 days
        const expectedRefreshExp = nowSeconds + SEVEN_DAYS_SECONDS;
        expect(refreshExp).toBeGreaterThanOrEqual(
          expectedRefreshExp - TOLERANCE_SECONDS,
        );
        expect(refreshExp).toBeLessThanOrEqual(
          expectedRefreshExp + TOLERANCE_SECONDS,
        );
      }),
      { numRuns: 100 },
    );
  }, 60000);
});

// ─── Property 18: Auth Rate Limiting ─────────────────────────────────────────
// Feature: bfp-attendance-system-migration, Property 18: Auth Rate Limiting
// **Validates: Requirements 16.3**
// For any IP address that submits more than 5 authentication requests within a
// 60-second window, the 6th and subsequent requests should return HTTP 429.

describe("Auth Property 18: Rate Limiting", () => {
  let rateLimitApp: NestExpressApplication;
  let rateLimitMockUserRepo: Record<string, jest.Mock>;

  beforeAll(async () => {
    // Pre-hash passwords for test users (same set as above)
    const hashedUsers = await Promise.all(
      TEST_USERS.map(async (u) => ({
        id: TEST_USERS.indexOf(u) + 1,
        username: u.username,
        email: `${u.username}@test.com`,
        passwordHash: await bcrypt.hash(u.password, 10),
        role: "station_user" as const,
        stationId: 1,
        isActive: true,
        createdAt: new Date(),
        profilePicture: null,
        mustChangePassword: false,
      })),
    );

    rateLimitMockUserRepo = {
      findOne: jest.fn(({ where }) => {
        if (where?.username) {
          return Promise.resolve(
            hashedUsers.find((u) => u.username === where.username) ?? null,
          );
        }
        if (where?.id) {
          return Promise.resolve(
            hashedUsers.find((u) => u.id === where.id) ?? null,
          );
        }
        return Promise.resolve(null);
      }),
      find: jest.fn(() => Promise.resolve([])),
      create: jest.fn(),
      save: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              jwt: {
                secret: "test-jwt-secret-rl",
                refreshSecret: "test-jwt-refresh-secret-rl",
                accessExpiry: "15m",
                refreshExpiry: "7d",
              },
            }),
          ],
        }),
        // Real throttler with limit=5 per 60s — matches production config
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 5 }]),
        PassportModule.register({ defaultStrategy: "jwt" }),
        JwtModule.registerAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => ({
            secret:
              configService.get<string>("jwt.secret") ?? "test-jwt-secret-rl",
            signOptions: {
              expiresIn: configService.get<string>("jwt.accessExpiry") ?? "15m",
            },
          }),
        }),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtStrategy,
        JwtRefreshStrategy,
        JwtAuthGuard,
        JwtRefreshGuard,
        {
          provide: getRepositoryToken(User),
          useValue: rateLimitMockUserRepo,
        },
        // Use the real ThrottlerGuard so rate limiting is enforced
        {
          provide: APP_GUARD,
          useClass: ThrottlerGuard,
        },
      ],
    }).compile();

    rateLimitApp = moduleRef.createNestApplication<NestExpressApplication>();
    // Enable trust proxy so Express uses X-Forwarded-For as req.ip,
    // allowing each test iteration to simulate a distinct IP address.
    rateLimitApp.set("trust proxy", true);
    rateLimitApp.use(cookieParser());
    rateLimitApp.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    rateLimitApp.useGlobalInterceptors(new ResponseInterceptor());
    rateLimitApp.useGlobalFilters(
      new AllExceptionsFilter(),
      new HttpExceptionFilter(),
    );
    await rateLimitApp.init();
  }, 30000);

  afterAll(async () => {
    await rateLimitApp.close();
  });

  // Property 18: Auth Rate Limiting
  // For any IP address, after 5 login attempts within the 60s window,
  // the 6th request must return HTTP 429.
  it("Property 18: Auth Rate Limiting — 6th request from same IP returns 429", async () => {
    // Generate unique IPv4 addresses per iteration so each run starts with
    // a fresh throttle counter (no state bleed between iterations).
    await fc.assert(
      fc.asyncProperty(
        // Generate a unique IP for each iteration using a counter-based
        // approach: combine random octets to form a valid-looking IP.
        fc.tuple(
          fc.integer({ min: 1, max: 254 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 1, max: 254 }),
        ),
        async ([a, b, c, d]) => {
          const ip = `${a}.${b}.${c}.${d}`;

          // Send 5 requests — all should be processed (200 or 401, not 429)
          for (let i = 0; i < 5; i++) {
            const res = await request(rateLimitApp.getHttpServer())
              .post("/api/v1/auth/login")
              .set("X-Forwarded-For", ip)
              .send({ username: "nonexistent_user", password: "anypassword" });
            // Each of the first 5 requests must NOT be rate-limited
            expect(res.status).not.toBe(429);
          }

          // 6th request from the same IP must be rate-limited
          const sixthRes = await request(rateLimitApp.getHttpServer())
            .post("/api/v1/auth/login")
            .set("X-Forwarded-For", ip)
            .send({ username: "nonexistent_user", password: "anypassword" });
          expect(sixthRes.status).toBe(429);
        },
      ),
      { numRuns: 100 },
    );
  }, 120000);
});
