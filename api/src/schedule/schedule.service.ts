import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between } from "typeorm";
import { Schedule, ScheduleType } from "../database/entities/schedule.entity";
import { Personnel } from "../database/entities/personnel.entity";
import { UpdateScheduleDto } from "./dto/update-schedule.dto";

@Injectable()
export class ScheduleService {
  constructor(
    @InjectRepository(Schedule)
    private scheduleRepo: Repository<Schedule>,
    @InjectRepository(Personnel)
    private personnelRepo: Repository<Personnel>
  ) {}

  async getAllSchedules(date?: string) {
    if (date) {
      return this.scheduleRepo.find({ where: { date } });
    }
    return this.scheduleRepo.find();
  }

  async getPersonnelSchedule(personnelId: number, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const format = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;

    const records = await this.scheduleRepo.find({
      where: {
        personnelId,
        date: Between(format(startDate), format(endDate)),
      },
    });

    return records;
  }

  async updateSchedule(personnelId: number, dto: UpdateScheduleDto) {
    for (const item of dto.schedules) {
      let record = await this.scheduleRepo.findOne({
        where: { personnelId, date: item.date },
      });

      if (record) {
        if (item.type === ScheduleType.REGULAR) {
          await this.scheduleRepo.delete({ id: record.id });
        } else {
          record.type = item.type;
          await this.scheduleRepo.save(record);
        }
      } else {
        if (item.type !== ScheduleType.REGULAR) {
          record = this.scheduleRepo.create({
            personnelId,
            date: item.date,
            type: item.type,
          });
          await this.scheduleRepo.save(record);
        }
      }
    }
    return { success: true };
  }
}
