import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsString, ArrayMinSize, ArrayMaxSize } from "class-validator";

export class RegisterFaceDto {
  @ApiProperty({
    description:
      "Array of base64-encoded data URIs (JPEG or PNG). Min 3, max 10 images.",
    example: ["data:image/jpeg;base64,/9j/4AAQ..."],
    minItems: 3,
    maxItems: 10,
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  images: string[];
}
