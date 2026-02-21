import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MinLength, MaxLength, Matches } from "class-validator";

export class RegisterDto {
  @ApiProperty({
    description: "Username or email used to sign in",
    example: "admin@example.com",
    minLength: 3,
    maxLength: 64,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9._@+\-]+$/, { message: "username can contain letters, numbers and these characters: . _ @ + -" })
  username: string;

  @ApiProperty({
    description: "Password (min 10 chars, include uppercase, lowercase, number and special char)",
    example: "Str0ngP@ssw0rd!",
    minLength: 10,
    maxLength: 128,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(128)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+/, {
    message: "password must include uppercase, lowercase, number and special character",
  })
  password: string;

  @ApiProperty({
    description: "Display name (optional)",
    example: "Administrator",
    required: false,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
