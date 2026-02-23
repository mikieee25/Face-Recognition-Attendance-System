import "reflect-metadata";
import * as dotenv from "dotenv";
import { DataSource } from "typeorm";
import { InitialSchema1700000000000 } from "../database/migrations/1700000000000-InitialSchema";

dotenv.config();

const dataSource = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST ?? "localhost",
  port: parseInt(process.env.DB_PORT ?? "3306", 10),
  username: process.env.DB_USER ?? "root",
  password: process.env.DB_PASS ?? "",
  database: process.env.DB_NAME ?? "bfp_sorsogon_attendance",
  migrations: [InitialSchema1700000000000],
  logging: true,
});

async function run() {
  console.log("Initializing data source...");
  await dataSource.initialize();
  console.log("Running migrations...");
  await dataSource.runMigrations();
  console.log("Migrations complete.");
  await dataSource.destroy();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
