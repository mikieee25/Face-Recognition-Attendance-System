import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../database/entities/user.entity";
import { Attendance } from "../database/entities/attendance.entity";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";

@Module({
  imports: [TypeOrmModule.forFeature([User, Attendance])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
