import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { User, UserRole } from "../database/entities/user.entity";
import { AttendanceRecord } from "../database/entities/attendance.entity";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

const SALT_ROUNDS = 12;

export type SafeUser = Omit<User, "passwordHash">;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(AttendanceRecord)
    private readonly attendanceRepo: Repository<AttendanceRecord>,
  ) {}

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private stripPassword(user: User): SafeUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...safe } = user as any;
    return safe as SafeUser;
  }

  private async assertUniqueUsernameEmail(
    username?: string,
    email?: string,
    excludeId?: number,
  ): Promise<void> {
    if (username) {
      const existing = await this.userRepo.findOne({ where: { username } });
      if (existing && existing.id !== excludeId) {
        throw new ConflictException("Username already exists");
      }
    }
    if (email) {
      const existing = await this.userRepo.findOne({ where: { email } });
      if (existing && existing.id !== excludeId) {
        throw new ConflictException("Email already exists");
      }
    }
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  /**
   * List all users (Requirement 11.1).
   */
  async findAll(): Promise<SafeUser[]> {
    const users = await this.userRepo.find({ order: { id: "ASC" } });
    return users.map((u) => this.stripPassword(u));
  }

  /**
   * Create a new user (Requirements 11.3, 11.4, 11.5, 11.6, 11.7).
   */
  async create(dto: CreateUserDto): Promise<SafeUser> {
    await this.assertUniqueUsernameEmail(dto.username, dto.email);

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const role = (dto.role as UserRole) ?? UserRole.StationUser;

    const user = this.userRepo.create({
      username: dto.username,
      email: dto.email,
      passwordHash,
      role,
      stationId: dto.stationId ?? null,
      isActive: true,
    });

    const saved = await this.userRepo.save(user);
    return this.stripPassword(saved);
  }

  /**
   * Update an existing user (Requirements 11.4, 11.5, 11.6, 11.7).
   */
  async update(id: number, dto: UpdateUserDto): Promise<SafeUser> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User #${id} not found`);

    await this.assertUniqueUsernameEmail(dto.username, dto.email, id);

    if (dto.username !== undefined) user.username = dto.username;
    if (dto.email !== undefined) user.email = dto.email;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.role !== undefined) user.role = dto.role as UserRole;
    if (dto.stationId !== undefined) user.stationId = dto.stationId;

    if (dto.password !== undefined) {
      user.passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    }

    const saved = await this.userRepo.save(user);
    return this.stripPassword(saved);
  }

  /**
   * Delete a user — blocked if they have associated attendance records (Requirement 11.12).
   */
  async remove(id: number): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User #${id} not found`);

    // Block deletion if user has attendance records (as creator)
    const attendanceCount = await this.attendanceRepo.count({
      where: { createdBy: id },
    });

    if (attendanceCount > 0) {
      throw new BadRequestException(
        "Cannot delete user with associated attendance records",
      );
    }

    await this.userRepo.remove(user);
  }
}
