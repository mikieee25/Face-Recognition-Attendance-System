import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import configuration from "./config/configuration";
import { DatabaseModule } from "./database/database.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { PersonnelModule } from "./personnel/personnel.module";

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
  ],
})
export class AppModule {}
