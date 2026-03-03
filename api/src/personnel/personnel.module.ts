import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Personnel } from "../database/entities/personnel.entity";
import { FaceEmbedding } from "../database/entities/face-data.entity";
import { PersonnelService } from "./personnel.service";
import { PersonnelController } from "./personnel.controller";
import { FaceModule } from "../face/face.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Personnel, FaceEmbedding]),
    FaceModule,
  ],
  controllers: [PersonnelController],
  providers: [PersonnelService],
  exports: [PersonnelService],
})
export class PersonnelModule {}
