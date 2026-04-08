import * as fs from "fs";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Personnel } from "../database/entities/personnel.entity";
import { FaceEmbedding } from "../database/entities/face-data.entity";
import { CreatePersonnelDto } from "./dto/create-personnel.dto";
import { UpdatePersonnelDto } from "./dto/update-personnel.dto";
import { FaceService } from "../face/face.service";

/** Max base64 string length for a 10 MB image: 10 * 1024 * 1024 * (4/3) ≈ 13,981,013 */
const MAX_IMAGE_BASE64_LENGTH = Math.ceil(10 * 1024 * 1024 * (4 / 3));
const ALLOWED_MIME_PREFIXES = [
  "data:image/jpeg;base64,",
  "data:image/png;base64,",
];

export interface AuthenticatedUser {
  id: number;
  role: string;
  stationId: number | null;
}

@Injectable()
export class PersonnelService {
  constructor(
    @InjectRepository(Personnel)
    private readonly personnelRepo: Repository<Personnel>,
    @InjectRepository(FaceEmbedding)
    private readonly faceEmbeddingRepo: Repository<FaceEmbedding>,
    private readonly faceService: FaceService
  ) {}

  /**
   * List personnel.
   * - Admin: returns all personnel (Requirement 3.5)
   * - station_user: returns only personnel belonging to their station (Requirement 3.5)
   */
  async findAll(currentUser: AuthenticatedUser): Promise<Personnel[]> {
    if (currentUser.role === "admin") {
      return this.personnelRepo.find({
        order: { id: "ASC" },
        relations: ["station"],
      });
    }

    // station_user: filter by their assigned stationId
    if (!currentUser.stationId) {
      return [];
    }
    return this.personnelRepo.find({
      where: { stationId: currentUser.stationId },
      order: { id: "ASC" },
      relations: ["station"],
    });
  }

  /**
   * Find a single personnel by id, scoped by role.
   */
  async findOne(
    id: number,
    currentUser: AuthenticatedUser
  ): Promise<Personnel> {
    const personnel = await this.personnelRepo.findOne({
      where: { id },
      relations: ["station"],
    });
    if (!personnel) {
      throw new NotFoundException(`Personnel #${id} not found`);
    }

    if (
      currentUser.role !== "admin" &&
      personnel.stationId !== currentUser.stationId
    ) {
      throw new ForbiddenException("Access denied");
    }

    return personnel;
  }

