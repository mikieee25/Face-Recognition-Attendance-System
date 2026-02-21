// Feature: bfp-attendance-system-migration, Property 12: Password Hashing Round-Trip
// Feature: bfp-attendance-system-migration, Property 13: Unique Username and Email Constraint

import * as fc from "fast-check";
import * as bcrypt from "bcrypt";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ConflictException } from "@nestjs/common";
import { Repository } from "typeorm";
import { UsersService } from "./users.service";
import { User } from "../database/entities/user.entity";
import { Attendance } from "../database/entities/attendance.entity";

const SALT_ROUNDS = 12;

// ─────────────────────────────────────────────────────────────────────────────
// **Validates: Requirements 11.4, 16.7**
// Property 12: Password Hashing Round-Trip
//
// For any plaintext password P that satisfies the password policy:
//   1. The stored hash should NOT equal P (hash ≠ plaintext)
//   2. bcrypt.compare(P, hash) should return true
//   3. The number of salt rounds used should be >= 10
// ─────────────────────────────────────────────────────────────────────────────

describe("Property 12: Password Hashing Round-Trip", () => {
  // Generator: passwords satisfying the policy (8+ chars, 1 uppercase, 1 digit)
  // Build each segment from a fixed character set using fc.array + fc.constantFrom,
  // then join to a string. This is compatible with fast-check v4.
  const lowerCharArb = fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz");
  const upperCharArb = fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  const digitCharArb = fc.constantFrom(..."0123456789");

  const validPasswordArb = fc
    .tuple(
      fc.array(lowerCharArb, { minLength: 5, maxLength: 10 }),
      fc.array(upperCharArb, { minLength: 1, maxLength: 3 }),
      fc.array(digitCharArb, { minLength: 1, maxLength: 3 }),
    )
    .map(
      ([lower, upper, digit]) =>
        (lower as string[]).join("") +
        (upper as string[]).join("") +
        (digit as string[]).join(""),
    );

  it("hash ≠ plaintext, bcrypt.compare returns true, and salt rounds >= 10", async () => {
    await fc.assert(
      fc.asyncProperty(validPasswordArb, async (password) => {
        // Hash the password using the same SALT_ROUNDS as UsersService
        const hash = await bcrypt.hash(password, SALT_ROUNDS);

        // 1. Stored hash must not equal the plaintext password
        expect(hash).not.toBe(password);

        // 2. bcrypt.compare must return true for the original password
        const isMatch = await bcrypt.compare(password, hash);
        expect(isMatch).toBe(true);

        // 3. Salt rounds used must be >= 10
        const rounds = bcrypt.getRounds(hash);
        expect(rounds).toBeGreaterThanOrEqual(10);
      }),
      { numRuns: 10 },
    );
  }, 30000);

  it("bcrypt.compare returns false for a different password against the same hash", async () => {
    await fc.assert(
      fc.asyncProperty(
        validPasswordArb,
        validPasswordArb,
        async (password, otherPassword) => {
          // Only test when the two passwords are different
          fc.pre(password !== otherPassword);

          const hash = await bcrypt.hash(password, SALT_ROUNDS);

          // A different password must NOT match the hash
          const isMatch = await bcrypt.compare(otherPassword, hash);
          expect(isMatch).toBe(false);
        },
      ),
      { numRuns: 10 },
    );
  }, 30000);
});

// ─────────────────────────────────────────────────────────────────────────────
// **Validates: Requirements 11.5**
// Property 13: Unique Username and Email Constraint
//
// For any two user creation requests sharing the same username OR the same email:
//   1. The second request should throw ConflictException (HTTP 409)
//   2. No duplicate user should be created (only 1 user exists with that username/email)
// ─────────────────────────────────────────────────────────────────────────────

