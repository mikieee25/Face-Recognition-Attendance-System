import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Response } from "express";
import * as ExcelJS from "exceljs";
import {
  AttendanceRecord,
  AttendanceStatus,
  AttendanceType,
} from "../database/entities/attendance.entity";
import { Personnel } from "../database/entities/personnel.entity";
import { Schedule, ScheduleType } from "../database/entities/schedule.entity";
import { QueryReportsDto } from "./dto/query-reports.dto";
import { QueryCalendarDto } from "./dto/query-calendar.dto";

export interface AuthenticatedUser {
  id: number;
  role: string;
  stationId: number | null;
}

export interface ReportItem {
  id: number;
  personnelId: number;
  personnelName: string;
  rank: string;
  section: string;
  station: string;
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  totalHours: number | null;
  type: string;
  status: string;
  confidence: number | null;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface MonthlySummaryItem {
  personnelId: number;
  personnelName: string;
  rank: string;
  station: string;
  year: number;
  month: number;
  daysPresent: number;
  daysAbsent: number;
  lateArrivals: number;
  totalHoursWorked: number;
}

export interface CalendarDay {
  date: string;
  status: "present" | "late" | "absent" | "leave" | "shifting" | "off_duty" | "future";
}

export interface CalendarPersonnelItem {
  personnelId: number;
  name: string;
  rank: string;
  station: string;
  imagePath: string | null;
  calendar: CalendarDay[];
}

export interface CalendarDayPersonnelDetail {
  personnelId: number;
  name: string;
  rank: string;
  station: string;
  imagePath: string | null;
}

export interface CalendarDateSummaryItem {
  date: string;
  isFuture: boolean;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  shiftingCount: number;
  leaveCount: number;
  offDutyCount: number;
  presentPersonnel: CalendarDayPersonnelDetail[];
  latePersonnel: CalendarDayPersonnelDetail[];
  absentPersonnel: CalendarDayPersonnelDetail[];
  shiftingPersonnel: CalendarDayPersonnelDetail[];
  leavePersonnel: CalendarDayPersonnelDetail[];
  offDutyPersonnel: CalendarDayPersonnelDetail[];
}

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const SHIFT_GRACE_MINUTES = 30;
const HEADER_FILL = "FF1E3A5F";
const HEADER_FONT = "FFFFFFFF";
const ACCENT_FILL = "FFEAF1FB";
const BORDER_COLOR = "FFD4DCE8";
const EVEN_ROW_FILL = "FFF8FAFC";

type ReportPeriod = NonNullable<QueryReportsDto["reportPeriod"]>;
type ExportStatus = NonNullable<QueryReportsDto["exportStatus"]>;

interface ExportDateRange {
  startStr: string;
  endStr: string;
  startDate: Date;
  endDate: Date;
}

interface DtrExportRow {
  personnelId: number;
  personnelName: string;
  rank: string;
  section: string;
  station: string;
  date: string;
  dayName: string;
  schedule: string;
  timeIn: string;
  timeOut: string;
  hoursWorked: number;
  status: "Present" | "Late" | "Absent" | "Leave" | "Shifting" | "Off Duty" | "Scheduled";
  remarks: string;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(AttendanceRecord)
    private readonly attendanceRepo: Repository<AttendanceRecord>,
    @InjectRepository(Personnel)
    private readonly personnelRepo: Repository<Personnel>,
    @InjectRepository(Schedule)
    private readonly scheduleRepo: Repository<Schedule>
  ) {}

  private buildScopedPersonnelQuery(
    currentUser: AuthenticatedUser,
    stationId?: number
  ) {
    const qb = this.personnelRepo
      .createQueryBuilder("p")
      .leftJoinAndSelect("p.station", "station")
      .where("p.isActive = :isActive", { isActive: true });

    if (currentUser.role === "station_user" && currentUser.stationId) {
      qb.andWhere("p.stationId = :stationId", {
        stationId: currentUser.stationId,
      });
    } else if (stationId) {
      qb.andWhere("p.stationId = :stationId", { stationId });
    }

    return qb;
  }

  private classifyPersonnelDay(
    dateStr: string,
    todayStr: string,
    schedule?: Schedule,
    firstIn?: Date | null
  ): CalendarDay["status"] {
    if (dateStr > todayStr) return "future";
    if (!schedule) return "off_duty";
    if (schedule.type === ScheduleType.LEAVE) return "leave";
    if (schedule.type === ScheduleType.SHIFTING) return "shifting";
    if (!firstIn) return "absent";
    return this.isLateTimeIn(dateStr, schedule.shiftStartTime, firstIn)
      ? "late"
      : "present";
  }

