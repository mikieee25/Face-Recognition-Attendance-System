import { Injectable, ConflictException, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../entities/user.entity";
import * as bcrypt from "bcrypt";

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Validate user credentials.
   * Returns the user object without the password when valid, otherwise null.
   */
  async validateUser(username: string, password: string): Promise<Omit<User, "password"> | null> {
    const user = await this.userRepo.findOne({ where: { username } });
    if (!user) return null;

    const match = await bcrypt.compare(password, user.password);
    if (!match) return null;

    // Strip password before returning
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pw, ...safe } = user as any;
    return safe;
  }

  /**
   * Sign a JWT access token for the given user and return token + user (sans password).
   */
  async login(user: Partial<User> & { id: number; username: string }): Promise<{ access_token: string; user: Omit<User, "password"> }> {
    const payload = { sub: user.id, username: user.username };
    const access_token = this.jwtService.sign(payload);
    // Ensure safe user object (no password)
    const safeUser = { ...(user as any) } as any;
    if (safeUser.password) delete safeUser.password;
    return { access_token, user: safeUser };
  }

  /**
   * Create a new user with hashed password.
   * Throws ConflictException if username already exists.
   */
  async createUser(username: string, password: string, name?: string): Promise<Omit<User, "password">> {
    // Check existing
    const existing = await this.userRepo.findOne({ where: { username } });
    if (existing) {
      throw new ConflictException("Username already exists");
    }

    try {
      const hash = await bcrypt.hash(password, SALT_ROUNDS);
      const user = this.userRepo.create({ username, password: hash, name } as any);
      const saved = await this.userRepo.save(user);
      const { password: _pw, ...safe } = saved as any;
      return safe;
    } catch (err) {
      // Convert to internal server error for unexpected failures
      throw new InternalServerErrorException("Failed to create user");
    }
  }

  /**
   * Optional helper to find user by id (without password).
   */
  async findById(id: number): Promise<Omit<User, "password"> | null> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) return null;
    const { password: _pw, ...safe } = user as any;
    return safe;
  }
}