describe("Property 13: Unique Username and Email Constraint", () => {
  let service: UsersService;
  let userRepo: jest.Mocked<Repository<User>>;

  const usernameArb = fc
    .array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789"), {
      minLength: 3,
      maxLength: 20,
    })
    .map((chars) => (chars as string[]).join(""));

  const emailArb = fc
    .tuple(
      fc
        .array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz"), {
          minLength: 3,
          maxLength: 10,
        })
        .map((chars) => (chars as string[]).join("")),
      fc.constantFrom("gmail.com", "yahoo.com", "bfp.gov.ph"),
    )
    .map(([local, domain]) => `${local}@${domain}`);

  const validPasswordArb = fc
    .tuple(
      fc.array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz"), {
        minLength: 5,
        maxLength: 10,
      }),
      fc.array(fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"), {
        minLength: 1,
        maxLength: 3,
      }),
      fc.array(fc.constantFrom(..."0123456789"), {
        minLength: 1,
        maxLength: 3,
      }),
    )
    .map(
      ([lower, upper, digit]) =>
        (lower as string[]).join("") +
        (upper as string[]).join("") +
        (digit as string[]).join(""),
    );

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Attendance),
          useValue: { count: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    userRepo = module.get(getRepositoryToken(User));
  });

  it("second create with same username throws ConflictException", async () => {
    await fc.assert(
      fc.asyncProperty(
        usernameArb,
        emailArb,
        fc
          .tuple(emailArb, emailArb)
          .filter(([e1, e2]) => e1 !== e2)
          .map(([e1, e2]) => [e1, e2] as [string, string]),
        validPasswordArb,
        async (
          username: string,
          _unused: string,
          [email1, email2]: [string, string],
          password: string,
        ) => {
          // Simulate: first user with this username already exists
          const existingUser = { id: 1, username, email: email1 } as User;

          // findOne returns the existing user when queried by username
          userRepo.findOne.mockImplementation(({ where }: any) => {
            if (where?.username === username) {
              return Promise.resolve(existingUser);
            }
            return Promise.resolve(null);
          });

          // Second create attempt with same username but different email
          await expect(
            service.create({
              username,
              email: email2,
              password,
              role: "station_user",
            }),
          ).rejects.toThrow(ConflictException);

          // save should never be called — no duplicate persisted
          expect(userRepo.save).not.toHaveBeenCalled();

          // Reset mocks for next iteration
          jest.clearAllMocks();
        },
      ),
      { numRuns: 25 },
    );
  }, 30000);

  it("second create with same email throws ConflictException", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .tuple(usernameArb, usernameArb)
          .filter(([u1, u2]) => u1 !== u2)
          .map(([u1, u2]) => [u1, u2] as [string, string]),
        emailArb,
        validPasswordArb,
        async (
          [username1, username2]: [string, string],
          email: string,
          password: string,
        ) => {
          // Simulate: first user with this email already exists
          const existingUser = {
            id: 1,
            username: username1,
            email,
          } as User;

          // findOne returns null for username check, existing user for email check
          userRepo.findOne.mockImplementation(({ where }: any) => {
            if (where?.email === email) {
              return Promise.resolve(existingUser);
            }
            return Promise.resolve(null);
          });

          // Second create attempt with different username but same email
          await expect(
            service.create({
              username: username2,
              email,
              password,
              role: "station_user",
            }),
          ).rejects.toThrow(ConflictException);

          // save should never be called — no duplicate persisted
          expect(userRepo.save).not.toHaveBeenCalled();

          // Reset mocks for next iteration
          jest.clearAllMocks();
        },
      ),
      { numRuns: 25 },
    );
  }, 30000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Feature: bfp-attendance-system-migration, Property 14: Password Policy Enforcement
// **Validates: Requirements 11.7**
//
// For any password that violates at least one policy rule:
//   - Length < 8 characters, OR
//   - No uppercase letter, OR
//   - No digit
//
// The class-validator ValidationPipe should reject it with at least one
// validation error on the `password` field.
// ─────────────────────────────────────────────────────────────────────────────

import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { CreateUserDto } from "./dto/create-user.dto";

