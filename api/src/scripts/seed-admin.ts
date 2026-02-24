import "reflect-metadata";
import * as dotenv from "dotenv";
import * as bcrypt from "bcrypt";
import { DataSource } from "typeorm";
import { User, UserRole } from "../database/entities/user.entity";
import { Station } from "../stations/station.entity";

dotenv.config();

const dataSource = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST ?? "localhost",
  port: parseInt(process.env.DB_PORT ?? "3306", 10),
  username: process.env.DB_USER ?? "root",
  password: process.env.DB_PASS ?? "",
  database: process.env.DB_NAME ?? "bfp_sorsogon_attendance",
  entities: [User, Station],
  logging: true,
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
  },
) {
  const exists = await userRepo.findOne({ where: { username: data.username } });
  if (exists) {
    console.log(`User already exists: ${data.username}`);
    return;
  }
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
  console.log(`Created user: ${data.username} (password: ${data.password})`);
}

async function run() {
  console.log("Initializing data source...");
  await dataSource.initialize();

  const stationRepo = dataSource.getRepository(Station);
  const userRepo = dataSource.getRepository(User);

  // Seed stations
  const stationDefs = [
    { name: "Sorsogon Central", location: "CENTRAL" },
    { name: "Talisay", location: "TALISAY" },
    { name: "Bacon", location: "BACON" },
    { name: "Abuyog", location: "ABUYOG" },
  ];

  const stationMap = new Map<string, number>();

  for (const s of stationDefs) {
    let station = await stationRepo.findOne({ where: { name: s.name } });
    if (!station) {
      station = await stationRepo.save(stationRepo.create(s));
      console.log(`Created station: ${s.name} (id: ${station.id})`);
    } else {
      console.log(`Station already exists: ${s.name} (id: ${station.id})`);
    }
    stationMap.set(s.location, station.id);
  }

  // Seed admin
  await seedUser(userRepo, {
    username: "admin",
    email: "admin@bfpsorsogon.gov.ph",
    password: "Admin123!",
    role: UserRole.Admin,
    stationId: null,
  });

  // Seed station user accounts
  await seedUser(userRepo, {
    username: "central_station",
    email: "central@bfpsorsogon.gov.ph",
    password: "Station123!",
    role: UserRole.StationUser,
    stationId: stationMap.get("CENTRAL") ?? null,
  });

  await seedUser(userRepo, {
    username: "talisay_station",
    email: "talisay@bfpsorsogon.gov.ph",
    password: "Station123!",
    role: UserRole.StationUser,
    stationId: stationMap.get("TALISAY") ?? null,
  });

  await seedUser(userRepo, {
    username: "bacon_station",
    email: "bacon@bfpsorsogon.gov.ph",
    password: "Station123!",
    role: UserRole.StationUser,
    stationId: stationMap.get("BACON") ?? null,
  });

  await seedUser(userRepo, {
    username: "abuyog_station",
    email: "abuyog@bfpsorsogon.gov.ph",
    password: "Station123!",
    role: UserRole.StationUser,
    stationId: stationMap.get("ABUYOG") ?? null,
  });

  // Seed kiosk account (Central station)
  await seedUser(userRepo, {
    username: "kiosk_central",
    email: "kioskcentral@bfpsorsogon.gov.ph",
    password: "Kiosk123!",
    role: UserRole.Kiosk,
    stationId: stationMap.get("CENTRAL") ?? null,
    mustChangePassword: false,
  });

  await dataSource.destroy();
  console.log("\nSeed complete.");
  console.log("\n--- Account Summary ---");
  console.log("Admin:    admin / Admin123!");
  console.log(
    "Stations: central_station, talisay_station, bacon_station, abuyog_station / Station123!",
  );
  console.log("Kiosk:    kiosk_central / Kiosk123!");
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
