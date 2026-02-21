import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { User } from "./user.entity";

@Entity("personnel")
export class Personnel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 100, name: "first_name" })
  firstName: string;

  @Column({ type: "varchar", length: 100, name: "last_name" })
  lastName: string;

  @Column({ type: "varchar", length: 100 })
  rank: string;

  @Column({ type: "int", name: "station_id" })
  stationId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: "station_id" })
  station: User;

  @Column({ type: "datetime", nullable: true, name: "date_created" })
  dateCreated: Date | null;

  @Column({ type: "varchar", length: 255, nullable: true, name: "image_path" })
  imagePath: string | null;

  @Column({ type: "tinyint", default: 1, name: "is_active" })
  isActive: boolean;

  @Column({ type: "time", nullable: true, name: "shift_start_time" })
  shiftStartTime: string | null;

  @Column({ type: "time", nullable: true, name: "shift_end_time" })
  shiftEndTime: string | null;

  @Column({ type: "tinyint", default: 0, name: "is_shifting" })
  isShifting: boolean;

  @Column({ type: "date", nullable: true, name: "shift_start_date" })
  shiftStartDate: string | null;

  @Column({ type: "int", default: 15, name: "shift_duration_days" })
  shiftDurationDays: number;
}
