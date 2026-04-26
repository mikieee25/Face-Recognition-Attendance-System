import * as fs from "fs";
import * as path from "path";
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
import { PendingApproval, PendingReviewStatus } from "../database/entities/pending-attendance.entity";
import {
  Personnel,
  PersonnelSection,
} from "../database/entities/personnel.entity";
import {
  DEFAULT_SHIFT_END_TIME,
  DEFAULT_SHIFT_START_TIME,
  Schedule,
  ScheduleType,
} from "../database/entities/schedule.entity";
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
const SHIFT_GRACE_MINUTES = 30;
const SHIFTING_DUTY_HOURS = 72;
const SHIFTING_LOOKBACK_DAYS = 3;

interface DayAttendanceState {
  confirmedRecords: AttendanceRecord[];
  hasTimeIn: boolean;
  hasTimeOut: boolean;
  scopeLabel: "today" | "current shift";
}

interface DutyValidationResult {
  shouldPend: boolean;
  reason?: string;
}

interface EffectiveSchedule {
  type: ScheduleType | "off_duty";
  shiftStartTime: string;
  shiftEndTime: string;
  windowStart?: Date;
  windowEnd?: Date;
}

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

export interface DailyAttendanceSummary {
  personnelId: number;
  personnelName: string;
  rank: string;
  date: string;
  firstIn: Date | string | null;
  lastOut: Date | string | null;
  firstInId: number | null;
  lastOutId: number | null;
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
    @InjectRepository(Schedule)
    private readonly scheduleRepo: Repository<Schedule>,
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

