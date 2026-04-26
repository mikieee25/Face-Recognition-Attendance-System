import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, Between } from "typeorm";
import { Schedule, ScheduleType } from "../database/entities/schedule.entity";
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
  late: number;
  shifting: number;
  onLeave: number;
}

export interface DailySummary {
  date: string;
  present: number;
  late: number;
  shifting: number;
  onLeave: number;
}

export interface PersonnelAttendanceRow {
  personnelId: number;
  name: string;
  rank: string;
  stationName: string;
  imagePath: string | null;
  coverImagePath: string | null;
  section: string;
  status: "present" | "late" | "shifting" | "on_leave" | "off_duty";
}

export interface RecentRecord {
  id: number;
  personnelName: string;
  rank: string;
  type: string;
  status: string;
  createdAt: Date;
  imagePath: string | null;
  coverImagePath: string | null;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(AttendanceRecord)
    private readonly attendanceRepo: Repository<AttendanceRecord>,
    @InjectRepository(Personnel)
    private readonly personnelRepo: Repository<Personnel>,
    @InjectRepository(Schedule)
    private readonly scheduleRepo: Repository<Schedule>,
  ) {}

  /**
   * Helper to format date as YYYY-MM-DD string.
   */
  private getLocalDayStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0",
    )}-${String(d.getDate()).padStart(2, "0")}`;
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
   * Today's present/late/shifting/on-leave counts scoped by role.
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
      return { present: 0, late: 0, shifting: 0, onLeave: 0 };
    }

    const personnelIds = allPersonnel.map((p) => p.id);

    // Any confirmed time-in for the day means the personnel attended today.
    const todayRecords = await this.attendanceRepo
      .createQueryBuilder("ar")
      .where("ar.personnelId IN (:...personnelIds)", { personnelIds })
      .andWhere("ar.status = :status", { status: AttendanceStatus.Confirmed })
      .andWhere("ar.createdAt >= :startOfDay", { startOfDay })
      .andWhere("ar.createdAt <= :endOfDay", { endOfDay })
      .orderBy("ar.createdAt", "DESC")
      .getMany();

    const attendedIds = new Set(
      todayRecords
        .filter((r) => r.type === AttendanceType.TimeIn)
        .map((r) => r.personnelId),
    );

    const dateStr = this.getLocalDayStr(today);
    const schedules = await this.scheduleRepo.find({
      where: {
        date: dateStr,
        personnelId: In(personnelIds),
      },
    });
    const scheduleMap = new Map<number, ScheduleType>();
    for (const s of schedules) {
      scheduleMap.set(s.personnelId, s.type);
    }

    let present = 0;
    let late = 0;
    let shifting = 0;
    let onLeave = 0;

    for (const p of allPersonnel) {
      if (attendedIds.has(p.id)) {
        present++;
      } else {
        const type = scheduleMap.get(p.id);
        if (type === ScheduleType.SHIFTING) {
          shifting++;
        } else if (type === ScheduleType.LEAVE) {
          onLeave++;
        } else if (type === ScheduleType.REGULAR) {
          late++;
        }
      }
    }

    return { present, late, shifting, onLeave };
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
      .andWhere("ar.status = :status", { status: AttendanceStatus.Confirmed })
      .andWhere("ar.createdAt >= :from", { from })
      .andWhere("ar.createdAt <= :to", { to })
      .orderBy("ar.createdAt", "DESC")
      .getMany();

    const recordsByDate = new Map<string, Set<number>>();
    for (const r of records) {
      if (r.type !== AttendanceType.TimeIn) continue;

      const key = this.getLocalDayStr(r.createdAt);
      if (!recordsByDate.has(key)) {
        recordsByDate.set(key, new Set());
      }
      recordsByDate.get(key)!.add(r.personnelId);
    }

    const schedules = await this.scheduleRepo.find({
      where: {
        personnelId: In(personnelIds),
        date: Between(this.getLocalDayStr(from), this.getLocalDayStr(to)),
      },
    });
    const scheduleMap = new Map<string, Map<number, ScheduleType>>();
    for (const s of schedules) {
      if (!scheduleMap.has(s.date)) {
        scheduleMap.set(s.date, new Map());
      }
      scheduleMap.get(s.date)!.set(s.personnelId, s.type);
    }

    const summaries: DailySummary[] = [];
    const cursor = new Date(from);
    while (cursor <= to) {
      const dateKey = this.getLocalDayStr(cursor);
      const presentIds = recordsByDate.get(dateKey) ?? new Set();
      const dailySchedules =
        scheduleMap.get(dateKey) ?? new Map<number, ScheduleType>();

      let present = 0;
      let late = 0;
      let shifting = 0;
      let onLeave = 0;

      for (const p of allPersonnel) {
        if (presentIds.has(p.id)) {
          present++;
        } else {
          const type = dailySchedules.get(p.id);
          if (type === ScheduleType.SHIFTING) {
            shifting++;
          } else if (type === ScheduleType.LEAVE) {
            onLeave++;
          } else if (type === ScheduleType.REGULAR) {
            late++;
          }
        }
      }

      summaries.push({ date: dateKey, present, late, shifting, onLeave });
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
      .andWhere("ar.status = :status", { status: AttendanceStatus.Confirmed })
      .andWhere("ar.createdAt >= :startOfDay", { startOfDay })
      .andWhere("ar.createdAt <= :endOfDay", { endOfDay })
      .orderBy("ar.createdAt", "DESC")
      .getMany();

    const presentIds = new Set(
      records
        .filter((r) => r.type === AttendanceType.TimeIn)
        .map((r) => r.personnelId),
    );

    const dateStr = this.getLocalDayStr(targetDate);
    const schedules = await this.scheduleRepo.find({
      where: {
        date: dateStr,
        personnelId: In(personnelIds),
      },
    });
    const scheduleMap = new Map<number, ScheduleType>();
    for (const s of schedules) {
      scheduleMap.set(s.personnelId, s.type);
    }

    const rows: PersonnelAttendanceRow[] = allPersonnel.map((p) => {
      let personnelStatus: PersonnelAttendanceRow["status"];
      if (presentIds.has(p.id)) {
        personnelStatus = "present";
      } else {
        const type = scheduleMap.get(p.id);
        if (type === ScheduleType.SHIFTING) {
          personnelStatus = "shifting";
        } else if (type === ScheduleType.LEAVE) {
          personnelStatus = "on_leave";
        } else if (type === ScheduleType.REGULAR) {
          personnelStatus = "late";
        } else {
          personnelStatus = "off_duty";
        }
      }

      return {
        personnelId: p.id,
        name: `${p.firstName} ${p.lastName}`,
        rank: p.rank,
        stationName: (p as any).station?.name ?? "Unknown",
        imagePath: p.imagePath ?? null,
        coverImagePath: p.coverImagePath ?? null,
        section: p.section,
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
      imagePath: r.personnel?.imagePath ?? null,
      coverImagePath: r.personnel?.coverImagePath ?? null,
    }));
  }
}
