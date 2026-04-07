import "reflect-metadata";
import * as dotenv from "dotenv";
import * as bcrypt from "bcrypt";
import { DataSource } from "typeorm";
import { User, UserRole } from "../database/entities/user.entity";
import { Station } from "../stations/station.entity";
import { Personnel } from "../database/entities/personnel.entity";
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

const SALT_ROUNDS = 12;

async function seedUser(
  userRepo: ReturnType<typeof dataSource.getRepository<User>>,
  data: {
    username: string;
    email: string;
    password: string;
    role: UserRole;
    stationId: number | null;
    mustChangePassword?: boolean;
  }
) {
  const hash = await bcrypt.hash(data.password, SALT_ROUNDS);
  const user = userRepo.create({
    username: data.username,
    email: data.email,
    passwordHash: hash,
    role: data.role,
    stationId: data.stationId,
    isActive: true,
    mustChangePassword: data.mustChangePassword ?? true,
  });
  await userRepo.save(user);
}

const personnelNames = [
  "Eric Hermosa",
  "Roel J. Jintalan",
  "Danilo Das",
  "Joseph L. Caubang",
  "Michelle A Lariosa",
  "Selina Navarro",
  "Janet Jasareno",
  "Gldys J. Bercasio-Rotor",
  "Shiela Marie L. Jebulan",
  "Shanna Escultura",
  "Jacenth Gracilla",
  "Maria Theresa Venus",
  "Judy Ann Estropigan",
  "Senen Legaspi",
];

const ranks = ["FO1", "FO2", "FO3", "SFO1", "SFO2", "INSP", "CINSP", "SINSP"];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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
    "face_embeddings",
    "activity_log",
    "attendance_record",
    "pending_attendance",
    "personnel",
    "user",
    "station",
  ];

  for (const table of tablesToTruncate) {
    try {
      await queryRunner.query(`TRUNCATE TABLE ${table};`);
    } catch (e) {
      // Ignore if table doesn't exist
    }
  }

  await queryRunner.query("SET FOREIGN_KEY_CHECKS = 1;");

  const stationRepo = dataSource.getRepository(Station);
  const userRepo = dataSource.getRepository(User);
  const personnelRepo = dataSource.getRepository(Personnel);
  const attendanceRepo = dataSource.getRepository(AttendanceRecord);

  // Seed stations
  const stationDefs = [
    { name: "Sorsogon Central", location: "CENTRAL" },
    { name: "Talisay", location: "TALISAY" },
    { name: "Bacon", location: "BACON" },
    { name: "Abuyog", location: "ABUYOG" },
  ];

  const stationMap = new Map<string, number>();
  const stationIds: number[] = [];

  for (const s of stationDefs) {
    const station = await stationRepo.save(stationRepo.create(s));
    stationMap.set(s.location, station.id);
    stationIds.push(station.id);
  }

  console.log("Seeding admin and station accounts...");
  // Seed admin & users
  await seedUser(userRepo, {
    username: "admin",
    email: "admin@bfpsorsogon.gov.ph",
    password: "Admin123!",
    role: UserRole.Admin,
    stationId: null,
  });
  await seedUser(userRepo, {
    username: "central_station",
    email: "central@bfpsorsogon.gov.ph",
    password: "Station123!",
    role: UserRole.StationUser,
    stationId: stationMap.get("CENTRAL") ?? null,
  });
  await seedUser(userRepo, {
    username: "kiosk_central",
    email: "kioskcentral@bfpsorsogon.gov.ph",
    password: "Kiosk123!",
    role: UserRole.Kiosk,
    stationId: stationMap.get("CENTRAL") ?? null,
    mustChangePassword: false,
  });

  console.log("Seeding personnel...");
  const today = new Date();

  for (const fullName of personnelNames) {
    const parts = fullName.split(" ");
    const lastName = parts.pop() || "";
    const firstName = parts.join(" ");

    const rank = getRandomItem(ranks);
    const stationId = getRandomItem(stationIds);

    const personnel = await personnelRepo.save(
      personnelRepo.create({
        firstName,
        lastName,
        rank,
        stationId,
        isActive: true,
        dateCreated: new Date(),
      })
    );

    // Generate Attendance Records
    const attendanceRecordsToInsert = [];
    for (let i = 35; i >= 0; i--) {
      const logDate = new Date(today);
      logDate.setDate(today.getDate() - i);

      const dayOfWeek = logDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

      // Maybe randomly absent (10% chance)
      if (Math.random() < 0.1) continue;

      // Time in between 7:30 and 8:30
      const timeInHour = 7;
      const timeInMin = randomInt(30, 59);
      const timeInSec = randomInt(0, 59);
      const timeInDate = new Date(logDate);
      timeInDate.setHours(timeInHour, timeInMin, timeInSec, 0);

      attendanceRecordsToInsert.push({
        personnelId: personnel.id,
        type: AttendanceType.TimeIn,
        status: AttendanceStatus.Confirmed,
        isManual: false,
        confidence: parseFloat((0.85 + Math.random() * 0.14).toFixed(2)), // 0.85 to 0.99
        createdAt: timeInDate,
      });

      // Time out between 17:00 and 18:30
      // 5% chance forgot to time out
      if (Math.random() > 0.05) {
        const timeOutHour = randomInt(17, 18);
        const timeOutMin = randomInt(0, 59);
        const timeOutSec = randomInt(0, 59);
        const timeOutDate = new Date(logDate);
        timeOutDate.setHours(timeOutHour, timeOutMin, timeOutSec, 0);

        // Make sure it's after time in
        if (timeOutDate.getTime() > timeInDate.getTime()) {
          attendanceRecordsToInsert.push({
            personnelId: personnel.id,
            type: AttendanceType.TimeOut,
            status: AttendanceStatus.Confirmed,
            isManual: false,
            confidence: parseFloat((0.85 + Math.random() * 0.14).toFixed(2)),
            createdAt: timeOutDate,
          });
        }
      }
    }

    // Batch insert for performance
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
