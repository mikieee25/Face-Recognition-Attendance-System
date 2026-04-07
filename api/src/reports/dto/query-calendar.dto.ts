import { IsInt, Min, Max, IsOptional } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class QueryCalendarDto {
  @ApiProperty({ description: "Year (e.g., 2026)", example: 2026 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  year: number;

  @ApiProperty({ description: "Month (1-12)", example: 4 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiPropertyOptional({ description: "Optional Station ID filter" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  stationId?: number;
}
