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

export enum PendingReviewStatus {
  Pending = "pending",
  Approved = "approved",
  Rejected = "rejected",
}

@Entity("pending_approval")
export class PendingApproval {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int", name: "personnel_id" })
  personnelId: number;

  @ManyToOne(() => Personnel)
  @JoinColumn({ name: "personnel_id" })
  personnel: Personnel;

  @Column({
    type: "enum",
    enum: ["TIME_IN", "TIME_OUT"],
    name: "attendance_type",
  })
  attendanceType: "TIME_IN" | "TIME_OUT";

  @Column({ type: "float", nullable: true })
  confidence: number | null;

  @Column({ type: "varchar", length: 255, name: "image_path" })
  imagePath: string;

  @Column({ type: "int", nullable: true, name: "reviewed_by" })
  reviewedBy: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "reviewed_by" })
  reviewedByUser: User | null;

  @Column({
    type: "enum",
    enum: PendingReviewStatus,
    default: PendingReviewStatus.Pending,
    name: "review_status",
  })
  reviewStatus: PendingReviewStatus;

  @Column({ type: "datetime", nullable: true, name: "reviewed_at" })
  reviewedAt: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
