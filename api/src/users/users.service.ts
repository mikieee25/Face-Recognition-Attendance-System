import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { User } from "../database/entities/user.entity";
import { Attendance } from "../database/entities/attendance.entity";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

const SALT_ROUNDS = 12;

export type SafeUser = Omit<User, "password">;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
  ) {}

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private stripPassword(user: User): SafeUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safe } = user as any;
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

    // Map role to isAdmin boolean (existing schema uses isAdmin)
    const isAdmin = dto.role === "admin" ? true : false;

    const user = this.userRepo.create({
      username: dto.username,
      email: dto.email,
      password: passwordHash,
      isAdmin,
      isActive: true,
      dateCreated: new Date(),
    } as any);

    const saved = (await this.userRepo.save(user)) as unknown as User;
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

    if (dto.role !== undefined) {
      (user as any).isAdmin = dto.role === "admin";
    }

    if (dto.password !== undefined) {
      user.password = await bcrypt.hash(dto.password, SALT_ROUNDS);
    }

    const saved = (await this.userRepo.save(user)) as unknown as User;
    return this.stripPassword(saved);
  }

  /**
   * Delete a user — blocked if they have associated attendance records (Requirement 11.12).
   */
  async remove(id: number): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User #${id} not found`);

    // Block deletion if user has attendance records (as approver/creator)
    const attendanceCount = await this.attendanceRepo.count({
      where: { approvedBy: id },
    });

    if (attendanceCount > 0) {
      throw new BadRequestException(
        "Cannot delete user with associated attendance records",
      );
    }

    await this.userRepo.remove(user);
  }
}
