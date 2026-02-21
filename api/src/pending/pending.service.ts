import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  PendingApproval,
  PendingReviewStatus,
} from "../database/entities/pending-attendance.entity";
import {
  AttendanceRecord,
  AttendanceStatus,
  AttendanceType,
} from "../database/entities/attendance.entity";

export interface AuthenticatedUser {
  id: number;
  role: string;
  stationId: number | null;
}

@Injectable()
export class PendingService {
  constructor(
    @InjectRepository(PendingApproval)
    private readonly pendingRepo: Repository<PendingApproval>,
    @InjectRepository(AttendanceRecord)
    private readonly attendanceRepo: Repository<AttendanceRecord>,
  ) {}

  /**
   * GET /api/v1/pending
   * List all pending approval records (Admin only).
   * Requirements: 10.1, 10.2
   */
  async findAll(): Promise<PendingApproval[]> {
    return this.pendingRepo.find({
      where: { reviewStatus: PendingReviewStatus.Pending },
      relations: ["personnel"],
      order: { createdAt: "DESC" },
    });
  }

  /**
   * GET /api/v1/pending/count
   * Count of pending approval records (Admin only).
   * Requirements: 10.12
   */
  async count(): Promise<{ count: number }> {
    const count = await this.pendingRepo.count({
      where: { reviewStatus: PendingReviewStatus.Pending },
    });
    return { count };
  }

  /**
   * POST /api/v1/pending/:id/approve
   * Convert pending record to confirmed AttendanceRecord, record reviewed_by.
   * Requirements: 10.7, 10.9
   */
  async approve(
    id: number,
    currentUser: AuthenticatedUser,
  ): Promise<AttendanceRecord> {
    const pending = await this.pendingRepo.findOne({
      where: { id },
      relations: ["personnel"],
    });

    if (!pending) {
      throw new NotFoundException(`Pending approval #${id} not found`);
    }

    if (pending.reviewStatus !== PendingReviewStatus.Pending) {
      throw new BadRequestException(
        `Record #${id} has already been reviewed (status: ${pending.reviewStatus})`,
      );
    }

    // Determine attendance type based on last confirmed record (alternation logic)
    const type = await this.determineAttendanceType(pending.personnelId);

    // Create confirmed AttendanceRecord
    const record = this.attendanceRepo.create({
      personnelId: pending.personnelId,
      type,
      status: AttendanceStatus.Confirmed,
      confidence: pending.confidence,
      imagePath: pending.imagePath,
      isManual: false,
      createdBy: currentUser.id,
      createdAt: pending.createdAt,
    });
    const savedRecord = await this.attendanceRepo.save(record);

    // Update pending record
    pending.reviewStatus = PendingReviewStatus.Approved;
    pending.reviewedAt = new Date();
    pending.reviewedBy = currentUser.id;
    await this.pendingRepo.save(pending);

    return savedRecord;
  }

  /**
   * POST /api/v1/pending/:id/reject
   * Mark pending record as rejected, record reviewed_by and reviewed_at.
   * Requirements: 10.8, 10.9
   */
  async reject(
    id: number,
    currentUser: AuthenticatedUser,
  ): Promise<PendingApproval> {
    const pending = await this.pendingRepo.findOne({ where: { id } });

    if (!pending) {
      throw new NotFoundException(`Pending approval #${id} not found`);
    }

    if (pending.reviewStatus !== PendingReviewStatus.Pending) {
      throw new BadRequestException(
        `Record #${id} has already been reviewed (status: ${pending.reviewStatus})`,
      );
    }

    pending.reviewStatus = PendingReviewStatus.Rejected;
    pending.reviewedAt = new Date();
    pending.reviewedBy = currentUser.id;

    return this.pendingRepo.save(pending);
  }

  /**
   * Determine attendance type based on last confirmed record for a personnel.
   * If no prior record → time_in. Otherwise alternates.
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
}
