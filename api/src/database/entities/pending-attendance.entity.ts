import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Personnel } from "./personnel.entity";

export type AttendanceType = "TIME_IN" | "TIME_OUT";

@Entity("pending_attendance")
export class PendingAttendance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int", name: "personnel_id" })
  personnelId: number;

  @ManyToOne(() => Personnel)
  @JoinColumn({ name: "personnel_id" })
  personnel: Personnel;

  @Column({ type: "date" })
  date: string;

  @Column({
    type: "enum",
    enum: ["TIME_IN", "TIME_OUT"],
    name: "attendance_type",
  })
  attendanceType: AttendanceType;

  @Column({ type: "varchar", length: 255, name: "image_path" })
  imagePath: string;

  @Column({ type: "text", nullable: true })
  notes: string | null;

  @Column({ type: "datetime", nullable: true, name: "date_created" })
  dateCreated: Date | null;
}
