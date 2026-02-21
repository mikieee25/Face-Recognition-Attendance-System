import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { UserRole } from "./create-user.dto";

export class UpdateUserDto {
  @ApiPropertyOptional({ example: "jdoe" })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ example: "jdoe@bfp.gov.ph" })
  @IsOptional()
  @IsEmail({}, { message: "Invalid email format" })
  email?: string;

  @ApiPropertyOptional({ example: "NewPass1!" })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  @Matches(/(?=.*[A-Z])/, {
    message: "Password must contain at least one uppercase letter",
  })
  @Matches(/(?=.*\d)/, { message: "Password must contain at least one number" })
  password?: string;

  @ApiPropertyOptional({ enum: ["admin", "station_user"] })
  @IsOptional()
  @IsEnum(["admin", "station_user"], {
    message: "Role must be admin or station_user",
  })
  role?: UserRole;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  stationId?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
