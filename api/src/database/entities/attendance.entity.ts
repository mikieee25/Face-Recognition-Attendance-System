import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { Personnel } from "./personnel.entity";
import { User } from "./user.entity";

export enum AttendanceType {
  TimeIn = "time_in",
  TimeOut = "time_out",
}

export enum AttendanceStatus {
  Confirmed = "confirmed",
  Pending = "pending",
  Rejected = "rejected",
}

@Entity("attendance_record")
export class AttendanceRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int", name: "personnel_id" })
  personnelId: number;

  @ManyToOne(() => Personnel)
  @JoinColumn({ name: "personnel_id" })
  personnel: Personnel;

  @Column({ type: "enum", enum: AttendanceType })
  type: AttendanceType;

  @Column({
    type: "enum",
    enum: AttendanceStatus,
    default: AttendanceStatus.Confirmed,
  })
  status: AttendanceStatus;

  @Column({ type: "float", nullable: true })
  confidence: number | null;

  @Column({ type: "varchar", length: 255, nullable: true, name: "image_path" })
  imagePath: string | null;

  @Column({ type: "tinyint", default: 0, name: "is_manual" })
  isManual: boolean;

  @Column({ type: "int", nullable: true, name: "created_by" })
  createdBy: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "created_by" })
  createdByUser: User | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @Column({ type: "int", nullable: true, name: "modified_by" })
  modifiedBy: number | null;

  @Column({ type: "datetime", nullable: true, name: "modified_at" })
  modifiedAt: Date | null;
}
