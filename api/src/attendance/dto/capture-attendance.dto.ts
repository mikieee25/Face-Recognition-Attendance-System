import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsEnum,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { AttendanceType } from "../../database/entities/attendance.entity";

export class CaptureAttendanceDto {
  @ApiProperty({
    description:
      "Base64-encoded image (JPEG or PNG, max 10 MB). Must include data URI prefix, e.g. data:image/jpeg;base64,...",
  })
  @IsString()
  @IsNotEmpty()
  image: string;

  @ApiProperty({
    description: "Station ID for face recognition scope",
    required: false,
  })
  @IsNumber()
  @IsOptional()
  stationId?: number;

  @ApiProperty({
    enum: AttendanceType,
    description: "Requested attendance type (time_in or time_out)",
    required: false,
  })
  @IsEnum(AttendanceType)
  @IsOptional()
  type?: AttendanceType;
}
