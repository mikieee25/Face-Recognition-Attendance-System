import {
  IsArray,
  IsEnum,
  IsMilitaryTime,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import {
  DEFAULT_SHIFT_END_TIME,
  DEFAULT_SHIFT_START_TIME,
  ScheduleType,
} from "../../database/entities/schedule.entity";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ScheduleDayDto {
  @ApiProperty({ example: "2026-03-01" })
  @IsString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({ enum: ScheduleType })
  @IsEnum(ScheduleType)
  type: ScheduleType;

  @ApiPropertyOptional({ example: DEFAULT_SHIFT_START_TIME.slice(0, 5) })
  @IsOptional()
  @IsMilitaryTime()
  shiftStartTime?: string;

  @ApiPropertyOptional({ example: DEFAULT_SHIFT_END_TIME.slice(0, 5) })
  @IsOptional()
  @IsMilitaryTime()
  shiftEndTime?: string;
}

export class UpdateScheduleDto {
  @ApiProperty({ type: [ScheduleDayDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleDayDto)
  schedules: ScheduleDayDto[];
}
