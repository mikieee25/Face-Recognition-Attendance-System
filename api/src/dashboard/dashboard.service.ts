import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  AttendanceRecord,
  AttendanceStatus,
  AttendanceType,
} from "../database/entities/attendance.entity";
import { Personnel } from "../database/entities/personnel.entity";

export interface AuthenticatedUser {
  id: number;
  role: string;
  stationId: number | null;
}

export interface DashboardStats {
  present: number;
  absent: number;
  late: number;
  onTime: number;
}

export interface RecentRecord {
  id: number;
  personnelName: string;
  rank: string;
  type: string;
  status: string;
  createdAt: Date;
}

export interface ChartDataPoint {
  date: string;
  count: number;
}

export interface DashboardCharts {
  weekly: ChartDataPoint[];
  monthly: ChartDataPoint[];
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(AttendanceRecord)
    private readonly attendanceRepo: Repository<AttendanceRecord>,
    @InjectRepository(Personnel)
    private readonly personnelRepo: Repository<Personnel>,
  ) {}

  /**
   * GET /api/v1/dashboard/stats
   * Returns today's present/absent/late/on-time counts scoped by role.
   * Requirements: 8.2, 8.3, 8.4, 8.5
   */
  async getStats(currentUser: AuthenticatedUser): Promise<DashboardStats> {
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      0,
      0,
      0,
    );
    const endOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      23,
      59,
      59,
      999,
    );

    // Build personnel query scoped by role (Requirements 8.4, 8.5)
    const personnelQb = this.personnelRepo
      .createQueryBuilder("p")
      .where("p.isActive = :isActive", { isActive: true });

    if (currentUser.role === "station_user" && currentUser.stationId) {
      personnelQb.andWhere("p.stationId = :stationId", {
        stationId: currentUser.stationId,
      });
    }

    const allPersonnel = await personnelQb.getMany();
    const totalPersonnel = allPersonnel.length;

    if (totalPersonnel === 0) {
      return { present: 0, absent: 0, late: 0, onTime: 0 };
    }

    const personnelIds = allPersonnel.map((p) => p.id);

    // Get today's confirmed time_in records
    const todayRecordsQb = this.attendanceRepo
      .createQueryBuilder("ar")
      .where("ar.personnelId IN (:...personnelIds)", { personnelIds })
      .andWhere("ar.type = :type", { type: AttendanceType.TimeIn })
      .andWhere("ar.status = :status", { status: AttendanceStatus.Confirmed })
      .andWhere("ar.createdAt >= :startOfDay", { startOfDay })
      .andWhere("ar.createdAt <= :endOfDay", { endOfDay });

    const todayRecords = await todayRecordsQb.getMany();

    // Build a map of personnelId -> earliest time_in today
    const presentMap = new Map<number, Date>();
    for (const record of todayRecords) {
      const existing = presentMap.get(record.personnelId);
      if (!existing || record.createdAt < existing) {
        presentMap.set(record.personnelId, record.createdAt);
      }
    }

    const present = presentMap.size;
    const absent = totalPersonnel - present;

    // Determine late/on-time by comparing time_in against shift_start_time
    let late = 0;
    let onTime = 0;

    for (const [personnelId, timeIn] of presentMap.entries()) {
      const personnel = allPersonnel.find((p) => p.id === personnelId);
      if (!personnel || !personnel.shiftStartTime) {
        // No shift defined — count as on-time
        onTime++;
        continue;
      }

      // Parse shift start time (format: "HH:MM:SS" or "HH:MM")
      const [shiftHour, shiftMinute] = personnel.shiftStartTime
        .split(":")
        .map(Number);
      const shiftStart = new Date(
        timeIn.getFullYear(),
        timeIn.getMonth(),
        timeIn.getDate(),
        shiftHour,
        shiftMinute,
        0,
      );

      if (timeIn > shiftStart) {
        late++;
      } else {
        onTime++;
      }
    }

    return { present, absent, late, onTime };
  }

  /**
   * GET /api/v1/dashboard/recent
   * Returns last 10 confirmed attendance records scoped by role.
   * Requirement: 8.8
   */
  async getRecent(currentUser: AuthenticatedUser): Promise<RecentRecord[]> {
    const qb = this.attendanceRepo
      .createQueryBuilder("ar")
      .leftJoinAndSelect("ar.personnel", "personnel")
      .where("ar.status = :status", { status: AttendanceStatus.Confirmed })
      .orderBy("ar.createdAt", "DESC")
      .take(10);

    // Scope by role (Requirements 8.4, 8.5)
    if (currentUser.role === "station_user" && currentUser.stationId) {
      qb.andWhere("personnel.stationId = :stationId", {
        stationId: currentUser.stationId,
      });
    }

    const records = await qb.getMany();

    return records.map((r) => ({
      id: r.id,
      personnelName: r.personnel
        ? `${r.personnel.firstName} ${r.personnel.lastName}`
        : "Unknown",
      rank: r.personnel?.rank ?? "",
      type: r.type,
      status: r.status,
      createdAt: r.createdAt,
    }));
  }

  /**
   * GET /api/v1/dashboard/charts
   * Returns weekly (last 7 days) and monthly (last 30 days) attendance data scoped by role.
   * Requirement: 8.10
   */
  async getCharts(currentUser: AuthenticatedUser): Promise<DashboardCharts> {
    const now = new Date();

    // Last 7 days
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    // Last 30 days
    const monthStart = new Date(now);
    monthStart.setDate(monthStart.getDate() - 29);
    monthStart.setHours(0, 0, 0, 0);

    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const buildQuery = (from: Date) => {
      const qb = this.attendanceRepo
        .createQueryBuilder("ar")
        .leftJoin("ar.personnel", "personnel")
        .where("ar.status = :status", { status: AttendanceStatus.Confirmed })
        .andWhere("ar.createdAt >= :from", { from })
        .andWhere("ar.createdAt <= :to", { to: endOfToday });

      if (currentUser.role === "station_user" && currentUser.stationId) {
        qb.andWhere("personnel.stationId = :stationId", {
          stationId: currentUser.stationId,
        });
      }

      return qb;
    };

    const [weeklyRecords, monthlyRecords] = await Promise.all([
      buildQuery(weekStart).getMany(),
      buildQuery(monthStart).getMany(),
    ]);

    const aggregateByDay = (
      records: AttendanceRecord[],
      days: number,
    ): ChartDataPoint[] => {
      const countMap = new Map<string, number>();

      // Pre-fill all days with 0
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        countMap.set(key, 0);
      }

      for (const record of records) {
        const key = record.createdAt.toISOString().slice(0, 10);
        if (countMap.has(key)) {
          countMap.set(key, (countMap.get(key) ?? 0) + 1);
        }
      }

      return Array.from(countMap.entries()).map(([date, count]) => ({
        date,
        count,
      }));
    };

    return {
      weekly: aggregateByDay(weeklyRecords, 7),
      monthly: aggregateByDay(monthlyRecords, 30),
    };
  }
}
