import { IsInt, IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreatePersonnelDto {
  @ApiProperty({ example: "Juan", description: "First name" })
  @IsString()
  @IsNotEmpty({ message: "first_name is required" })
  first_name: string;

  @ApiProperty({ example: "Dela Cruz", description: "Last name" })
  @IsString()
  @IsNotEmpty({ message: "last_name is required" })
  last_name: string;

  @ApiProperty({ example: "Fire Officer I", description: "Rank" })
  @IsString()
  @IsNotEmpty({ message: "rank is required" })
  rank: string;

  @ApiProperty({
    example: 1,
    description:
      "Station ID (ignored for station_user — auto-assigned from JWT)",
  })
  @IsInt({ message: "station_id must be an integer" })
  station_id: number;
}