  private saveUploadedImage(
    image: string,
    directoryName: string,
    filenamePrefix: string,
  ): string {
    const uploadDir = path.join(process.cwd(), "uploads", directoryName);
    fs.mkdirSync(uploadDir, { recursive: true });

    const ext = image.startsWith("data:image/png") ? "png" : "jpg";
    const filename = `${filenamePrefix}_${Date.now()}.${ext}`;
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    fs.writeFileSync(
      path.join(uploadDir, filename),
      Buffer.from(base64Data, "base64"),
    );

    return `uploads/${directoryName}/${filename}`;
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

  private getLocalDayStr(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0",
    )}-${String(date.getDate()).padStart(2, "0")}`;
  }

  private getLocalDayBounds(date: Date): { start: Date; end: Date } {
    return {
      start: new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        0,
        0,
        0,
        0,
      ),
      end: new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        23,
        59,
        59,
        999,
      ),
    };
  }

  private normalizeTime(time: string): string {
    return time.length === 5 ? `${time}:00` : time;
  }

  private buildShiftDate(date: Date, time: string): Date {
    const normalizedTime = this.normalizeTime(time);
    const [hours, minutes, seconds] = normalizedTime.split(":").map(Number);
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      hours,
      minutes,
      seconds ?? 0,
      0,
    );
  }

  private shiftDateByDays(date: Date, days: number): Date {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() + days,
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      date.getMilliseconds(),
    );
  }

  private buildShiftingWindow(date: Date, startTime: string): {
    start: Date;
    end: Date;
  } {
    const start = this.buildShiftDate(date, startTime);
    const end = new Date(
      start.getTime() + SHIFTING_DUTY_HOURS * 60 * 60 * 1000,
    );

    return { start, end };
  }

  private async getDayAttendanceState(
    personnelId: number,
    windowStart: Date,
    windowEnd: Date,
    scopeLabel: DayAttendanceState["scopeLabel"],
  ): Promise<DayAttendanceState> {
    const confirmedRecords = await this.attendanceRepo.find({
      where: {
        personnelId,
        status: AttendanceStatus.Confirmed,
        createdAt: Between(windowStart, windowEnd),
      },
      order: { createdAt: "ASC" },
    });

    return {
      confirmedRecords,
      hasTimeIn: confirmedRecords.some(
        (record) => record.type === AttendanceType.TimeIn,
      ),
      hasTimeOut: confirmedRecords.some(
        (record) => record.type === AttendanceType.TimeOut,
      ),
      scopeLabel,
    };
  }

  private resolveRequestedType(
    dto: CaptureAttendanceDto,
    dayState: DayAttendanceState,
  ): AttendanceType {
    if (dto.type) {
      return dto.type;
    }

    if (!dayState.hasTimeIn) {
      return AttendanceType.TimeIn;
    }

    if (!dayState.hasTimeOut) {
      return AttendanceType.TimeOut;
    }

    throw new BadRequestException(
      dayState.scopeLabel === "today"
        ? "Attendance already completed for today."
        : "Attendance already completed for the current shift.",
    );
  }

  private validateOncePerDayAttendance(
    type: AttendanceType,
    dayState: DayAttendanceState,
  ): void {
    if (type === AttendanceType.TimeIn && dayState.hasTimeIn) {
      throw new BadRequestException(
        dayState.scopeLabel === "today"
          ? "Time In already recorded for today."
          : "Time In already recorded for the current shift.",
      );
    }

    if (type === AttendanceType.TimeOut && !dayState.hasTimeIn) {
      throw new BadRequestException(
        dayState.scopeLabel === "today"
          ? "Cannot record Time Out. You need to Time In first."
          : "Cannot record Time Out. You need to Time In first for the current shift.",
      );
    }

    if (type === AttendanceType.TimeOut && dayState.hasTimeOut) {
      throw new BadRequestException(
        dayState.scopeLabel === "today"
          ? "Time Out already recorded for today."
          : "Time Out already recorded for the current shift.",
      );
    }
  }

  private async getEffectiveSchedule(
    personnel: Personnel,
    capturedAt: Date,
  ): Promise<EffectiveSchedule> {
    const dateStr = this.getLocalDayStr(capturedAt);
    const schedule = await this.scheduleRepo.findOne({
      where: {
        personnelId: personnel.id,
        date: dateStr,
      },
    });

    if (schedule) {
      if (schedule.type === ScheduleType.SHIFTING) {
        const { start, end } = this.buildShiftingWindow(
          capturedAt,
          schedule.shiftStartTime ?? DEFAULT_SHIFT_START_TIME,
        );

        return {
          type: schedule.type,
          shiftStartTime: schedule.shiftStartTime ?? DEFAULT_SHIFT_START_TIME,
          shiftEndTime: schedule.shiftEndTime ?? DEFAULT_SHIFT_END_TIME,
          windowStart: start,
          windowEnd: end,
        };
      }

      return {
        type: schedule.type,
        shiftStartTime: schedule.shiftStartTime ?? DEFAULT_SHIFT_START_TIME,
        shiftEndTime: schedule.shiftEndTime ?? DEFAULT_SHIFT_END_TIME,
      };
    }

    for (let lookbackDays = 1; lookbackDays <= SHIFTING_LOOKBACK_DAYS; lookbackDays += 1) {
      const candidateDate = this.shiftDateByDays(capturedAt, -lookbackDays);
      const candidateSchedule = await this.scheduleRepo.findOne({
        where: {
          personnelId: personnel.id,
          date: this.getLocalDayStr(candidateDate),
          type: ScheduleType.SHIFTING,
        },
      });

      if (!candidateSchedule) {
        continue;
      }

      const { start, end } = this.buildShiftingWindow(
        candidateDate,
        candidateSchedule.shiftStartTime ?? DEFAULT_SHIFT_START_TIME,
      );

      return {
        type: candidateSchedule.type,
        shiftStartTime:
          candidateSchedule.shiftStartTime ?? DEFAULT_SHIFT_START_TIME,
        shiftEndTime:
          candidateSchedule.shiftEndTime ?? DEFAULT_SHIFT_END_TIME,
        windowStart: start,
        windowEnd: end,
      };
    }

    if (personnel.section === PersonnelSection.ADMIN) {
      const dayOfWeek = capturedAt.getDay();
      const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
      return {
        type: isWeekday ? ScheduleType.REGULAR : "off_duty",
        shiftStartTime: DEFAULT_SHIFT_START_TIME,
        shiftEndTime: DEFAULT_SHIFT_END_TIME,
      };
    }

    return {
      type: "off_duty",
      shiftStartTime: DEFAULT_SHIFT_START_TIME,
      shiftEndTime: DEFAULT_SHIFT_END_TIME,
    };
  }

  private async validateCaptureDuty(
    personnel: Personnel,
    type: AttendanceType,
    capturedAt: Date,
    effectiveSchedule: EffectiveSchedule,
  ): Promise<DutyValidationResult> {
    if (personnel.section === PersonnelSection.OPERATION) {
      return {
        shouldPend: true,
        reason: "Operation personnel attendance requires admin review.",
      };
    }

    if (effectiveSchedule.type === ScheduleType.LEAVE) {
      return {
        shouldPend: true,
        reason: "Personnel is on leave today.",
      };
    }

    if (effectiveSchedule.type === "off_duty") {
      return {
        shouldPend: true,
        reason: "Personnel is currently off duty.",
      };
    }

    const shiftStart =
      effectiveSchedule.type === ScheduleType.SHIFTING &&
      effectiveSchedule.windowStart
        ? effectiveSchedule.windowStart
        : this.buildShiftDate(capturedAt, effectiveSchedule.shiftStartTime);
    const shiftEnd =
      effectiveSchedule.type === ScheduleType.SHIFTING &&
      effectiveSchedule.windowEnd
        ? effectiveSchedule.windowEnd
        : this.buildShiftDate(capturedAt, effectiveSchedule.shiftEndTime);
    const earliestAllowed = new Date(
      shiftStart.getTime() - SHIFT_GRACE_MINUTES * 60 * 1000,
    );
    const latestAllowed = new Date(
      shiftEnd.getTime() + SHIFT_GRACE_MINUTES * 60 * 1000,
    );

    if (capturedAt < earliestAllowed || capturedAt > latestAllowed) {
      return {
        shouldPend: true,
        reason: `Outside the scheduled duty window for ${
          type === AttendanceType.TimeIn ? "Time In" : "Time Out"
        }.`,
      };
    }

    return { shouldPend: false };
  }

  private async createPendingAttendance(
    personnelId: number,
    type: AttendanceType,
    confidence: number | null,
    image: string,
    capturedAt?: Date,
  ): Promise<PendingApproval> {
    const attendanceType =
      type === AttendanceType.TimeIn ? "TIME_IN" : "TIME_OUT";
    const pending = this.pendingRepo.create({
      personnelId,
      attendanceType: attendanceType as "TIME_IN" | "TIME_OUT",
      confidence,
      imagePath: this.saveUploadedImage(
        image,
        "pending-attendance",
        `pending_${personnelId}`,
      ),
      reviewStatus: PendingReviewStatus.Pending,
      createdAt: capturedAt,
    });
    return this.pendingRepo.save(pending);
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
    const capturedAt = new Date();
    try {
      const result = await this.faceService.recognize(dto.image, stationId);
      personnelId = result.personnelId;
      confidence = result.confidence;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Face recognition failed";
      throw new UnprocessableEntityException(message);
    }

    const personnel = await this.personnelRepo.findOne({
      where: { id: personnelId },
    });
    if (!personnel) {
      throw new NotFoundException(`Personnel #${personnelId} not found`);
    }

    const effectiveSchedule = await this.getEffectiveSchedule(
      personnel,
      capturedAt,
    );
    const attendanceWindow =
      effectiveSchedule.type === ScheduleType.SHIFTING &&
      effectiveSchedule.windowStart &&
      effectiveSchedule.windowEnd
        ? {
            start: effectiveSchedule.windowStart,
            end: effectiveSchedule.windowEnd,
            scopeLabel: "current shift" as const,
          }
        : {
            ...this.getLocalDayBounds(capturedAt),
            scopeLabel: "today" as const,
          };
    const dayState = await this.getDayAttendanceState(
      personnelId,
      attendanceWindow.start,
      attendanceWindow.end,
      attendanceWindow.scopeLabel,
    );
    const resolvedType = this.resolveRequestedType(dto, dayState);
    this.validateOncePerDayAttendance(resolvedType, dayState);
    const dutyValidation = await this.validateCaptureDuty(
      personnel,
      resolvedType,
      capturedAt,
      effectiveSchedule,
    );

    if (confidence >= 0.6) {
      if (dutyValidation.shouldPend) {
        return this.createPendingAttendance(
          personnelId,
          resolvedType,
          confidence,
          dto.image,
          capturedAt,
        );
      }

      const record = this.attendanceRepo.create({
        personnelId,
        type: resolvedType,
        status: AttendanceStatus.Confirmed,
        confidence,
        imagePath: null,
        isManual: false,
        createdBy: currentUser.id,
        createdAt: capturedAt,
      });
      return this.attendanceRepo.save(record);
    } else if (confidence >= 0.4) {
      return this.createPendingAttendance(
        personnelId,
        resolvedType,
        confidence,
        dto.image,
        capturedAt,
      );
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
   * Validate date not in future, route to pending_approval for admin review.
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9
   */
  async createManual(
    dto: ManualAttendanceDto,
    currentUser: AuthenticatedUser,
  ): Promise<PendingApproval> {
    // Validate date is not in the future (Requirement 6.3)
    const entryDate = new Date(dto.date);
    if (isNaN(entryDate.getTime())) {
      throw new BadRequestException("Invalid date format.");
    }
    // Allow 5s buffer for clock skew / network latency between client capture and server processing
    const futureThreshold = new Date(Date.now() + 5000);
    if (entryDate > futureThreshold) {
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

    // Map AttendanceType enum values to pending_approval attendanceType enum
    const attendanceType =
      dto.type === AttendanceType.TimeIn ? "TIME_IN" : "TIME_OUT";

    // Save photo to disk if provided
    let imagePath = "";
    if (dto.photo) {
      this.validateImage(dto.photo);
      imagePath = this.saveUploadedImage(
        dto.photo,
        "manual-attendance",
        `manual_${dto.personnelId}`,
      );
    }

    // Route to pending_approval for admin review (Requirements 6.6, 6.7)
    const pending = this.pendingRepo.create({
      personnelId: dto.personnelId,
      attendanceType: attendanceType as "TIME_IN" | "TIME_OUT",
      confidence: null,
      imagePath,
      reviewStatus: PendingReviewStatus.Pending,
      createdAt: entryDate,
    });

    return this.pendingRepo.save(pending);
  }

  /**
   * GET /api/v1/attendance
   * Paginated, filterable by date range/personnel/station/type; filtered by role.
   * Requirements: 7.1, 7.2, 7.3
   */
  async findAll(
    query: QueryAttendanceDto,
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<any>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    if (query.summaryMode) {
      const qb = this.attendanceRepo
        .createQueryBuilder("ar")
        .leftJoinAndSelect("ar.personnel", "personnel")
        .orderBy("ar.createdAt", "ASC");

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

      if (query.dateFrom) {
        qb.andWhere("ar.createdAt >= :dateFrom", { dateFrom: query.dateFrom });
      }

      if (query.dateTo) {
        qb.andWhere("ar.createdAt <= :dateTo", { dateTo: query.dateTo });
      }

      const allRecords = await qb.getMany();

      const summaryMap = new Map<string, DailyAttendanceSummary>();
      for (const record of allRecords) {
        const dateStr = record.createdAt.toISOString().split("T")[0];
        const key = `${record.personnelId}_${dateStr}`;

        if (!summaryMap.has(key)) {
          summaryMap.set(key, {
            personnelId: record.personnelId,
            personnelName: `${record.personnel?.firstName || ""} ${
              record.personnel?.lastName || ""
            }`.trim(),
            rank: record.personnel?.rank || "",
            date: dateStr,
            firstIn: null,
            lastOut: null,
            firstInId: null,
            lastOutId: null,
          });
        }

        const summary = summaryMap.get(key)!;
        if (record.type === AttendanceType.TimeIn) {
          if (
            !summary.firstIn ||
            record.createdAt < new Date(summary.firstIn)
          ) {
            summary.firstIn = record.createdAt;
            summary.firstInId = record.id;
          }
        } else if (record.type === AttendanceType.TimeOut) {
          if (
            !summary.lastOut ||
            record.createdAt > new Date(summary.lastOut)
          ) {
            summary.lastOut = record.createdAt;
            summary.lastOutId = record.id;
          }
        }
      }

      const summaryList = Array.from(summaryMap.values());
      summaryList.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return a.personnelName.localeCompare(b.personnelName);
      });

      const total = summaryList.length;
      const items = summaryList.slice(skip, skip + limit);

      return { items, total, page, limit };
    }

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
