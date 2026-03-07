import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsEnum,
  IsDateString,
  IsOptional,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AttendanceType } from "../../database/entities/attendance.entity";

export class ManualAttendanceDto {
  @ApiProperty({ description: "Personnel ID" })
  @IsNumber()
  personnelId: number;

  @ApiProperty({ enum: AttendanceType, description: "time_in or time_out" })
  @IsEnum(AttendanceType)
  type: AttendanceType;

  @ApiProperty({
    description: "ISO 8601 datetime string (must not be in the future)",
    example: "2024-01-15T08:00:00.000Z",
  })
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiPropertyOptional({
    description: "Base64-encoded JPEG/PNG photo captured from kiosk camera",
  })
  @IsOptional()
  @IsString()
  photo?: string;
}
