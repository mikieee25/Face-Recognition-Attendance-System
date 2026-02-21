import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { UsersService } from "./users.service";
import { User } from "../database/entities/user.entity";
import { Attendance } from "../database/entities/attendance.entity";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

const mockUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 1,
    username: "testuser",
    email: "test@bfp.gov.ph",
    password: "$2b$12$hashedpassword",
    isAdmin: false,
    isActive: true,
    dateCreated: new Date(),
    stationType: "CENTRAL",
    profilePicture: null,
    mustChangePassword: false,
    isKiosk: false,
    ...overrides,
  } as User);

describe("UsersService", () => {
  let service: UsersService;
  let userRepo: jest.Mocked<Repository<User>>;
  let attendanceRepo: jest.Mocked<Repository<Attendance>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Attendance),
          useValue: {
            count: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepo = module.get(getRepositoryToken(User));
    attendanceRepo = module.get(getRepositoryToken(Attendance));
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("returns all users without passwords", async () => {
      const users = [
        mockUser({ id: 1 }),
        mockUser({ id: 2, username: "admin" }),
      ];
      userRepo.find.mockResolvedValue(users);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      result.forEach((u) => expect((u as any).password).toBeUndefined());
    });
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe("create", () => {
    const dto: CreateUserDto = {
      username: "newuser",
      email: "new@bfp.gov.ph",
      password: "Secret1!",
      role: "station_user",
    };

    it("creates a user with hashed password", async () => {
      userRepo.findOne.mockResolvedValue(null);
      const created = mockUser({ username: dto.username, email: dto.email });
      userRepo.create.mockReturnValue(created);
      userRepo.save.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(userRepo.save).toHaveBeenCalled();
      expect((result as any).password).toBeUndefined();
    });

    it("hashes the password with bcrypt", async () => {
      userRepo.findOne.mockResolvedValue(null);
      const created = mockUser();
      userRepo.create.mockReturnValue(created);
      userRepo.save.mockResolvedValue(created);

      await service.create(dto);

      const createCall = userRepo.create.mock.calls[0][0] as any;
      expect(createCall.password).not.toBe(dto.password);
      const isHashed = await bcrypt.compare(dto.password, createCall.password);
      expect(isHashed).toBe(true);
    });

    it("throws ConflictException if username already exists", async () => {
      userRepo.findOne.mockResolvedValueOnce(
        mockUser({ username: dto.username }),
      );

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it("throws ConflictException if email already exists", async () => {
      userRepo.findOne
        .mockResolvedValueOnce(null) // username check
        .mockResolvedValueOnce(mockUser({ email: dto.email })); // email check

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it("maps role=admin to isAdmin=true", async () => {
      userRepo.findOne.mockResolvedValue(null);
      const created = mockUser({ isAdmin: true });
      userRepo.create.mockReturnValue(created);
      userRepo.save.mockResolvedValue(created);

      await service.create({ ...dto, role: "admin" });

      const createCall = userRepo.create.mock.calls[0][0] as any;
      expect(createCall.isAdmin).toBe(true);
    });

    it("maps role=station_user to isAdmin=false", async () => {
      userRepo.findOne.mockResolvedValue(null);
      const created = mockUser({ isAdmin: false });
      userRepo.create.mockReturnValue(created);
      userRepo.save.mockResolvedValue(created);

      await service.create({ ...dto, role: "station_user" });

      const createCall = userRepo.create.mock.calls[0][0] as any;
      expect(createCall.isAdmin).toBe(false);
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe("update", () => {
    it("throws NotFoundException if user not found", async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.update(999, {})).rejects.toThrow(NotFoundException);
    });

    it("updates username and email", async () => {
      const user = mockUser();
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockResolvedValue({ ...user, username: "updated" } as User);

      const dto: UpdateUserDto = { username: "updated" };
      const result = await service.update(1, dto);

      expect(userRepo.save).toHaveBeenCalled();
      expect((result as any).password).toBeUndefined();
    });

    it("hashes new password on update", async () => {
      const user = mockUser();
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockImplementation(async (u: any) => u);

      await service.update(1, { password: "NewPass1!" });

      const savedUser = userRepo.save.mock.calls[0][0] as any;
      expect(savedUser.password).not.toBe("NewPass1!");
      const isHashed = await bcrypt.compare("NewPass1!", savedUser.password);
      expect(isHashed).toBe(true);
    });

    it("throws ConflictException if new username already taken by another user", async () => {
      const user = mockUser({ id: 1 });
      userRepo.findOne
        .mockResolvedValueOnce(user) // find by id
        .mockResolvedValueOnce(mockUser({ id: 2, username: "taken" })); // username conflict

      await expect(service.update(1, { username: "taken" })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────────

  describe("remove", () => {
    it("throws NotFoundException if user not found", async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException if user has attendance records", async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      attendanceRepo.count.mockResolvedValue(3);

      await expect(service.remove(1)).rejects.toThrow(BadRequestException);
    });

    it("removes user when no attendance records exist", async () => {
      const user = mockUser();
      userRepo.findOne.mockResolvedValue(user);
      attendanceRepo.count.mockResolvedValue(0);
      userRepo.remove.mockResolvedValue(user);

      await service.remove(1);

      expect(userRepo.remove).toHaveBeenCalledWith(user);
    });
  });
});
