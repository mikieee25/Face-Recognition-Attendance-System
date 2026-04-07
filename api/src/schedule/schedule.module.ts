import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleService } from './schedule.service';
import { ScheduleController } from './schedule.controller';
import { Schedule } from '../database/entities/schedule.entity';
import { Personnel } from '../database/entities/personnel.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Schedule, Personnel])],
  controllers: [ScheduleController],
  providers: [ScheduleService],
  exports: [ScheduleService],
})
export class ScheduleModule {}
