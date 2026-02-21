import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsString,
  Matches,
  MinLength,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export type UserRole = "admin" | "station_user";

export class CreateUserDto {
  @ApiProperty({ example: "jdoe", description: "Unique username" })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: "jdoe@bfp.gov.ph", description: "Unique email" })
  @IsEmail({}, { message: "Invalid email format" })
  @IsNotEmpty()
  email: string;

  /**
   * Password policy (Requirement 11.7):
   * - Minimum 8 characters
   * - At least one uppercase letter
   * - At least one digit
   */
  @ApiProperty({
    example: "Secret1!",
    description: "Password (min 8 chars, 1 uppercase, 1 number)",
  })
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  @Matches(/(?=.*[A-Z])/, {
    message: "Password must contain at least one uppercase letter",
  })
  @Matches(/(?=.*\d)/, { message: "Password must contain at least one number" })
  password: string;

  @ApiPropertyOptional({
    example: "station_user",
    enum: ["admin", "station_user"],
  })
  @IsOptional()
  @IsEnum(["admin", "station_user"], {
    message: "Role must be admin or station_user",
  })
  role?: UserRole;

  @ApiPropertyOptional({
    example: 1,
    description: "Station ID (required for station_user)",
  })
  @IsOptional()
  @IsInt()
  stationId?: number;
}
