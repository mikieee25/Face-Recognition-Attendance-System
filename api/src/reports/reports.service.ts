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
import { QueryReportsDto } from "./dto/query-reports.dto";

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

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(AttendanceRecord)
    private readonly attendanceRepo: Repository<AttendanceRecord>,
    @InjectRepository(Personnel)
    private readonly personnelRepo: Repository<Personnel>,
  ) {}

  /**
   * Validate that the date range does not exceed 1 year (Requirement 9.12).
   */
  private validateDateRange(startDate?: string, endDate?: string): void {
    if (!startDate || !endDate) return;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException("Invalid date format.");
    }
    if (end < start) {
      throw new BadRequestException("endDate must be after startDate.");
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
    currentUser: AuthenticatedUser,
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

    if (query.startDate) {
      qb.andWhere("ar.createdAt >= :startDate", {
        startDate: new Date(query.startDate),
      });
    }

    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      qb.andWhere("ar.createdAt <= :endDate", { endDate: end });
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
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<ReportItem>> {
    this.validateDateRange(query.startDate, query.endDate);

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
    currentUser: AuthenticatedUser,
  ): Promise<MonthlySummaryItem[]> {
    this.validateDateRange(query.startDate, query.endDate);

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
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const { personnel, station, timeIns, timeOuts } = group;

      // Days present: distinct days with at least one confirmed time_in
      const confirmedTimeIns = timeIns.filter(
        (r) => r.status === AttendanceStatus.Confirmed,
      );
      const presentDays = new Set(
        confirmedTimeIns.map((r) => r.createdAt.toISOString().slice(0, 10)),
      );
      const daysPresent = presentDays.size;

      // Working days in the month (Mon–Fri)
      const workingDays = this.countWorkingDays(year, month);
      const daysAbsent = Math.max(0, workingDays - daysPresent);

      // Late arrivals: time_in after shift_start_time
      let lateArrivals = 0;
      if (personnel.shiftStartTime) {
        const [shiftHour, shiftMinute] = personnel.shiftStartTime
          .split(":")
          .map(Number);
        for (const record of confirmedTimeIns) {
          const timeIn = record.createdAt;
          const shiftStart = new Date(
            timeIn.getFullYear(),
            timeIn.getMonth(),
            timeIn.getDate(),
            shiftHour,
            shiftMinute,
            0,
          );
          if (timeIn > shiftStart) lateArrivals++;
        }
      }

      // Total hours worked: pair each time_in with next time_out on same day
      const totalHoursWorked = this.calculateTotalHours(timeIns, timeOuts);

      results.push({
        personnelId: parseInt(personnelIdStr, 10),
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
    timeOuts: AttendanceRecord[],
  ): number {
    let totalMs = 0;

    // Group time_outs by date
    const timeOutsByDate = new Map<string, Date[]>();
    for (const r of timeOuts) {
      const dateKey = r.createdAt.toISOString().slice(0, 10);
      if (!timeOutsByDate.has(dateKey)) timeOutsByDate.set(dateKey, []);
      timeOutsByDate.get(dateKey)!.push(r.createdAt);
    }

    // For each time_in, find the next time_out on the same day
    for (const r of timeIns) {
      const dateKey = r.createdAt.toISOString().slice(0, 10);
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
    res: Response,
  ): Promise<void> {
    this.validateDateRange(query.startDate, query.endDate);

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
      { header: "Station", key: "station", width: 20 },
      { header: "Date", key: "date", width: 12 },
      { header: "Time In", key: "timeIn", width: 20 },
      { header: "Time Out", key: "timeOut", width: 20 },
      { header: "Total Hours", key: "totalHours", width: 12 },
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
        'attachment; filename="attendance-report.csv"',
      );
      await workbook.csv.write(res);
    } else {
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="attendance-report.xlsx"',
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

      let totalHours: number | string = "";
      if (firstIn && firstOut && firstOut > firstIn) {
        const ms = firstOut.getTime() - firstIn.getTime();
        totalHours = Math.round((ms / (1000 * 60 * 60)) * 100) / 100;
      }

      rows.push({
        personnelName: personnel
          ? `${personnel.firstName} ${personnel.lastName}`
          : "Unknown",
        rank: personnel?.rank ?? "",
        station: station?.name ?? "",
        date: record.createdAt.toISOString().slice(0, 10),
        timeIn: firstIn
          ? firstIn.toISOString().replace("T", " ").slice(0, 19)
          : "",
        timeOut: firstOut
          ? firstOut.toISOString().replace("T", " ").slice(0, 19)
          : "",
        totalHours,
        status: record.status,
      });
    }

    return rows;
  }
}
