import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Personnel } from "./personnel.entity";
import { User } from "./user.entity";

export type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "ON_LEAVE";

@Entity("attendance")
export class Attendance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int", name: "personnel_id" })
  personnelId: number;

  @ManyToOne(() => Personnel)
  @JoinColumn({ name: "personnel_id" })
  personnel: Personnel;

  @Column({ type: "date" })
  date: string;

  @Column({ type: "datetime", nullable: true, name: "time_in" })
  timeIn: Date | null;

  @Column({ type: "datetime", nullable: true, name: "time_out" })
  timeOut: Date | null;

  @Column({
    type: "enum",
    enum: ["PRESENT", "LATE", "ABSENT", "ON_LEAVE"],
    nullable: true,
  })
  status: AttendanceStatus | null;

  @Column({ type: "float", nullable: true, name: "confidence_score" })
  confidenceScore: number | null;

  @Column({ type: "tinyint", nullable: true, name: "is_auto_captured" })
  isAutoCaptured: boolean | null;

  @Column({ type: "tinyint", nullable: true, name: "is_approved" })
  isApproved: boolean | null;

  @Column({ type: "int", nullable: true, name: "approved_by" })
  approvedBy: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "approved_by" })
  approvedByUser: User | null;

  @Column({
    type: "varchar",
    length: 255,
    nullable: true,
    name: "time_in_image",
  })
  timeInImage: string | null;

  @Column({
    type: "varchar",
    length: 255,
    nullable: true,
    name: "time_out_image",
  })
  timeOutImage: string | null;

  @Column({ type: "datetime", nullable: true, name: "date_created" })
  dateCreated: Date | null;
}