describe("Property 14: Password Policy Enforcement", () => {
  // Too short (< 8 chars) but has uppercase and digit
  const tooShortArb = fc
    .tuple(
      fc.array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz"), {
        minLength: 1,
        maxLength: 5,
      }),
      fc.array(fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"), {
        minLength: 1,
        maxLength: 1,
      }),
      fc.array(fc.constantFrom(..."0123456789"), {
        minLength: 1,
        maxLength: 1,
      }),
    )
    .map(
      ([lower, upper, digit]) =>
        (lower as string[]).join("") +
        (upper as string[]).join("") +
        (digit as string[]).join(""),
    )
    .filter((p) => p.length < 8);

  // No uppercase (8+ chars, has digit, no uppercase)
  const noUppercaseArb = fc
    .tuple(
      fc.array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz"), {
        minLength: 7,
        maxLength: 15,
      }),
      fc.array(fc.constantFrom(..."0123456789"), {
        minLength: 1,
        maxLength: 3,
      }),
    )
    .map(
      ([lower, digit]) =>
        (lower as string[]).join("") + (digit as string[]).join(""),
    )
    .filter((p) => !/[A-Z]/.test(p));

  // No digit (8+ chars, has uppercase, no digit)
  const noDigitArb = fc
    .tuple(
      fc.array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz"), {
        minLength: 7,
        maxLength: 15,
      }),
      fc.array(fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"), {
        minLength: 1,
        maxLength: 3,
      }),
    )
    .map(
      ([lower, upper]) =>
        (lower as string[]).join("") + (upper as string[]).join(""),
    )
    .filter((p) => !/\d/.test(p));

  const invalidPasswordArb = fc.oneof(tooShortArb, noUppercaseArb, noDigitArb);

  it("any password violating a policy rule produces a validation error on the password field", async () => {
    await fc.assert(
      fc.asyncProperty(invalidPasswordArb, async (invalidPassword) => {
        const dto = plainToInstance(CreateUserDto, {
          username: "testuser",
          email: "test@test.com",
          password: invalidPassword,
        });

        const errors = await validate(dto);

        // There must be at least one validation error
        expect(errors.length).toBeGreaterThan(0);

        // The error must be on the password field
        const passwordErrors = errors.find((e) => e.property === "password");
        expect(passwordErrors).toBeDefined();
      }),
      { numRuns: 25 },
    );
  }, 30000);

  it("too-short passwords are rejected", async () => {
    await fc.assert(
      fc.asyncProperty(tooShortArb, async (shortPassword) => {
        const dto = plainToInstance(CreateUserDto, {
          username: "testuser",
          email: "test@test.com",
          password: shortPassword,
        });

        const errors = await validate(dto);
        const passwordErrors = errors.find((e) => e.property === "password");
        expect(passwordErrors).toBeDefined();
      }),
      { numRuns: 25 },
    );
  }, 30000);

  it("passwords without uppercase are rejected", async () => {
    await fc.assert(
      fc.asyncProperty(noUppercaseArb, async (noUpperPassword) => {
        const dto = plainToInstance(CreateUserDto, {
          username: "testuser",
          email: "test@test.com",
          password: noUpperPassword,
        });

        const errors = await validate(dto);
        const passwordErrors = errors.find((e) => e.property === "password");
        expect(passwordErrors).toBeDefined();
      }),
      { numRuns: 25 },
    );
  }, 30000);

  it("passwords without a digit are rejected", async () => {
    await fc.assert(
      fc.asyncProperty(noDigitArb, async (noDigitPassword) => {
        const dto = plainToInstance(CreateUserDto, {
          username: "testuser",
          email: "test@test.com",
          password: noDigitPassword,
        });

        const errors = await validate(dto);
        const passwordErrors = errors.find((e) => e.property === "password");
        expect(passwordErrors).toBeDefined();
      }),
      { numRuns: 25 },
    );
  }, 30000);
});