  /**
   * Create personnel.
   * - Admin: uses station_id from DTO (Requirement 3.3)
   * - station_user: auto-assigns station_id from JWT (Requirement 3.4)
   * - Requires first_name, last_name, rank, station_id (Requirement 3.2)
   */
  async create(
    dto: CreatePersonnelDto,
    currentUser: AuthenticatedUser
  ): Promise<Personnel> {
    if (currentUser.role !== "admin" && !currentUser.stationId) {
      throw new BadRequestException("User has no assigned station");
    }

    if (currentUser.role === "admin" && !dto.stationId) {
      throw new BadRequestException("stationId is required for admin");
    }

    const stationId =
      currentUser.role === "admin"
        ? dto.stationId
        : currentUser.stationId ?? undefined;

    const personnel = this.personnelRepo.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      rank: dto.rank,
      stationId,
      address: dto.address ?? null,
      contactNumber: dto.contactNumber ?? null,
      gender: dto.gender ?? null,
      dateCreated: new Date(),
      isActive: true,
    });

    const savedPersonnel = await this.personnelRepo.save(personnel);
    
    if (dto.photo) {
      const base64Data = dto.photo.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const filename = `profile-${savedPersonnel.id}-${Date.now()}.jpg`;
      const dir = "uploads/profiles";
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(`${dir}/${filename}`, buffer);
      savedPersonnel.imagePath = `${dir}/${filename}`;
      await this.personnelRepo.save(savedPersonnel);
    }
    
    return savedPersonnel;
  }

  /**
   * Update personnel fields.
   * - station_user can only update personnel in their station (Requirement 3.5)
   */
  async update(
    id: number,
    dto: UpdatePersonnelDto,
    currentUser: AuthenticatedUser
  ): Promise<Personnel> {
    const personnel = await this.findOne(id, currentUser);

    // Track old stationId before any changes so we can invalidate both
    // the old and new station caches if the station assignment changes.
    const oldStationId = personnel.stationId;

    if (dto.firstName !== undefined) personnel.firstName = dto.firstName;
    if (dto.lastName !== undefined) personnel.lastName = dto.lastName;
    if (dto.rank !== undefined) personnel.rank = dto.rank;
    if (dto.isActive !== undefined) personnel.isActive = dto.isActive;

    if (dto.photo) {
      const base64Data = dto.photo.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const filename = `profile-${personnel.id}-${Date.now()}.jpg`;
      const dir = "uploads/profiles";
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(`${dir}/${filename}`, buffer);
      personnel.imagePath = `${dir}/${filename}`;
    }

    // Only admin can change stationId
    if (dto.stationId !== undefined) {
      if (currentUser.role !== "admin") {
        throw new ForbiddenException(
          "Only admin can change station assignment"
        );
      }
      personnel.stationId = dto.stationId;
    }

    const saved = await this.personnelRepo.save(personnel);

    // Invalidate face-service embedding cache so the next recognition
    // request loads fresh embeddings from the DB instead of stale cache.
    // If the station changed we invalidate both old and new stations.
    // Non-fatal — cache has a 60s TTL and will self-expire if this fails.
    if (oldStationId !== saved.stationId) {
      // Station changed — clear both old and new station caches
      await Promise.allSettled([
        this.faceService.invalidateCache(oldStationId ?? undefined),
        this.faceService.invalidateCache(saved.stationId ?? undefined),
      ]);
    } else {
      // Same station — just clear that one station's cache
      await this.faceService.invalidateCache(saved.stationId ?? undefined);
    }

    return saved;
  }

  /**
   * Get the number of registered face embeddings for a personnel member.
   */
  async getFaceCount(
    personnelId: number,
    currentUser: AuthenticatedUser
  ): Promise<{ count: number }> {
    await this.findOne(personnelId, currentUser);
    const count = await this.faceEmbeddingRepo.count({
      where: { personnelId },
    });
    return { count };
  }

  /**
   * List all face registrations for a personnel member.
   */
  async getFaces(
    personnelId: number,
    currentUser: AuthenticatedUser
  ): Promise<{ id: number; source: "embedding"; createdAt: string }[]> {
    await this.findOne(personnelId, currentUser);

    const rows = await this.faceEmbeddingRepo.find({
      where: { personnelId },
      order: { createdAt: "DESC" },
    });

    return rows.map((row) => ({
      id: row.id,
      source: "embedding",
      createdAt: row.createdAt.toISOString(),
    }));
  }

  /**
   * Delete a single face registration by id.
   */
  async deleteFace(
    personnelId: number,
    faceId: number,
    currentUser: AuthenticatedUser
  ): Promise<void> {
    await this.findOne(personnelId, currentUser);

    const row = await this.faceEmbeddingRepo.findOne({
      where: { id: faceId, personnelId },
    });
    if (!row) throw new NotFoundException(`Face record #${faceId} not found`);
    await this.faceEmbeddingRepo.remove(row);
  }

  /**
   * Delete ALL face registrations for a personnel member.
   */
  async deleteAllFaces(
    personnelId: number,
    currentUser: AuthenticatedUser
  ): Promise<void> {
    await this.findOne(personnelId, currentUser);
    await this.faceEmbeddingRepo.delete({ personnelId });
  }

  /**
   * Delete personnel.
   * - Requires confirmation if face images are registered (Requirement 3.9)
   * - station_user can only delete personnel in their station
   */
  async remove(
    id: number,
    currentUser: AuthenticatedUser,
    force = false
  ): Promise<void> {
    const personnel = await this.findOne(id, currentUser);

    const faceCount = await this.faceEmbeddingRepo.count({
      where: { personnelId: id },
    });

    if (faceCount > 0 && !force) {
      throw new BadRequestException(
        `Personnel has ${faceCount} registered face image(s). Pass force=true to confirm deletion.`
      );
    }

    await this.personnelRepo.remove(personnel);
  }

  /**
   * Register face images for a personnel member.
   * - Validates MIME type (JPEG/PNG) and size (≤ 10 MB) for each image (Requirements 15.11, 15.12)
   * - Forwards valid images to FaceService (Requirement 4.5)
   * - Stores returned embeddings in FaceEmbedding entity (Requirement 4.7)
   * (Requirements 4.4, 4.5, 4.6, 4.7, 4.8)
   */
  async registerFace(
    personnelId: number,
    images: string[],
    currentUser: AuthenticatedUser
  ): Promise<void> {
    // Ensure personnel exists and is accessible by the current user
    await this.findOne(personnelId, currentUser);

    // Validate each image before forwarding to Face Service (Requirements 15.11, 15.12)
    for (let i = 0; i < images.length; i++) {
      const image = images[i];

      const hasValidMime = ALLOWED_MIME_PREFIXES.some((prefix) =>
        image.startsWith(prefix)
      );
      if (!hasValidMime) {
        throw new BadRequestException(
          `Image at index ${i} has an unsupported MIME type. Only image/jpeg and image/png are allowed.`
        );
      }

      if (image.length > MAX_IMAGE_BASE64_LENGTH) {
        throw new BadRequestException(
          `Image at index ${i} exceeds the maximum allowed size of 10 MB.`
        );
      }
    }

    // Forward to Face Service for embedding generation (Requirement 4.5)
    // The face service handles persistence to the face_embeddings table directly,
    // so we don't need to save again on the NestJS side.
    try {
      await this.faceService.registerFace(personnelId, images);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Face registration failed";
      throw new BadRequestException(message);
    }
  }
}
