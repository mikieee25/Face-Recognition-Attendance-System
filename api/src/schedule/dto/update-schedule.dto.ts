import { IsEnum, IsNotEmpty, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ScheduleType } from '../../database/entities/schedule.entity';
import { ApiProperty } from '@nestjs/swagger';

export class ScheduleDayDto {
  @ApiProperty({ example: '2026-03-01' })
  @IsString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({ enum: ScheduleType })
  @IsEnum(ScheduleType)
  type: ScheduleType;
}

export class UpdateScheduleDto {
  @ApiProperty({ type: [ScheduleDayDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleDayDto)
  schedules: ScheduleDayDto[];
}
