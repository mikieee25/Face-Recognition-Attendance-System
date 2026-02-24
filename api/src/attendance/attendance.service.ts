import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between, FindOptionsWhere } from "typeorm";
import {
  AttendanceRecord,
  AttendanceStatus,
  AttendanceType,
} from "../database/entities/attendance.entity";
import { PendingApproval } from "../database/entities/pending-attendance.entity";
import { Personnel } from "../database/entities/personnel.entity";
import { FaceService } from "../face/face.service";
import { CaptureAttendanceDto } from "./dto/capture-attendance.dto";
import { ManualAttendanceDto } from "./dto/manual-attendance.dto";
import { UpdateAttendanceDto } from "./dto/update-attendance.dto";
import { QueryAttendanceDto } from "./dto/query-attendance.dto";

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

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceRecord)
    private readonly attendanceRepo: Repository<AttendanceRecord>,
    @InjectRepository(PendingApproval)
    private readonly pendingRepo: Repository<PendingApproval>,
    @InjectRepository(Personnel)
    private readonly personnelRepo: Repository<Personnel>,
    private readonly faceService: FaceService,
  ) {}

  /**
   * Validate image: must be JPEG/PNG and ≤ 10 MB (Requirements 15.11, 15.12)
   */
  private validateImage(image: string): void {
    const hasValidMime = ALLOWED_MIME_PREFIXES.some((prefix) =>
      image.startsWith(prefix),
    );
    if (!hasValidMime) {
      throw new BadRequestException(
        "Invalid image format. Only JPEG and PNG are supported.",
      );
    }
    if (image.length > MAX_IMAGE_BASE64_LENGTH) {
      throw new BadRequestException(
        "Image exceeds the maximum allowed size of 10 MB.",
      );
    }
  }

  /**
   * Determine attendance type based on last confirmed record.
   * If no prior record → time_in. Otherwise alternates. (Requirement 5.10)
   */
  private async determineAttendanceType(
    personnelId: number,
  ): Promise<AttendanceType> {
    const lastRecord = await this.attendanceRepo.findOne({
      where: { personnelId, status: AttendanceStatus.Confirmed },
      order: { createdAt: "DESC" },
    });

    if (!lastRecord) {
      return AttendanceType.TimeIn;
    }

    return lastRecord.type === AttendanceType.TimeIn
      ? AttendanceType.TimeOut
      : AttendanceType.TimeIn;
  }

  /**
   * POST /api/v1/attendance/capture
   * Validate image → call FaceService.recognize() → route by confidence threshold.
   * Requirements: 5.1, 5.2, 5.3, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.14
   */
  async capture(
    dto: CaptureAttendanceDto,
    currentUser: AuthenticatedUser,
  ): Promise<AttendanceRecord | PendingApproval> {
    // Validate image format and size (Requirements 15.11, 15.12)
    this.validateImage(dto.image);

    // Use user's station if not provided
    const stationId = dto.stationId ?? currentUser.stationId ?? 0;

    // Call Face Service (Requirements 5.3, 5.4, 5.5)
    let personnelId: number;
    let confidence: number;
    try {
      const result = await this.faceService.recognize(dto.image, stationId);
      personnelId = result.personnelId;
      confidence = result.confidence;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Face recognition failed";
      throw new UnprocessableEntityException(message);
    }

    if (confidence >= 0.6) {
      // High confidence → confirmed AttendanceRecord (Requirement 5.6)
      const expectedType = await this.determineAttendanceType(personnelId);

      // If the user explicitly requested a type, validate it matches the expected sequence
      if (dto.type && dto.type !== expectedType) {
        const label =
          dto.type === AttendanceType.TimeIn ? "Time In" : "Time Out";
        const expectedLabel =
          expectedType === AttendanceType.TimeIn ? "Time In" : "Time Out";
        throw new BadRequestException(
          `Cannot record ${label}. You need to ${expectedLabel} first.`,
        );
      }

      const type = dto.type ?? expectedType;
      const record = this.attendanceRepo.create({
        personnelId,
        type,
        status: AttendanceStatus.Confirmed,
        confidence,
        imagePath: null,
        isManual: false,
        createdBy: currentUser.id,
        createdAt: new Date(),
      });
      return this.attendanceRepo.save(record);
    } else if (confidence >= 0.4) {
      // Medium confidence → PendingApproval (Requirement 5.14)
      const pending = this.pendingRepo.create({
        personnelId,
        confidence,
        imagePath: "",
        reviewStatus: "pending" as any,
        createdAt: new Date(),
      });
      return this.pendingRepo.save(pending);
    } else {
      // Low confidence → HTTP 422 (Requirement 5.7)
      throw new UnprocessableEntityException(
        `Low confidence recognition (${(confidence * 100).toFixed(
          1,
        )}%). Please try again with better lighting or positioning.`,
      );
    }
  }

  /**
   * POST /api/v1/attendance/manual
   * Validate date not in future, record is_manual=true and created_by.
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9
   */
  async createManual(
    dto: ManualAttendanceDto,
    currentUser: AuthenticatedUser,
  ): Promise<AttendanceRecord> {
    // Validate date is not in the future (Requirement 6.3)
    const entryDate = new Date(dto.date);
    if (isNaN(entryDate.getTime())) {
      throw new BadRequestException("Invalid date format.");
    }
    if (entryDate > new Date()) {
      throw new BadRequestException("Attendance date cannot be in the future.");
    }

    // Validate personnel exists
    const personnel = await this.personnelRepo.findOne({
      where: { id: dto.personnelId },
    });
    if (!personnel) {
      throw new NotFoundException(`Personnel #${dto.personnelId} not found`);
    }

    // Station_user can only create manual entry for their station's personnel (Requirement 6.8)
    if (
      currentUser.role === "station_user" &&
      personnel.stationId !== currentUser.stationId
    ) {
      throw new ForbiddenException(
        "You can only create manual entries for your station's personnel.",
      );
    }

    // Create record with is_manual=true and created_by (Requirements 6.6, 6.7)
    const record = this.attendanceRepo.create({
      personnelId: dto.personnelId,
      type: dto.type,
      status: AttendanceStatus.Confirmed,
      confidence: null,
      imagePath: null,
      isManual: true,
      createdBy: currentUser.id,
      createdAt: entryDate,
    });

    return this.attendanceRepo.save(record);
  }

  /**
   * GET /api/v1/attendance
   * Paginated, filterable by date range/personnel/station/type; filtered by role.
   * Requirements: 7.1, 7.2, 7.3
   */
  async findAll(
    query: QueryAttendanceDto,
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<AttendanceRecord>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.attendanceRepo
      .createQueryBuilder("ar")
      .leftJoinAndSelect("ar.personnel", "personnel")
      .leftJoinAndSelect("personnel.station", "station")
      .orderBy("ar.createdAt", "DESC")
      .skip(skip)
      .take(limit);

    // Role-based filtering (Requirement 7.3)
    if (currentUser.role === "station_user" && currentUser.stationId) {
      qb.andWhere("personnel.stationId = :stationId", {
        stationId: currentUser.stationId,
      });
    } else if (query.stationId) {
      qb.andWhere("personnel.stationId = :stationId", {
        stationId: query.stationId,
      });
    }

    if (query.personnelId) {
      qb.andWhere("ar.personnelId = :personnelId", {
        personnelId: query.personnelId,
      });
    }

    if (query.type) {
      qb.andWhere("ar.type = :type", { type: query.type });
    }

    if (query.dateFrom) {
      qb.andWhere("ar.createdAt >= :dateFrom", { dateFrom: query.dateFrom });
    }

    if (query.dateTo) {
      qb.andWhere("ar.createdAt <= :dateTo", { dateTo: query.dateTo });
    }

    const [items, total] = await qb.getManyAndCount();

    return { items, total, page, limit };
  }

  /**
   * PATCH /api/v1/attendance/:id
   * Record modified_at and modified_by. (Requirements 7.7, 7.8, 7.9)
   */
  async update(
    id: number,
    dto: UpdateAttendanceDto,
    currentUser: AuthenticatedUser,
  ): Promise<AttendanceRecord> {
    const record = await this.attendanceRepo.findOne({
      where: { id },
      relations: ["personnel"],
    });

    if (!record) {
      throw new NotFoundException(`Attendance record #${id} not found`);
    }

    // Station_user can only edit their station's records (Requirement 7.8)
    if (
      currentUser.role === "station_user" &&
      record.personnel?.stationId !== currentUser.stationId
    ) {
      throw new ForbiddenException(
        "You can only edit your station's attendance records.",
      );
    }

    if (dto.type !== undefined) record.type = dto.type;
    if (dto.status !== undefined) record.status = dto.status;
    if (dto.personnelId !== undefined) record.personnelId = dto.personnelId;

    // Audit trail (Requirement 7.9)
    record.modifiedAt = new Date();
    record.modifiedBy = currentUser.id;

    return this.attendanceRepo.save(record);
  }

  /**
   * DELETE /api/v1/attendance/:id
   * Admin only. (Requirement 7.10)
   */
  async remove(id: number): Promise<void> {
    const record = await this.attendanceRepo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException(`Attendance record #${id} not found`);
    }
    await this.attendanceRepo.remove(record);
  }

  /**
   * Find a single attendance record by ID.
   */
  async findOne(
    id: number,
    currentUser: AuthenticatedUser,
  ): Promise<AttendanceRecord> {
    const record = await this.attendanceRepo.findOne({
      where: { id },
      relations: ["personnel"],
    });

    if (!record) {
      throw new NotFoundException(`Attendance record #${id} not found`);
    }

    if (
      currentUser.role === "station_user" &&
      record.personnel?.stationId !== currentUser.stationId
    ) {
      throw new ForbiddenException("Access denied");
    }

    return record;
  }
}