  /**
   * Validate that the date range does not exceed 1 year (Requirement 9.12).
   */
  private validateDateRange(dateFrom?: string, dateTo?: string): void {
    if (!dateFrom || !dateTo) return;
    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException("Invalid date format.");
    }
    if (end < start) {
      throw new BadRequestException("End date must be after start date.");
    }
    if (end.getTime() - start.getTime() > ONE_YEAR_MS) {
      throw new BadRequestException("Date range must not exceed 1 year.");
    }
  }

  /**
   * Build a base query builder scoped by role and filters.
   */
  private buildBaseQuery(
    query: QueryReportsDto,
    currentUser: AuthenticatedUser
  ) {
    const qb = this.attendanceRepo
      .createQueryBuilder("ar")
      .leftJoinAndSelect("ar.personnel", "personnel")
      .leftJoinAndSelect("personnel.station", "station")
      .orderBy("ar.createdAt", "DESC");

    // Role-based scoping (Requirements 9.10, 9.11)
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
      qb.andWhere("ar.createdAt >= :dateFrom", {
        dateFrom: new Date(query.dateFrom),
      });
    }

    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setHours(23, 59, 59, 999);
      qb.andWhere("ar.createdAt <= :dateTo", { dateTo: end });
    }

    return qb;
  }

  /**
   * Map an AttendanceRecord to a ReportItem.
   */
  private toReportItem(record: AttendanceRecord): ReportItem {
    const personnel = record.personnel;
    const station = (personnel as any)?.station;
    return {
      id: record.id,
      personnelId: record.personnelId,
      personnelName: personnel
        ? `${personnel.firstName} ${personnel.lastName}`
        : "Unknown",
      rank: personnel?.rank ?? "",
      section: personnel?.section ?? "",
      station: station?.name ?? "",
      date: record.createdAt.toISOString().slice(0, 10),
      timeIn:
        record.type === AttendanceType.TimeIn
          ? record.createdAt.toISOString()
          : null,
      timeOut:
        record.type === AttendanceType.TimeOut
          ? record.createdAt.toISOString()
          : null,
      totalHours: null, // Calculated in export/monthly summary
      type: record.type,
      status: record.status,
      confidence: record.confidence,
    };
  }

  /**
   * GET /api/v1/reports
   * Filtered report with pagination, scoped by role.
   * Requirements: 9.2, 9.3, 9.10, 9.11
   */
  async getReports(
    query: QueryReportsDto,
    currentUser: AuthenticatedUser
  ): Promise<PaginatedResult<ReportItem>> {
    this.validateDateRange(query.dateFrom, query.dateTo);

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const qb = this.buildBaseQuery(query, currentUser).skip(skip).take(limit);

    const [records, total] = await qb.getManyAndCount();

    return {
      items: records.map((r) => this.toReportItem(r)),
      total,
      page,
      limit,
    };
  }

  /**
   * GET /api/v1/reports/monthly
   * Monthly summary: days present, absent, late, hours worked.
   * Requirements: 9.8, 9.9
   */
  async getMonthlySummary(
    query: QueryReportsDto,
    currentUser: AuthenticatedUser
  ): Promise<MonthlySummaryItem[]> {
    this.validateDateRange(query.dateFrom, query.dateTo);

    const qb = this.buildBaseQuery(query, currentUser);
    const records = await qb.getMany();

    // Group records by personnelId + year + month
    const grouped = new Map<
      string,
      {
        personnel: Personnel;
        station: any;
        timeIns: AttendanceRecord[];
        timeOuts: AttendanceRecord[];
      }
    >();

    for (const record of records) {
      const personnel = record.personnel;
      if (!personnel) continue;
      const d = record.createdAt;
      const key = `${record.personnelId}-${d.getFullYear()}-${
        d.getMonth() + 1
      }`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          personnel,
          station: (personnel as any).station,
          timeIns: [],
          timeOuts: [],
        });
      }

      const group = grouped.get(key)!;
      if (record.type === AttendanceType.TimeIn) {
        group.timeIns.push(record);
      } else {
        group.timeOuts.push(record);
      }
    }

    const results: MonthlySummaryItem[] = [];

    for (const [key, group] of grouped.entries()) {
      const [personnelIdStr, yearStr, monthStr] = key.split("-");
      const personnelId = parseInt(personnelIdStr, 10);
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const { personnel, station, timeIns, timeOuts } = group;

      // Days present: distinct local dates with at least one confirmed time_in
      const confirmedTimeIns = timeIns.filter(
        (r) => r.status === AttendanceStatus.Confirmed
      );
      const presentDays = new Set(
        confirmedTimeIns.map((r) => this.localDateStr(r.createdAt))
      );
      const daysPresent = presentDays.size;

      // Days absent: only count days where a REGULAR schedule was assigned
      // (excludes leave, shifting, and days with no schedule)
      const startStr = `${year}-${String(month).padStart(2, "0")}-01`;
      const daysInMonth = new Date(year, month, 0).getDate();
      const endStr = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
      const scheduledDays = await this.scheduleRepo.find({
        where: {
          personnelId,
          type: ScheduleType.REGULAR,
        },
        select: ["date"],
      });
      // Filter to only dates within the queried month
      const regularDates = new Set(
        scheduledDays.map((s) => s.date).filter((d) => d >= startStr && d <= endStr)
      );
      const daysAbsent = Math.max(
        0,
        [...regularDates].filter((d) => !presentDays.has(d)).length
      );

      // Late arrivals: confirmed time_ins after shift start time
      // Fetch schedules to compare against — 1-minute grace to avoid rounding issues
      const scheduleRows = await this.scheduleRepo.find({
        where: { personnelId, type: ScheduleType.REGULAR },
        select: ["date", "shiftStartTime"],
      });
      const scheduleByDate = new Map(scheduleRows.map((s) => [s.date, s.shiftStartTime]));
      let lateArrivals = 0;
      for (const r of confirmedTimeIns) {
        const dateStr = this.localDateStr(r.createdAt);
        const shiftStartStr = scheduleByDate.get(dateStr);
        if (!shiftStartStr) continue;
        const [shH, shM] = shiftStartStr.split(":").map(Number);
        const shiftStart = new Date(r.createdAt);
        shiftStart.setHours(shH, shM, 0, 0);
        const graceMs = SHIFT_GRACE_MINUTES * 60 * 1000;
        if (r.createdAt.getTime() > shiftStart.getTime() + graceMs) {
          lateArrivals++;
        }
      }

      // Total hours worked: pair each time_in with next time_out on same day
      const totalHoursWorked = this.calculateTotalHours(timeIns, timeOuts);

      results.push({
        personnelId,
        personnelName: `${personnel.firstName} ${personnel.lastName}`,
        rank: personnel.rank,
        station: station?.name ?? "",
        year,
        month,
        daysPresent,
        daysAbsent,
        lateArrivals,
        totalHoursWorked,
      });
    }

    return results;
  }

  /**
   * Helper: format a Date as local YYYY-MM-DD (avoids UTC offset shifting the date).
   */
  private localDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  /**
   * Count working days (Mon–Fri) in a given year/month.
   */
  private countWorkingDays(year: number, month: number): number {
    const daysInMonth = new Date(year, month, 0).getDate();
    let count = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const dow = new Date(year, month - 1, day).getDay();
      if (dow !== 0 && dow !== 6) count++;
    }
    return count;
  }

  /**
   * Pair each time_in with the next time_out on the same day and sum hours.
   */
  private calculateTotalHours(
    timeIns: AttendanceRecord[],
    timeOuts: AttendanceRecord[]
  ): number {
    let totalMs = 0;

    // Group time_outs by local date (avoid UTC date shift for PHT)
    const timeOutsByDate = new Map<string, Date[]>();
    for (const r of timeOuts) {
      const dateKey = this.localDateStr(r.createdAt);
      if (!timeOutsByDate.has(dateKey)) timeOutsByDate.set(dateKey, []);
      timeOutsByDate.get(dateKey)!.push(r.createdAt);
    }

    // For each time_in, find the next time_out on the same local day
    for (const r of timeIns) {
      const dateKey = this.localDateStr(r.createdAt);
      const outs = timeOutsByDate.get(dateKey) ?? [];
      const nextOut = outs
        .filter((t) => t > r.createdAt)
        .sort((a, b) => a.getTime() - b.getTime())[0];
      if (nextOut) {
        totalMs += nextOut.getTime() - r.createdAt.getTime();
      }
    }

    return Math.round((totalMs / (1000 * 60 * 60)) * 100) / 100;
  }

  /**
   * GET /api/v1/reports/export
   * Generate and stream Excel file.
   * Requirements: 9.6, 9.7
   */
  async exportReports(
    query: QueryReportsDto,
    currentUser: AuthenticatedUser,
    res: Response
  ): Promise<void> {
    this.validateDateRange(query.dateFrom, query.dateTo);
    const range = this.resolveExportDateRange(query);
    const period = query.reportPeriod ?? "monthly";

    const personnelQb = this.buildScopedPersonnelQuery(
      currentUser,
      query.stationId
    ).orderBy("p.lastName", "ASC");
    if (query.personnelId) {
      personnelQb.andWhere("p.id = :personnelId", {
        personnelId: query.personnelId,
      });
    }

    const personnelList = await personnelQb.getMany();
    const personnelIds = personnelList.map((person) => person.id);

    const records =
      personnelIds.length === 0
        ? []
        : await this.attendanceRepo
            .createQueryBuilder("ar")
            .where("ar.personnelId IN (:...personnelIds)", { personnelIds })
            .andWhere("ar.status = :status", {
              status: AttendanceStatus.Confirmed,
            })
            .andWhere("ar.createdAt >= :startDate")
            .andWhere("ar.createdAt <= :endDate")
            .setParameters({
              startDate: range.startDate,
              endDate: range.endDate,
            })
            .orderBy("ar.createdAt", "ASC")
            .getMany();

    const schedules =
      personnelIds.length === 0
        ? []
        : await this.scheduleRepo
            .createQueryBuilder("s")
            .where("s.personnelId IN (:...personnelIds)", { personnelIds })
            .andWhere("s.date >= :startStr AND s.date <= :endStr", {
              startStr: range.startStr,
              endStr: range.endStr,
            })
            .getMany();

    const exportRows = this.filterExportRowsByStatus(
      this.buildDtrExportRows(
      personnelList,
      records,
      schedules,
      range
      ),
      query.exportStatus
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "FRAS-BFPSorsogon";
    workbook.company = "BFP Sorsogon";
    workbook.created = new Date();
    workbook.modified = new Date();

    if (query.personnelId && personnelList.length === 1) {
      this.writeSinglePersonnelDtrWorksheet(
        workbook,
        exportRows,
        personnelList[0],
        query,
        currentUser,
        range,
        period
      );
    } else {
      this.writeDtrWorksheet(
        workbook,
        exportRows,
        query,
        currentUser,
        range,
        period
      );
    }
    this.writeSummaryWorksheet(workbook, "Daily Summary", exportRows, "daily");
    this.writeSummaryWorksheet(workbook, "Weekly Summary", exportRows, "weekly");
    this.writeSummaryWorksheet(workbook, "Monthly Summary", exportRows, "monthly");
    this.writeSummaryWorksheet(workbook, "Yearly Summary", exportRows, "yearly");
    this.writeExceptionsSummaryWorksheet(workbook, exportRows);
    this.writeAuditTrailWorksheet(
      workbook,
      query,
      currentUser,
      range,
      exportRows,
      personnelList
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${this.buildExportFilename(
        query,
        personnelList.length === 1 ? personnelList[0] : undefined
      )}"`
    );
    await workbook.xlsx.write(res);

    res.end();
  }

  private buildExportFilename(
    query: QueryReportsDto,
    personnel?: Personnel
  ): string {
    const start = query.dateFrom ?? "all";
    const end = query.dateTo ?? "all";
    const period = query.reportPeriod ?? "monthly";
    const scope = personnel
      ? this.slugifyFilenamePart(
          `${personnel.rank}-${personnel.firstName}-${personnel.lastName}`
        )
      : "all-personnel";
    const status = query.exportStatus ?? "all-statuses";
    return `dtr-${period}-${status}-${scope}-${start}-to-${end}.xlsx`;
  }

  private slugifyFilenamePart(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  private buildExportSubtitle(
    query: QueryReportsDto,
    currentUser: AuthenticatedUser,
    rowCount: number
  ): string {
    const range = query.dateFrom && query.dateTo
      ? `${query.dateFrom} to ${query.dateTo}`
      : "All available dates";
    const stationScope =
      currentUser.role === "station_user"
        ? "Station-scoped export"
        : query.stationId
          ? `Filtered by station #${query.stationId}`
          : "All stations";
    const personnelScope = query.personnelId
      ? `Personnel #${query.personnelId}`
      : "All personnel";
    const periodScope = `Period: ${query.reportPeriod ?? "monthly"}`;
    const statusScope = query.exportStatus
      ? `Status: ${this.formatExportStatus(query.exportStatus)}`
      : "All statuses";
    return `${range} | ${stationScope} | ${personnelScope} | ${periodScope} | ${statusScope} | ${rowCount} personnel-day${rowCount === 1 ? "" : "s"}`;
  }

  private formatExportStatus(status: ExportStatus): string {
    return status
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  private formatDateTime(date: Date): string {
    return new Intl.DateTimeFormat("en-PH", {
      year: "numeric",
      month: "long",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  private formatDisplayDate(dateStr: string): string {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Intl.DateTimeFormat("en-PH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(new Date(year, month - 1, day));
  }

  private formatSection(section?: string): string {
    if (!section) return "";
    return section
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  private buildThinBorder(): Partial<ExcelJS.Borders> {
    return {
      top: { style: "thin", color: { argb: BORDER_COLOR } },
      left: { style: "thin", color: { argb: BORDER_COLOR } },
      bottom: { style: "thin", color: { argb: BORDER_COLOR } },
      right: { style: "thin", color: { argb: BORDER_COLOR } },
    };
  }

  private buildMediumBorder(): Partial<ExcelJS.Borders> {
    return {
      top: { style: "medium", color: { argb: "FF111827" } },
      left: { style: "medium", color: { argb: "FF111827" } },
      bottom: { style: "medium", color: { argb: "FF111827" } },
      right: { style: "medium", color: { argb: "FF111827" } },
    };
  }

  /**
   * Format a Date as 12-hour time (e.g. "8:00 AM", "5:00 PM") using local time.
   */
  private formatTime12h(d: Date): string {
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const period = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    const minuteStr = String(minutes).padStart(2, "0");
    return `${hours}:${minuteStr} ${period}`;
  }

  private resolveExportDateRange(query: QueryReportsDto): ExportDateRange {
    const now = new Date();
    const startStr =
      query.dateFrom ??
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const endStr = query.dateTo ?? this.localDateStr(now);

    return {
      startStr,
      endStr,
      startDate: this.parseLocalDate(startStr),
      endDate: this.parseLocalDate(endStr, true),
    };
  }

  private parseLocalDate(dateStr: string, endOfDay = false): Date {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(
      year,
      month - 1,
      day,
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0
    );
  }

  private listDateStrings(range: ExportDateRange): string[] {
    const dates: string[] = [];
    const cursor = this.parseLocalDate(range.startStr);
    const end = this.parseLocalDate(range.endStr);

    while (cursor.getTime() <= end.getTime()) {
      dates.push(this.localDateStr(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    return dates;
  }

  private formatDayName(dateStr: string): string {
    return new Intl.DateTimeFormat("en-PH", { weekday: "short" }).format(
      this.parseLocalDate(dateStr)
    );
  }

  private formatSchedule(schedule?: Schedule): string {
    if (!schedule) return "No Schedule";
    const label =
      schedule.type === ScheduleType.REGULAR
        ? "Regular"
        : schedule.type === ScheduleType.SHIFTING
          ? "Shifting"
          : "Leave";
    return `${label} ${schedule.shiftStartTime.slice(0, 5)}-${schedule.shiftEndTime.slice(0, 5)}`;
  }

  private isLateTimeIn(
    dateStr: string,
    shiftStartTime: string,
    firstIn: Date
  ): boolean {
    const shiftStart = this.parseLocalDate(dateStr);
    const [hours, minutes, seconds] = shiftStartTime.split(":").map(Number);
    shiftStart.setHours(hours, minutes, seconds ?? 0, 0);
    const graceMs = SHIFT_GRACE_MINUTES * 60 * 1000;
    return firstIn.getTime() > shiftStart.getTime() + graceMs;
  }

  private calculateRowHours(firstIn: Date | null, lastOut: Date | null): number {
    if (!firstIn || !lastOut || lastOut <= firstIn) return 0;
    const hours = (lastOut.getTime() - firstIn.getTime()) / (1000 * 60 * 60);
    return Math.round(hours * 100) / 100;
  }

  private resolveDtrStatus(
    dateStr: string,
    schedule: Schedule | undefined,
    firstIn: Date | null
  ): DtrExportRow["status"] {
    if (!schedule) return "Off Duty";
    if (schedule.type === ScheduleType.LEAVE) return "Leave";
    if (schedule.type === ScheduleType.SHIFTING) return "Shifting";
    if (dateStr > this.localDateStr(new Date()) && !firstIn) return "Scheduled";
    if (!firstIn) return "Absent";
    return this.isLateTimeIn(dateStr, schedule.shiftStartTime, firstIn)
      ? "Late"
      : "Present";
  }

  private buildDtrExportRows(
    personnelList: Personnel[],
    records: AttendanceRecord[],
    schedules: Schedule[],
    range: ExportDateRange
  ): DtrExportRow[] {
    const dateStrings = this.listDateStrings(range);
    const scheduleMap = new Map<string, Schedule>();
    const attendanceMap = new Map<string, { timeIns: Date[]; timeOuts: Date[] }>();

    for (const schedule of schedules) {
      scheduleMap.set(`${schedule.personnelId}-${schedule.date}`, schedule);
    }

    for (const record of records) {
      const dateStr = this.localDateStr(record.createdAt);
      const key = `${record.personnelId}-${dateStr}`;
      if (!attendanceMap.has(key)) {
        attendanceMap.set(key, { timeIns: [], timeOuts: [] });
      }
      const entry = attendanceMap.get(key)!;
      if (record.type === AttendanceType.TimeIn) {
        entry.timeIns.push(record.createdAt);
      } else {
        entry.timeOuts.push(record.createdAt);
      }
    }

    const rows: DtrExportRow[] = [];
    for (const person of personnelList) {
      const station = (person as any).station;
      const personnelName = `${person.firstName} ${person.lastName}`;

      for (const date of dateStrings) {
        const key = `${person.id}-${date}`;
        const attendance = attendanceMap.get(key);
        const timeIns = [...(attendance?.timeIns ?? [])].sort(
          (a, b) => a.getTime() - b.getTime()
        );
        const timeOuts = [...(attendance?.timeOuts ?? [])].sort(
          (a, b) => a.getTime() - b.getTime()
        );
        const firstIn = timeIns[0] ?? null;
        const lastOut = timeOuts[timeOuts.length - 1] ?? null;
        const schedule = scheduleMap.get(key);
        const status = this.resolveDtrStatus(date, schedule, firstIn);

        rows.push({
          personnelId: person.id,
          personnelName,
          rank: person.rank,
          section: this.formatSection(person.section),
          station: station?.name ?? "",
          date,
          dayName: this.formatDayName(date),
          schedule: this.formatSchedule(schedule),
          timeIn: firstIn ? this.formatTime12h(firstIn) : "",
          timeOut: lastOut ? this.formatTime12h(lastOut) : "",
          hoursWorked: this.calculateRowHours(firstIn, lastOut),
          status,
          remarks:
            status === "Absent"
              ? "No confirmed time-in for scheduled duty"
              : status === "Late"
                ? `Time-in exceeded ${SHIFT_GRACE_MINUTES}-minute grace period`
                : status === "Scheduled"
                  ? "Future scheduled duty"
                  : "",
        });
      }
    }

    return rows;
  }

  private filterExportRowsByStatus(
    rows: DtrExportRow[],
    exportStatus?: ExportStatus
  ): DtrExportRow[] {
    if (!exportStatus) return rows;

    const statusMap: Record<ExportStatus, DtrExportRow["status"]> = {
      present: "Present",
      late: "Late",
      absent: "Absent",
      leave: "Leave",
      shifting: "Shifting",
      off_duty: "Off Duty",
      scheduled: "Scheduled",
    };

    return rows.filter((row) => row.status === statusMap[exportStatus]);
  }

  private styleHeaderRow(row: ExcelJS.Row): void {
    row.height = 22;
    row.font = { bold: true, color: { argb: HEADER_FONT } };
    row.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    row.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_FILL },
    };
    row.eachCell((cell) => {
      cell.border = this.buildThinBorder();
    });
  }

  private writeTitleBlock(
    sheet: ExcelJS.Worksheet,
    title: string,
    subtitle: string,
    lastColumn: string
  ): void {
    sheet.mergeCells(`A1:${lastColumn}1`);
    sheet.getCell("A1").value = title;
    sheet.getCell("A1").font = {
      bold: true,
      size: 16,
      color: { argb: HEADER_FONT },
    };
    sheet.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    sheet.getCell("A1").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_FILL },
    };

    sheet.mergeCells(`A2:${lastColumn}2`);
    sheet.getCell("A2").value = subtitle;
    sheet.getCell("A2").font = {
      size: 10,
      italic: true,
      color: { argb: "FF475569" },
    };
    sheet.getCell("A2").alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };

    sheet.mergeCells(`A3:${lastColumn}3`);
    sheet.getCell("A3").value = `Generated on ${this.formatDateTime(new Date())}`;
    sheet.getCell("A3").font = { size: 10, color: { argb: "FF64748B" } };
    sheet.getCell("A3").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
  }

  private writeDtrWorksheet(
    workbook: ExcelJS.Workbook,
    rows: DtrExportRow[],
    query: QueryReportsDto,
    currentUser: AuthenticatedUser,
    range: ExportDateRange,
    period: ReportPeriod
  ): void {
    const sheet = workbook.addWorksheet("DTR Form");
    this.writeTitleBlock(
      sheet,
      "Daily Time Record",
      this.buildExportSubtitle(query, currentUser, rows.length),
      "K"
    );

    sheet.mergeCells("A4:K4");
    sheet.getCell("A4").value =
      `Primary report period: ${period.toUpperCase()} | Coverage: ${range.startStr} to ${range.endStr}`;
    sheet.getCell("A4").font = { bold: true, color: { argb: "FF1F2937" } };
    sheet.getCell("A4").alignment = { horizontal: "center" };
    sheet.getCell("A4").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ACCENT_FILL },
    };

    sheet.columns = [
      { header: "Personnel", key: "personnelName", width: 28 },
      { header: "Rank", key: "rank", width: 14 },
      { header: "Station", key: "station", width: 22 },
      { header: "Date", key: "date", width: 13 },
      { header: "Day", key: "dayName", width: 10 },
      { header: "Schedule", key: "schedule", width: 22 },
      { header: "Time In", key: "timeIn", width: 12 },
      { header: "Time Out", key: "timeOut", width: 12 },
      { header: "Hours", key: "hoursWorked", width: 10 },
      { header: "Status", key: "status", width: 12 },
      { header: "Remarks", key: "remarks", width: 34 },
    ];

    const headerRow = sheet.getRow(6);
    headerRow.values = [
      "Personnel",
      "Rank",
      "Station",
      "Date",
      "Day",
      "Schedule",
      "Time In",
      "Time Out",
      "Hours",
      "Status",
      "Remarks",
    ];
    this.styleHeaderRow(headerRow);

    for (const row of rows) {
      sheet.addRow(row);
    }

    if (rows.length === 0) {
      sheet.mergeCells("A7:K7");
      const emptyCell = sheet.getCell("A7");
      emptyCell.value = "No personnel found for the selected export filters.";
      emptyCell.alignment = { horizontal: "center", vertical: "middle" };
      emptyCell.font = { italic: true, color: { argb: "FF64748B" } };
      emptyCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: ACCENT_FILL },
      };
      emptyCell.border = this.buildThinBorder();
    }

    for (let rowNumber = 7; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      row.height = 20;
      row.eachCell((cell, colNumber) => {
        cell.alignment = {
          vertical: "middle",
          horizontal: colNumber >= 4 && colNumber <= 10 ? "center" : "left",
          wrapText: true,
        };
        cell.border = this.buildThinBorder();
        if (rowNumber % 2 === 0) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: EVEN_ROW_FILL },
          };
        }
      });
    }

    const signatureStart = sheet.rowCount + 3;
    sheet.mergeCells(`A${signatureStart}:C${signatureStart}`);
    sheet.mergeCells(`E${signatureStart}:G${signatureStart}`);
    sheet.mergeCells(`I${signatureStart}:K${signatureStart}`);
    sheet.getCell(`A${signatureStart}`).value = "Prepared by:";
    sheet.getCell(`E${signatureStart}`).value = "Certified Correct:";
    sheet.getCell(`I${signatureStart}`).value = "Approved by:";
    sheet.getCell(`A${signatureStart + 1}`).value = query.preparedBy ?? "";
    sheet.getCell(`E${signatureStart + 1}`).value = query.certifiedBy ?? "";
    sheet.getCell(`I${signatureStart + 1}`).value = query.approvedBy ?? "";
    for (const cellRef of [`A${signatureStart + 1}`, `E${signatureStart + 1}`, `I${signatureStart + 1}`]) {
      sheet.getCell(cellRef).alignment = { horizontal: "center" };
    }
    for (const cellRef of [`A${signatureStart + 2}`, `E${signatureStart + 2}`, `I${signatureStart + 2}`]) {
      sheet.getCell(cellRef).border = {
        bottom: { style: "thin", color: { argb: "FF1F2937" } },
      };
    }

    sheet.views = [{ state: "frozen", ySplit: 6 }];
    sheet.autoFilter = "A6:K6";
  }

  private writeSinglePersonnelDtrWorksheet(
    workbook: ExcelJS.Workbook,
    rows: DtrExportRow[],
    personnel: Personnel,
    query: QueryReportsDto,
    currentUser: AuthenticatedUser,
    range: ExportDateRange,
    period: ReportPeriod
  ): void {
    const sheet = workbook.addWorksheet("DTR Form");
    const fullName = `${personnel.firstName} ${personnel.lastName}`;
    const station = (personnel as any).station?.name ?? "";

    sheet.columns = [
      { width: 8 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 11 },
      { width: 11 },
      { width: 14 },
      { width: 30 },
    ];

    sheet.mergeCells("A1:I1");
    sheet.getCell("A1").value = "Civil Service Form No. 48";
    sheet.getCell("A1").font = { italic: true, size: 9 };

    sheet.mergeCells("A2:I2");
    sheet.getCell("A2").value = "DAILY TIME RECORD";
    sheet.getCell("A2").font = { bold: true, size: 16 };
    sheet.getCell("A2").alignment = { horizontal: "center" };

    sheet.mergeCells("A3:I3");
    sheet.getCell("A3").value = "----- o0o -----";
    sheet.getCell("A3").alignment = { horizontal: "center" };

    sheet.mergeCells("B5:H5");
    sheet.getCell("B5").value = fullName;
    sheet.getCell("B5").font = { bold: true, size: 12 };
    sheet.getCell("B5").alignment = { horizontal: "center" };
    sheet.getCell("B5").border = {
      bottom: { style: "medium", color: { argb: "FF111827" } },
    };

    sheet.mergeCells("B6:H6");
    sheet.getCell("B6").value = "(Name)";
    sheet.getCell("B6").alignment = { horizontal: "center" };
    sheet.getCell("B6").font = { size: 9 };

    sheet.mergeCells("A8:C8");
    sheet.getCell("A8").value = `For the period of ${range.startStr} to ${range.endStr}`;
    sheet.getCell("A8").font = { italic: true, size: 9 };

    sheet.mergeCells("D8:I8");
    sheet.getCell("D8").value =
      `${personnel.rank} | ${station} | Primary report period: ${period.toUpperCase()}`;
    sheet.getCell("D8").alignment = { horizontal: "right" };
    sheet.getCell("D8").font = { size: 9 };

    sheet.mergeCells("A10:A11");
    sheet.getCell("A10").value = "Day";
    sheet.mergeCells("B10:C10");
    sheet.getCell("B10").value = "A.M.";
    sheet.mergeCells("D10:E10");
    sheet.getCell("D10").value = "P.M.";
    sheet.mergeCells("F10:G10");
    sheet.getCell("F10").value = "Undertime";
    sheet.mergeCells("H10:H11");
    sheet.getCell("H10").value = "Status";
    sheet.mergeCells("I10:I11");
    sheet.getCell("I10").value = "Remarks";

    const subHeader = sheet.getRow(11);
    subHeader.getCell(2).value = "Arrival";
    subHeader.getCell(3).value = "Departure";
    subHeader.getCell(4).value = "Arrival";
    subHeader.getCell(5).value = "Departure";
    subHeader.getCell(6).value = "Hours";
    subHeader.getCell(7).value = "Minutes";

    for (let rowNumber = 10; rowNumber <= 11; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      row.font = { bold: true, size: 9 };
      row.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      for (let col = 1; col <= 9; col++) {
        row.getCell(col).border = this.buildMediumBorder();
      }
    }

    const dtrRows = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    let rowNumber = 12;
    for (const row of dtrRows) {
      const excelRow = sheet.getRow(rowNumber);
      const day = Number(row.date.slice(-2));
      const isAmIn = row.timeIn && !row.timeIn.includes("PM");
      const isPmIn = row.timeIn && row.timeIn.includes("PM");
      const isAmOut = row.timeOut && !row.timeOut.includes("PM");
      const isPmOut = row.timeOut && row.timeOut.includes("PM");

      excelRow.values = [
        day,
        isAmIn ? row.timeIn : "",
        isAmOut ? row.timeOut : "",
        isPmIn ? row.timeIn : "",
        isPmOut ? row.timeOut : "",
        "",
        "",
        row.status,
        row.remarks,
      ];
      excelRow.height = 20;
      excelRow.eachCell((cell, colNumber) => {
        cell.alignment = {
          horizontal: colNumber === 9 ? "left" : "center",
          vertical: "middle",
          wrapText: true,
        };
        cell.border = this.buildMediumBorder();
        if (row.status === "Absent" || row.status === "Late") {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: row.status === "Absent" ? "FFFFE5E5" : "FFFFF4D6" },
          };
        }
      });
      rowNumber += 1;
    }

    const footerRow = rowNumber + 2;
    sheet.mergeCells(`A${footerRow}:I${footerRow}`);
    sheet.getCell(`A${footerRow}`).value =
      "I certify on my honor that the above is a true and correct report of the hours of work performed.";
    sheet.getCell(`A${footerRow}`).alignment = { wrapText: true };

    sheet.mergeCells(`B${footerRow + 3}:H${footerRow + 3}`);
    sheet.getCell(`B${footerRow + 3}`).value = query.preparedBy ?? "";
    sheet.getCell(`B${footerRow + 3}`).alignment = { horizontal: "center" };
    sheet.getCell(`B${footerRow + 3}`).border = {
      bottom: { style: "medium", color: { argb: "FF111827" } },
    };
    sheet.mergeCells(`B${footerRow + 4}:H${footerRow + 4}`);
    sheet.getCell(`B${footerRow + 4}`).value = "Employee Signature";
    sheet.getCell(`B${footerRow + 4}`).alignment = { horizontal: "center" };

    sheet.mergeCells(`B${footerRow + 7}:H${footerRow + 7}`);
    sheet.getCell(`B${footerRow + 7}`).value =
      query.certifiedBy ?? query.approvedBy ?? "";
    sheet.getCell(`B${footerRow + 7}`).alignment = { horizontal: "center" };
    sheet.getCell(`B${footerRow + 7}`).border = {
      bottom: { style: "medium", color: { argb: "FF111827" } },
    };
    sheet.mergeCells(`B${footerRow + 8}:H${footerRow + 8}`);
    sheet.getCell(`B${footerRow + 8}`).value = "Verified as to the prescribed office hours";
    sheet.getCell(`B${footerRow + 8}`).alignment = { horizontal: "center" };

    sheet.pageSetup = {
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      paperSize: 9,
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.3,
        bottom: 0.3,
        header: 0.1,
        footer: 0.1,
      },
    };
    sheet.views = [{ state: "frozen", ySplit: 11 }];
  }

  private getSummaryKey(row: DtrExportRow, period: ReportPeriod): string {
    const date = this.parseLocalDate(row.date);
    if (period === "daily") return row.date;
    if (period === "monthly") return row.date.slice(0, 7);
    if (period === "yearly") return row.date.slice(0, 4);

    const weekStart = new Date(date);
    const day = weekStart.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    weekStart.setDate(weekStart.getDate() + diff);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return `${this.localDateStr(weekStart)} to ${this.localDateStr(weekEnd)}`;
  }

  private writeSummaryWorksheet(
    workbook: ExcelJS.Workbook,
    sheetName: string,
    rows: DtrExportRow[],
    period: ReportPeriod
  ): void {
    const sheet = workbook.addWorksheet(sheetName);
    this.writeTitleBlock(
      sheet,
      `${sheetName} - COA Attendance Summary`,
      "Derived from confirmed attendance, schedule assignments, late arrivals after grace period, and absent no-time-in personnel-days.",
      "J"
    );

    sheet.columns = [
      { header: "Period", key: "period", width: 24 },
      { header: "Present", key: "present", width: 12 },
      { header: "Late", key: "late", width: 12 },
      { header: "Absent", key: "absent", width: 12 },
      { header: "Leave", key: "leave", width: 12 },
      { header: "Shifting", key: "shifting", width: 12 },
      { header: "Off Duty", key: "offDuty", width: 12 },
      { header: "Scheduled", key: "scheduled", width: 12 },
      { header: "Total Hours", key: "totalHours", width: 14 },
      { header: "Personnel-Days", key: "personnelDays", width: 16 },
    ];

    const headerRow = sheet.getRow(5);
    headerRow.values = [
      "Period",
      "Present",
      "Late",
      "Absent",
      "Leave",
      "Shifting",
      "Off Duty",
      "Scheduled",
      "Total Hours",
      "Personnel-Days",
    ];
    this.styleHeaderRow(headerRow);

    const grouped = new Map<
      string,
      {
        present: number;
        late: number;
        absent: number;
        leave: number;
        shifting: number;
        offDuty: number;
        scheduled: number;
        totalHours: number;
        personnelDays: number;
      }
    >();

    for (const row of rows) {
      const key = this.getSummaryKey(row, period);
      if (!grouped.has(key)) {
        grouped.set(key, {
          present: 0,
          late: 0,
          absent: 0,
          leave: 0,
          shifting: 0,
          offDuty: 0,
          scheduled: 0,
          totalHours: 0,
          personnelDays: 0,
        });
      }
      const summary = grouped.get(key)!;
      summary.personnelDays += 1;
      summary.totalHours += row.hoursWorked;
      if (row.status === "Present") summary.present += 1;
      if (row.status === "Late") summary.late += 1;
      if (row.status === "Absent") summary.absent += 1;
      if (row.status === "Leave") summary.leave += 1;
      if (row.status === "Shifting") summary.shifting += 1;
      if (row.status === "Off Duty") summary.offDuty += 1;
      if (row.status === "Scheduled") summary.scheduled += 1;
    }

    for (const [key, summary] of [...grouped.entries()].sort()) {
      sheet.addRow({
        period: key,
        ...summary,
        totalHours: Math.round(summary.totalHours * 100) / 100,
      });
    }

    for (let rowNumber = 6; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      row.eachCell((cell, colNumber) => {
        cell.alignment = {
          vertical: "middle",
          horizontal: colNumber === 1 ? "left" : "center",
        };
        cell.border = this.buildThinBorder();
        if (rowNumber % 2 === 0) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: EVEN_ROW_FILL },
          };
        }
      });
    }

    sheet.views = [{ state: "frozen", ySplit: 5 }];
    sheet.autoFilter = "A5:J5";
  }

  private writeExceptionsSummaryWorksheet(
    workbook: ExcelJS.Workbook,
    rows: DtrExportRow[]
  ): void {
    const sheet = workbook.addWorksheet("Exceptions Summary");
    this.writeTitleBlock(
      sheet,
      "Exceptions Summary",
      "Late, absent, missing time-out, incomplete, and schedule exception records for COA review.",
      "H"
    );

    sheet.columns = [
      { header: "Personnel", key: "personnelName", width: 28 },
      { header: "Rank", key: "rank", width: 14 },
      { header: "Station", key: "station", width: 22 },
      { header: "Date", key: "date", width: 13 },
      { header: "Time In", key: "timeIn", width: 12 },
      { header: "Time Out", key: "timeOut", width: 12 },
      { header: "Exception", key: "exception", width: 18 },
      { header: "Remarks", key: "remarks", width: 40 },
    ];

    const headerRow = sheet.getRow(5);
    headerRow.values = [
      "Personnel",
      "Rank",
      "Station",
      "Date",
      "Time In",
      "Time Out",
      "Exception",
      "Remarks",
    ];
    this.styleHeaderRow(headerRow);

    const exceptionRows = rows
      .map((row) => {
        const exception = this.resolveExceptionLabel(row);
        if (!exception) return null;
        return {
          personnelName: row.personnelName,
          rank: row.rank,
          station: row.station,
          date: row.date,
          timeIn: row.timeIn,
          timeOut: row.timeOut,
          exception,
          remarks: row.remarks || this.buildExceptionRemark(row, exception),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    for (const row of exceptionRows) {
      sheet.addRow(row);
    }

    if (exceptionRows.length === 0) {
      sheet.mergeCells("A6:H6");
      const emptyCell = sheet.getCell("A6");
      emptyCell.value = "No exceptions found for the selected export filters.";
      emptyCell.alignment = { horizontal: "center", vertical: "middle" };
      emptyCell.font = { italic: true, color: { argb: "FF64748B" } };
      emptyCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: ACCENT_FILL },
      };
      emptyCell.border = this.buildThinBorder();
    }

    for (let rowNumber = 6; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      row.eachCell((cell, colNumber) => {
        cell.alignment = {
          horizontal: colNumber >= 4 && colNumber <= 7 ? "center" : "left",
          vertical: "middle",
          wrapText: true,
        };
        cell.border = this.buildThinBorder();
        if (rowNumber % 2 === 0) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: EVEN_ROW_FILL },
          };
        }
      });
    }

    sheet.views = [{ state: "frozen", ySplit: 5 }];
    sheet.autoFilter = "A5:H5";
  }

  private resolveExceptionLabel(row: DtrExportRow): string | null {
    if (row.status === "Late") return "Late";
    if (row.status === "Absent") return "Absent";
    if (row.status === "Off Duty" && (row.timeIn || row.timeOut)) {
      return "No Schedule";
    }
    if (row.status === "Present" && row.timeIn && !row.timeOut) {
      return "Missing Time Out";
    }
    if (row.status === "Present" && !row.timeIn && row.timeOut) {
      return "Missing Time In";
    }
    return null;
  }

  private buildExceptionRemark(row: DtrExportRow, exception: string): string {
    if (exception === "Missing Time Out") return "Confirmed time-in with no matching time-out.";
    if (exception === "Missing Time In") return "Confirmed time-out with no matching time-in.";
    if (exception === "No Schedule") return "Attendance was recorded but no schedule was assigned.";
    return row.remarks;
  }

  private writeAuditTrailWorksheet(
    workbook: ExcelJS.Workbook,
    query: QueryReportsDto,
    currentUser: AuthenticatedUser,
    range: ExportDateRange,
    rows: DtrExportRow[],
    personnelList: Personnel[]
  ): void {
    const sheet = workbook.addWorksheet("Audit Trail");
    this.writeTitleBlock(
      sheet,
      "Audit Trail",
      "Export provenance and filters used to generate this workbook.",
      "B"
    );

    sheet.columns = [
      { header: "Field", key: "field", width: 32 },
      { header: "Value", key: "value", width: 72 },
    ];
    const headerRow = sheet.getRow(5);
    headerRow.values = ["Field", "Value"];
    this.styleHeaderRow(headerRow);

    const selectedPersonnel = query.personnelId
      ? personnelList.find((person) => person.id === query.personnelId)
      : undefined;
    const personnelValue = selectedPersonnel
      ? `${selectedPersonnel.rank} ${selectedPersonnel.firstName} ${selectedPersonnel.lastName}`
      : "All personnel";

    const rowsByStatus = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    }, {});

    const auditRows = [
      ["Generated At", this.formatDateTime(new Date())],
      ["Generated By User ID", String(currentUser.id)],
      ["User Role", currentUser.role],
      ["User Station ID", currentUser.stationId ? String(currentUser.stationId) : "All/None"],
      ["Coverage", `${range.startStr} to ${range.endStr}`],
      ["Report Period", query.reportPeriod ?? "monthly"],
      ["Export Status Filter", query.exportStatus ? this.formatExportStatus(query.exportStatus) : "All statuses"],
      ["Personnel Scope", personnelValue],
      ["Station Filter", query.stationId ? String(query.stationId) : "All stations"],
      ["Total Export Rows", String(rows.length)],
      ["Status Counts", Object.entries(rowsByStatus).map(([status, count]) => `${status}: ${count}`).join(", ") || "None"],
      ["Prepared By", query.preparedBy ?? ""],
      ["Certified By", query.certifiedBy ?? ""],
      ["Approved By", query.approvedBy ?? ""],
      ["Notes", "Absent and Late are derived from assigned regular schedules and confirmed time-in records."],
    ];

    for (const [field, value] of auditRows) {
      sheet.addRow({ field, value });
    }

    for (let rowNumber = 6; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      row.eachCell((cell, colNumber) => {
        cell.alignment = {
          vertical: "middle",
          horizontal: colNumber === 1 ? "right" : "left",
          wrapText: true,
        };
        cell.border = this.buildThinBorder();
      });
      row.getCell(1).font = { bold: true };
    }

    sheet.views = [{ state: "frozen", ySplit: 5 }];
  }

  /**
   * GET /api/v1/reports/calendar
   * Monthly calendar attendance view per personnel.
   */
  async getCalendar(
    query: QueryCalendarDto,
    currentUser: AuthenticatedUser
  ): Promise<CalendarPersonnelItem[]> {
    const { year, month } = query;
    const daysInMonth = new Date(year, month, 0).getDate();

    // Determine the date range for the month
    const startStr = `${year}-${String(month).padStart(2, "0")}-01`;
    const endStr = `${year}-${String(month).padStart(2, "0")}-${String(
      daysInMonth
    ).padStart(2, "0")}`;
    // Use local midnight bounds to avoid UTC offset shifting dates (e.g. PHT = UTC+8)
    const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(year, month - 1, daysInMonth, 23, 59, 59, 999);

    // Fetch personnel scoped by role
    const personnelList = await this.buildScopedPersonnelQuery(
      currentUser,
      query.stationId
    ).getMany();
    if (personnelList.length === 0) return [];

    const personnelIds = personnelList.map((p) => p.id);

    // Fetch schedules for the month
    const schedules = await this.scheduleRepo
      .createQueryBuilder("s")
      .where("s.personnelId IN (:...personnelIds)", { personnelIds })
      .andWhere("s.date >= :startStr AND s.date <= :endStr", {
        startStr,
        endStr,
      })
      .getMany();

    // Fetch attendance (time_in) for the month
    const attendanceRecords = await this.attendanceRepo
      .createQueryBuilder("ar")
      .where("ar.personnelId IN (:...personnelIds)", { personnelIds })
      .andWhere("ar.type = :type", { type: AttendanceType.TimeIn })
      .andWhere("ar.createdAt >= :startDate AND ar.createdAt <= :endDate", {
        startDate,
        endDate,
      })
      .getMany();

    const now = new Date();
    const todayStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);

    const results: CalendarPersonnelItem[] = [];

    for (const p of personnelList) {
      const pSchedules = schedules.filter((s) => s.personnelId === p.id);
      const pAttendance = attendanceRecords.filter(
        (a) => a.personnelId === p.id
      );
      const firstInByDate = new Map<string, Date>();
      for (const attendance of pAttendance) {
        const localDate = this.localDateStr(attendance.createdAt);
        const previous = firstInByDate.get(localDate);
        if (!previous || attendance.createdAt < previous) {
          firstInByDate.set(localDate, attendance.createdAt);
        }
      }

      const calendar: CalendarDay[] = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(
          day
        ).padStart(2, "0")}`;
        const sched = pSchedules.find((s) => s.date === dateStr);
        const firstIn = firstInByDate.get(dateStr) ?? null;
        calendar.push({
          date: dateStr,
          status: this.classifyPersonnelDay(
            dateStr,
            todayStr,
            sched,
            firstIn
          ),
        });
      }

      results.push({
        personnelId: p.id,
        name: `${p.firstName} ${p.lastName}`,
        rank: p.rank,
        station: (p as any).station?.name ?? "",
        imagePath: p.imagePath ?? null,
        calendar,
      });
    }

    return results;
  }

  async getCalendarDateSummary(
    query: QueryCalendarDto,
    currentUser: AuthenticatedUser
  ): Promise<CalendarDateSummaryItem[]> {
    const { year, month } = query;
    const daysInMonth = new Date(year, month, 0).getDate();
    const startStr = `${year}-${String(month).padStart(2, "0")}-01`;
    const endStr = `${year}-${String(month).padStart(2, "0")}-${String(
      daysInMonth
    ).padStart(2, "0")}`;
    // Use local midnight bounds to avoid UTC offset shifting dates (e.g. PHT = UTC+8)
    const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(year, month - 1, daysInMonth, 23, 59, 59, 999);

    const personnelList = await this.buildScopedPersonnelQuery(
      currentUser,
      query.stationId
    ).getMany();
    if (personnelList.length === 0) return [];

    const personnelIds = personnelList.map((p) => p.id);
    const schedules = await this.scheduleRepo
      .createQueryBuilder("s")
      .where("s.personnelId IN (:...personnelIds)", { personnelIds })
      .andWhere("s.date >= :startStr AND s.date <= :endStr", {
        startStr,
        endStr,
      })
      .getMany();

    const attendanceRecords = await this.attendanceRepo
      .createQueryBuilder("ar")
      .where("ar.personnelId IN (:...personnelIds)", { personnelIds })
      .andWhere("ar.type = :type", { type: AttendanceType.TimeIn })
      .andWhere("ar.status = :status", { status: AttendanceStatus.Confirmed })
      .andWhere("ar.createdAt >= :startDate AND ar.createdAt <= :endDate", {
        startDate,
        endDate,
      })
      .getMany();

    const todayStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);

    const scheduleMap = new Map<string, Schedule>();
    for (const schedule of schedules) {
      scheduleMap.set(`${schedule.personnelId}-${schedule.date}`, schedule);
    }

    const attendanceMap = new Map<string, Date>();
    for (const record of attendanceRecords) {
      // Use local date to avoid UTC offset shifting the date (e.g. PHT = UTC+8)
      const d = record.createdAt;
      const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const key = `${record.personnelId}-${localDate}`;
      const previous = attendanceMap.get(key);
      if (!previous || record.createdAt < previous) {
        attendanceMap.set(key, record.createdAt);
      }
    }

    const summaryByDate = new Map<string, CalendarDateSummaryItem>();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;

      summaryByDate.set(dateStr, {
        date: dateStr,
        isFuture: dateStr > todayStr,
        presentCount: 0,
        lateCount: 0,
        absentCount: 0,
        shiftingCount: 0,
        leaveCount: 0,
        offDutyCount: 0,
        presentPersonnel: [],
        latePersonnel: [],
        absentPersonnel: [],
        shiftingPersonnel: [],
        leavePersonnel: [],
        offDutyPersonnel: [],
      });
    }

    for (const person of personnelList) {
      const detail: CalendarDayPersonnelDetail = {
        personnelId: person.id,
        name: `${person.firstName} ${person.lastName}`,
        rank: person.rank,
        station: (person as any).station?.name ?? "",
        imagePath: person.imagePath ?? null,
      };

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(
          day
        ).padStart(2, "0")}`;
        const schedule = scheduleMap.get(`${person.id}-${dateStr}`);
        const firstIn = attendanceMap.get(`${person.id}-${dateStr}`) ?? null;
        const status = this.classifyPersonnelDay(
          dateStr,
          todayStr,
          schedule,
          firstIn
        );
        const summary = summaryByDate.get(dateStr);

        if (!summary || status === "future") continue;

        if (status === "present") {
          summary.presentCount += 1;
          summary.presentPersonnel.push(detail);
        } else if (status === "late") {
          summary.lateCount += 1;
          summary.latePersonnel.push(detail);
        } else if (status === "absent") {
          summary.absentCount += 1;
          summary.absentPersonnel.push(detail);
        } else if (status === "shifting") {
          summary.shiftingCount += 1;
          summary.shiftingPersonnel.push(detail);
        } else if (status === "leave") {
          summary.leaveCount += 1;
          summary.leavePersonnel.push(detail);
        } else if (status === "off_duty") {
          summary.offDutyCount += 1;
          summary.offDutyPersonnel.push(detail);
        }
      }
    }

    return Array.from(summaryByDate.values());
  }
}
