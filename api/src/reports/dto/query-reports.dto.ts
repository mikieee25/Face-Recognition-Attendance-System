import { IsOptional, IsInt, IsString, IsIn, Min } from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class QueryReportsDto {
  @ApiPropertyOptional({ description: "Start date (ISO 8601)" })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: "End date (ISO 8601)" })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: "Filter by station ID (Admin only)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  stationId?: number;

  @ApiPropertyOptional({ description: "Filter by personnel ID" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  personnelId?: number;

  @ApiPropertyOptional({
    description: "Attendance type filter",
    enum: ["time_in", "time_out"],
  })
  @IsOptional()
  @IsIn(["time_in", "time_out"])
  type?: "time_in" | "time_out";

  @ApiPropertyOptional({
    description: "Export format",
    enum: ["excel", "csv"],
    default: "excel",
  })
  @IsOptional()
  @IsIn(["excel", "csv"])
  format?: "excel" | "csv";

  @ApiPropertyOptional({ description: "Page number", default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: "Items per page", default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
