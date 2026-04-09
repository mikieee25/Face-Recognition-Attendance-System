import {
  Allow,
  IsIn,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PersonnelSection } from "../../database/entities/personnel.entity";

const PERSONNEL_SECTION_VALUES = ["admin", "operation"] as const;

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

  @ApiProperty({
    enum: PERSONNEL_SECTION_VALUES,
    example: PersonnelSection.ADMIN,
  })
  @Allow()
  @IsIn(PERSONNEL_SECTION_VALUES)
  section: PersonnelSection;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "stationId must be an integer" })
  stationId?: number;

  @ApiPropertyOptional({ example: "data:image/png;base64,iVBORw0KGgo..." })
  @IsOptional()
  @IsString()
  photo?: string;
}
