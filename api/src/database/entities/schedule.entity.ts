import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Personnel } from "./personnel.entity";

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
}
