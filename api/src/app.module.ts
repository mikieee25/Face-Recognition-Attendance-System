import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import configuration from "./config/configuration";
import { DatabaseModule } from "./database/database.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { PersonnelModule } from "./personnel/personnel.module";
import { StationsModule } from "./stations/stations.module";
import { AttendanceModule } from "./attendance/attendance.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { ReportsModule } from "./reports/reports.module";
import { KioskGuard } from "./common/guards/kiosk.guard";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds in ms
        limit: 10,
      },
    ]),
    DatabaseModule,
    AuthModule,
    UsersModule,
    PersonnelModule,
    StationsModule,
    AttendanceModule,
    DashboardModule,
    ReportsModule,
  ],
  providers: [
    // KioskGuard runs globally after JWT auth resolves the user.
    // Kiosk users are restricted to POST /api/v1/attendance/capture
    // and POST /api/v1/attendance/manual only (Requirements: 13.3–13.9).
    {
      provide: APP_GUARD,
      useClass: KioskGuard,
    },
  ],
})
export class AppModule {}
