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
  shifting: number;
  onLeave: number;
}

export interface DailySummary {
  date: string;
  present: number;
  absent: number;
  shifting: number;
  onLeave: number;
}

export interface PersonnelAttendanceRow {
  personnelId: number;
  name: string;
  rank: string;
  stationName: string;
  status: "present" | "absent" | "shifting" | "on_leave";
}

export interface RecentRecord {
  id: number;
  personnelName: string;
  rank: string;
  type: string;
  status: string;
  createdAt: Date;
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
   * Determine if a personnel is currently in their shifting period.
   */
  private isShifting(personnel: Personnel, date: Date): boolean {
    if (!personnel.isShifting || !personnel.shiftStartDate) return false;
    const shiftStart = new Date(personnel.shiftStartDate);
    const durationDays = personnel.shiftDurationDays ?? 15;
    const shiftEnd = new Date(shiftStart);
    shiftEnd.setDate(shiftEnd.getDate() + durationDays);
    return date >= shiftStart && date < shiftEnd;
  }

  /**
   * Build a scoped personnel query based on user role.
   */
  private scopedPersonnelQb(currentUser: AuthenticatedUser) {
    const qb = this.personnelRepo
      .createQueryBuilder("p")
      .leftJoinAndSelect("p.station", "station")
      .where("p.isActive = :isActive", { isActive: true });

    if (currentUser.role === "station_user" && currentUser.stationId) {
      qb.andWhere("p.stationId = :stationId", {
        stationId: currentUser.stationId,
      });
    }
    return qb;
  }

  /**
   * GET /api/v1/dashboard/stats
   * Today's present/absent/shifting/on-leave counts scoped by role.
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

    const allPersonnel = await this.scopedPersonnelQb(currentUser).getMany();
    if (allPersonnel.length === 0) {
      return { present: 0, absent: 0, shifting: 0, onLeave: 0 };
    }

    const personnelIds = allPersonnel.map((p) => p.id);

    // Get today's confirmed time_in records
    const todayRecords = await this.attendanceRepo
      .createQueryBuilder("ar")
      .where("ar.personnelId IN (:...personnelIds)", { personnelIds })
      .andWhere("ar.type = :type", { type: AttendanceType.TimeIn })
      .andWhere("ar.status = :status", { status: AttendanceStatus.Confirmed })
      .andWhere("ar.createdAt >= :startOfDay", { startOfDay })
      .andWhere("ar.createdAt <= :endOfDay", { endOfDay })
      .getMany();

    const presentIds = new Set(todayRecords.map((r) => r.personnelId));

    let present = 0;
    let absent = 0;
    let shifting = 0;
    let onLeave = 0;

    for (const p of allPersonnel) {
      if (presentIds.has(p.id)) {
        present++;
      } else if (this.isShifting(p, today)) {
        shifting++;
      } else {
        // TODO: when on_leave status is tracked, count it here
        absent++;
      }
    }

    return { present, absent, shifting, onLeave };
  }

  /**
   * GET /api/v1/dashboard/summary
   * Daily attendance summary for a date range (default: this week).
   */
  async getSummary(
    currentUser: AuthenticatedUser,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<DailySummary[]> {
    const now = new Date();
    const to = dateTo ? new Date(dateTo) : now;
    const from = dateFrom
      ? new Date(dateFrom)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);

    const allPersonnel = await this.scopedPersonnelQb(currentUser).getMany();
    if (allPersonnel.length === 0) return [];

    const personnelIds = allPersonnel.map((p) => p.id);

    const records = await this.attendanceRepo
      .createQueryBuilder("ar")
      .where("ar.personnelId IN (:...personnelIds)", { personnelIds })
      .andWhere("ar.type = :type", { type: AttendanceType.TimeIn })
      .andWhere("ar.status = :status", { status: AttendanceStatus.Confirmed })
      .andWhere("ar.createdAt >= :from", { from })
      .andWhere("ar.createdAt <= :to", { to })
      .getMany();

    // Group records by date
    const recordsByDate = new Map<string, Set<number>>();
    for (const r of records) {
      const key = r.createdAt.toISOString().slice(0, 10);
      if (!recordsByDate.has(key)) recordsByDate.set(key, new Set());
      recordsByDate.get(key)!.add(r.personnelId);
    }

    const summaries: DailySummary[] = [];
    const cursor = new Date(from);
    while (cursor <= to) {
      const dateKey = cursor.toISOString().slice(0, 10);
      const presentIds = recordsByDate.get(dateKey) ?? new Set();

      let present = 0;
      let absent = 0;
      let shifting = 0;
      let onLeave = 0;

      for (const p of allPersonnel) {
        if (presentIds.has(p.id)) {
          present++;
        } else if (this.isShifting(p, cursor)) {
          shifting++;
        } else {
          absent++;
        }
      }

      summaries.push({ date: dateKey, present, absent, shifting, onLeave });
      cursor.setDate(cursor.getDate() + 1);
    }

    return summaries;
  }

  /**
   * GET /api/v1/dashboard/personnel-status
   * Personnel list with their status for a given date.
   */
  async getPersonnelStatus(
    currentUser: AuthenticatedUser,
    date?: string,
    status?: string,
  ): Promise<PersonnelAttendanceRow[]> {
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      0,
      0,
      0,
    );
    const endOfDay = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      23,
      59,
      59,
      999,
    );

    const allPersonnel = await this.scopedPersonnelQb(currentUser).getMany();
    if (allPersonnel.length === 0) return [];

    const personnelIds = allPersonnel.map((p) => p.id);

    const records = await this.attendanceRepo
      .createQueryBuilder("ar")
      .where("ar.personnelId IN (:...personnelIds)", { personnelIds })
      .andWhere("ar.type = :type", { type: AttendanceType.TimeIn })
      .andWhere("ar.status = :status", { status: AttendanceStatus.Confirmed })
      .andWhere("ar.createdAt >= :startOfDay", { startOfDay })
      .andWhere("ar.createdAt <= :endOfDay", { endOfDay })
      .getMany();

    const presentIds = new Set(records.map((r) => r.personnelId));

    const rows: PersonnelAttendanceRow[] = allPersonnel.map((p) => {
      let personnelStatus: PersonnelAttendanceRow["status"];
      if (presentIds.has(p.id)) {
        personnelStatus = "present";
      } else if (this.isShifting(p, targetDate)) {
        personnelStatus = "shifting";
      } else {
        personnelStatus = "absent";
      }

      return {
        personnelId: p.id,
        name: `${p.firstName} ${p.lastName}`,
        rank: p.rank,
        stationName: (p as any).station?.name ?? "Unknown",
        status: personnelStatus,
      };
    });

    // Filter by status if provided
    if (status) {
      return rows.filter((r) => r.status === status);
    }

    return rows;
  }

  /**
   * GET /api/v1/dashboard/recent
   * Last 10 confirmed attendance records scoped by role.
   */
  async getRecent(currentUser: AuthenticatedUser): Promise<RecentRecord[]> {
    const qb = this.attendanceRepo
      .createQueryBuilder("ar")
      .leftJoinAndSelect("ar.personnel", "personnel")
      .where("ar.status = :status", { status: AttendanceStatus.Confirmed })
      .orderBy("ar.createdAt", "DESC")
      .take(10);

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
}
