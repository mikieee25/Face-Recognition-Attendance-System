import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";

@Entity("activity_log")
export class ActivityLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int", name: "user_id" })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ type: "varchar", length: 255 })
  title: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ type: "datetime", nullable: true })
  timestamp: Date | null;
}
