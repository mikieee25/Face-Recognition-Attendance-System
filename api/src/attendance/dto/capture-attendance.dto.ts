import { IsString, IsNotEmpty, IsNumber, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CaptureAttendanceDto {
  @ApiProperty({
    description:
      "Base64-encoded image (JPEG or PNG, max 10 MB). Must include data URI prefix, e.g. data:image/jpeg;base64,...",
  })
  @IsString()
  @IsNotEmpty()
  image: string;

  @ApiProperty({
    description: "Station ID for face recognition scope",
    required: false,
  })
  @IsNumber()
  @IsOptional()
  stationId?: number;
}
