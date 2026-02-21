import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { User } from "./entities/user.entity";
import { Personnel } from "./entities/personnel.entity";
import { Attendance } from "./entities/attendance.entity";
import { PendingAttendance } from "./entities/pending-attendance.entity";
import { FaceData } from "./entities/face-data.entity";
import { ActivityLog } from "./entities/activity-log.entity";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: "mysql",
        host: configService.get<string>("database.host"),
        port: configService.get<number>("database.port"),
        username: configService.get<string>("database.username"),
        password: configService.get<string>("database.password"),
        database: configService.get<string>("database.database"),
        entities: [
          User,
          Personnel,
          Attendance,
          PendingAttendance,
          FaceData,
          ActivityLog,
        ],
        synchronize: false, // Never auto-sync — schema already exists
        logging: process.env.NODE_ENV === "development",
      }),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
