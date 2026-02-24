import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreatePersonnelDto {
  @ApiProperty({ example: "Juan" })
  @IsString()
  @IsNotEmpty({ message: "firstName is required" })
  firstName: string;

  @ApiProperty({ example: "Dela Cruz" })
  @IsString()
  @IsNotEmpty({ message: "lastName is required" })
  lastName: string;

  @ApiProperty({ example: "Fire Officer I" })
  @IsString()
  @IsNotEmpty({ message: "rank is required" })
  rank: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt({ message: "stationId must be an integer" })
  stationId: number;

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
