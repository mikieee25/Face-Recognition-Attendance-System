import { IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateStationDto {
  @ApiProperty({ example: "Central Fire Station" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: "Sorsogon City" })
  @IsString()
  @IsNotEmpty()
  location: string;
}
