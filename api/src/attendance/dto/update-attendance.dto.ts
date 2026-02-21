import { IsEnum, IsOptional, IsNumber } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import {
  AttendanceType,
  AttendanceStatus,
} from "../../database/entities/attendance.entity";

export class UpdateAttendanceDto {
  @ApiProperty({ enum: AttendanceType, required: false })
  @IsEnum(AttendanceType)
  @IsOptional()
  type?: AttendanceType;

  @ApiProperty({ enum: AttendanceStatus, required: false })
  @IsEnum(AttendanceStatus)
  @IsOptional()
  status?: AttendanceStatus;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  personnelId?: number;
}
