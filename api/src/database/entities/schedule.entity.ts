import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Personnel } from "./personnel.entity";

export const DEFAULT_SHIFT_START_TIME = "08:00:00";
export const DEFAULT_SHIFT_END_TIME = "17:00:00";

export enum ScheduleType {
  REGULAR = "regular",
  SHIFTING = "shifting",
  LEAVE = "leave",
}

@Entity("schedule")
export class Schedule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int", name: "personnel_id" })
  personnelId: number;

  @ManyToOne(() => Personnel)
  @JoinColumn({ name: "personnel_id" })
  personnel: Personnel;

  @Column({ type: "date" })
  date: string;

  @Column({ type: "enum", enum: ScheduleType, default: ScheduleType.REGULAR })
  type: ScheduleType;

  @Column({
    type: "time",
    name: "shift_start_time",
    default: DEFAULT_SHIFT_START_TIME,
  })
  shiftStartTime: string;

  @Column({
    type: "time",
    name: "shift_end_time",
    default: DEFAULT_SHIFT_END_TIME,
  })
  shiftEndTime: string;
}
