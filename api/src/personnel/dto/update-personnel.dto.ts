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
  @ApiPropertyOptional({ example: "123 Main St" })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: "09123456789" })
  @IsOptional()
  @IsString()
  contactNumber?: string;

  @ApiPropertyOptional({ example: "Male" })
  @IsOptional()
  @IsString()
  gender?: string;

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

  @ApiPropertyOptional({ example: "data:image/png;base64,iVBORw0KGgo..." })
  @IsOptional()
  @IsString()
  photo?: string;
}
