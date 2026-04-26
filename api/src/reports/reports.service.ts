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
  status: "present" | "absent" | "late" | "leave" | "shifting" | "off_duty" | "future";
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
  shiftingCount: number;
  leaveCount: number;
  offDutyCount: number;
  presentPersonnel: CalendarDayPersonnelDetail[];
  latePersonnel: CalendarDayPersonnelDetail[];
  shiftingPersonnel: CalendarDayPersonnelDetail[];
  leavePersonnel: CalendarDayPersonnelDetail[];
  offDutyPersonnel: CalendarDayPersonnelDetail[];
}

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

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
    scheduleType?: ScheduleType,
    attended?: boolean
  ): CalendarDay["status"] {
    if (dateStr > todayStr) return "future";
    if (scheduleType === ScheduleType.LEAVE) return "leave";
    if (scheduleType === ScheduleType.SHIFTING) return "shifting";
    if (!scheduleType) return "off_duty";
    // Regular schedule: present if attended, late if no-show
    return attended ? "present" : "late";
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
        // 1-minute grace to avoid flagging punctual check-ins as late
        const graceMs = 60 * 1000;
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
   * Generate and stream Excel or CSV file.
   * Requirements: 9.6, 9.7
   */
  async exportReports(
    query: QueryReportsDto,
    currentUser: AuthenticatedUser,
    res: Response
  ): Promise<void> {
    this.validateDateRange(query.dateFrom, query.dateTo);

    const qb = this.buildBaseQuery(query, currentUser);
    const records = await qb.getMany();

    // Build export rows with paired time_in/time_out per day per personnel
    const exportRows = this.buildExportRows(records);

    const format = query.format ?? "excel";
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Attendance Report");

    // Define columns (Requirement 9.7)
    sheet.columns = [
      { header: "Personnel Name", key: "personnelName", width: 25 },
      { header: "Rank", key: "rank", width: 15 },
      { header: "Section", key: "section", width: 15 },
      { header: "Station", key: "station", width: 20 },
      { header: "Date", key: "date", width: 12 },
      { header: "Time In", key: "timeIn", width: 20 },
      { header: "Time Out", key: "timeOut", width: 20 },
      { header: "Status", key: "status", width: 12 },
    ];

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD9E1F2" },
    };

    // Add data rows
    for (const row of exportRows) {
      sheet.addRow(row);
    }

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="attendance-report.csv"'
      );
      await workbook.csv.write(res);
    } else {
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="attendance-report.xlsx"'
      );
      await workbook.xlsx.write(res);
    }

    res.end();
  }

  /**
   * Build export rows by pairing time_in/time_out records per personnel per day.
   */
  private buildExportRows(records: AttendanceRecord[]): any[] {
    // Group by personnelId + date
    const grouped = new Map<
      string,
      { record: AttendanceRecord; timeIns: Date[]; timeOuts: Date[] }
    >();

    for (const record of records) {
      const personnel = record.personnel;
      const dateKey = record.createdAt.toISOString().slice(0, 10);
      const key = `${record.personnelId}-${dateKey}`;

      if (!grouped.has(key)) {
        grouped.set(key, { record, timeIns: [], timeOuts: [] });
      }

      const group = grouped.get(key)!;
      if (record.type === AttendanceType.TimeIn) {
        group.timeIns.push(record.createdAt);
      } else {
        group.timeOuts.push(record.createdAt);
      }
    }

    const rows: any[] = [];

    for (const [, group] of grouped.entries()) {
      const { record, timeIns, timeOuts } = group;
      const personnel = record.personnel;
      const station = (personnel as any)?.station;

      const sortedIns = timeIns.sort((a, b) => a.getTime() - b.getTime());
      const sortedOuts = timeOuts.sort((a, b) => a.getTime() - b.getTime());

      const firstIn = sortedIns[0] ?? null;
      const firstOut = sortedOuts[0] ?? null;

      rows.push({
        personnelName: personnel
          ? `${personnel.firstName} ${personnel.lastName}`
          : "Unknown",
        rank: personnel?.rank ?? "",
        section: personnel?.section ?? "",
        station: station?.name ?? "",
        date: record.createdAt.toISOString().slice(0, 10),
        timeIn: firstIn
          ? firstIn.toISOString().replace("T", " ").slice(0, 19)
          : "",
        timeOut: firstOut
          ? firstOut.toISOString().replace("T", " ").slice(0, 19)
          : "",
        status: record.status,
      });
    }

    return rows;
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

      const calendar: CalendarDay[] = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(
          day
        ).padStart(2, "0")}`;
        const sched = pSchedules.find((s) => s.date === dateStr);
        // Compare using local date string to avoid UTC offset shifting the date
        const attended = pAttendance.some((a) => {
          const d = a.createdAt;
          const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          return localDateStr === dateStr;
        });
        calendar.push({
          date: dateStr,
          status: this.classifyPersonnelDay(
            dateStr,
            todayStr,
            sched?.type,
            attended
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

    const scheduleMap = new Map<string, ScheduleType>();
    for (const schedule of schedules) {
      scheduleMap.set(`${schedule.personnelId}-${schedule.date}`, schedule.type);
    }

    const attendanceMap = new Set<string>();
    for (const record of attendanceRecords) {
      // Use local date to avoid UTC offset shifting the date (e.g. PHT = UTC+8)
      const d = record.createdAt;
      const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      attendanceMap.add(`${record.personnelId}-${localDate}`);
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
        shiftingCount: 0,
        leaveCount: 0,
        offDutyCount: 0,
        presentPersonnel: [],
        latePersonnel: [],
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
        const scheduleType = scheduleMap.get(`${person.id}-${dateStr}`);
        const attended = attendanceMap.has(`${person.id}-${dateStr}`);
        const status = this.classifyPersonnelDay(
          dateStr,
          todayStr,
          scheduleType,
          attended
        );
        const summary = summaryByDate.get(dateStr);

        if (!summary || status === "future") continue;

        if (status === "present") {
          summary.presentCount += 1;
          summary.presentPersonnel.push(detail);
        } else if (status === "late") {
          summary.lateCount += 1;
          summary.latePersonnel.push(detail);
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
