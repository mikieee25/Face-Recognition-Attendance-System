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

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "stationId must be an integer" })
  stationId?: number;
}
