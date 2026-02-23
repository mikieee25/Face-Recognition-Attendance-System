import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdatePersonnelDto {
  @ApiPropertyOptional({ example: "Juan" })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: "Dela Cruz" })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: "Fire Officer II" })
  @IsOptional()
  @IsString()
  rank?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  stationId?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: "08:00" })
  @IsOptional()
  @IsString()
  shiftStartTime?: string;

  @ApiPropertyOptional({ example: "17:00" })
  @IsOptional()
  @IsString()
  shiftEndTime?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isShifting?: boolean;

  @ApiPropertyOptional({ example: "2026-03-01" })
  @IsOptional()
  @IsString()
  shiftStartDate?: string;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  shiftDurationDays?: number;
}
