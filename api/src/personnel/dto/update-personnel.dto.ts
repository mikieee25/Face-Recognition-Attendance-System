import { IsBoolean, IsInt, IsOptional, IsString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdatePersonnelDto {
  @ApiPropertyOptional({ example: "Juan" })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({ example: "Dela Cruz" })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({ example: "Fire Officer II" })
  @IsOptional()
  @IsString()
  rank?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  station_id?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
