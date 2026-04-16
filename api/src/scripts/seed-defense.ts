import "reflect-metadata";
import * as dotenv from "dotenv";
import { DataSource, In } from "typeorm";
import { User } from "../database/entities/user.entity";
import { Station } from "../stations/station.entity";
import {
  Personnel,
  PersonnelSection,
} from "../database/entities/personnel.entity";
import {
  AttendanceRecord,
  AttendanceType,
  AttendanceStatus,
} from "../database/entities/attendance.entity";
import { FaceEmbedding } from "../database/entities/face-data.entity";
import { ActivityLog } from "../database/entities/activity-log.entity";
import { Schedule } from "../database/entities/schedule.entity";

dotenv.config();

const dataSource = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST ?? "localhost",
  port: parseInt(process.env.DB_PORT ?? "3306", 10),
  username: process.env.DB_USER ?? "root",
  password: process.env.DB_PASS ?? "",
  database: process.env.DB_NAME ?? "bfp_sorsogon_attendance",
  entities: [
    User,
    Station,
    Personnel,
    AttendanceRecord,
    FaceEmbedding,
    ActivityLog,
    Schedule,
  ],
  logging: false,
});

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildTimeOnDate(
  date: Date,
  startMinutes: number,
  endMinutes: number
): Date {
  const minutes = randomInt(startMinutes, endMinutes);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const secs = randomInt(0, 59);
  const result = new Date(date);
  result.setHours(hours, mins, secs, 0);
  return result;
}

async function run() {
  console.log("Initializing data source...");
  await dataSource.initialize();

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();

  console.log("Disabling foreign keys and clearing database...");
  await queryRunner.query("SET FOREIGN_KEY_CHECKS = 0;");

  // Truncate tables
  const tablesToTruncate = [
    "schedule",
    "attendance_record",
    "pending_attendance",
  ];

  for (const table of tablesToTruncate) {
    try {
      await queryRunner.query(`TRUNCATE TABLE ${table};`);
    } catch (e) {
      // Ignore if table doesn't exist
    }
  }

  await queryRunner.query("SET FOREIGN_KEY_CHECKS = 1;");

  const personnelRepo = dataSource.getRepository(Personnel);
  const attendanceRepo = dataSource.getRepository(AttendanceRecord);

  console.log("Fetching personnel with IDs 1-14...");
  const targetPersonnel = await personnelRepo.find({
    where: { id: In(Array.from({ length: 14 }, (_, i) => i + 1)) },
  });

  console.log("Seeding attendance records for personnel IDs 1-14...");
  const today = new Date();
  const startDate = new Date(today.getFullYear(), 2, 9); // March 09
  const endDate = new Date(today);

  for (const personnel of targetPersonnel) {
    const attendanceRecordsToInsert = [];

    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      const logDate = new Date(d);
      const dayOfWeek = logDate.getDay();

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        continue;
      }

      // Time in between 7:30 and 8:30
      const timeInDate = buildTimeOnDate(logDate, 7 * 60 + 30, 8 * 60 + 30);

      attendanceRecordsToInsert.push({
        personnelId: personnel.id,
        type: AttendanceType.TimeIn,
        status: AttendanceStatus.Confirmed,
        isManual: false,
        confidence: parseFloat((0.85 + Math.random() * 0.14).toFixed(2)),
        createdAt: timeInDate,
      });

      // Time out between 17:00 and 17:30 (no missing out)
      const timeOutDate = buildTimeOnDate(logDate, 17 * 60, 17 * 60 + 30);

      attendanceRecordsToInsert.push({
        personnelId: personnel.id,
        type: AttendanceType.TimeOut,
        status: AttendanceStatus.Confirmed,
        isManual: false,
        confidence: parseFloat((0.85 + Math.random() * 0.14).toFixed(2)),
        createdAt: timeOutDate,
      });
    }

    if (attendanceRecordsToInsert.length > 0) {
      await attendanceRepo.save(
        attendanceRepo.create(attendanceRecordsToInsert)
      );
    }
  }

  await queryRunner.release();
  await dataSource.destroy();
  console.log(
    "Database cleared and successfully seeded with personnel and attendance records for defense!"
  );
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
