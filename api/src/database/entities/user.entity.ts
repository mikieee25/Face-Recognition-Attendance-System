import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

export enum UserRole {
  Admin = "admin",
  StationUser = "station_user",
  Kiosk = "kiosk",
}

@Entity("user")
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 100, unique: true })
  username: string;

  @Column({ type: "varchar", length: 150, unique: true })
  email: string;

  @Column({ type: "varchar", length: 255, name: "password_hash" })
  passwordHash: string;

  @Column({ type: "enum", enum: UserRole })
  role: UserRole;

  @Column({ type: "int", nullable: true, name: "station_id" })
  stationId: number | null;

  @Column({ type: "tinyint", default: 1, name: "is_active" })
  isActive: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @Column({
    type: "varchar",
    length: 255,
    nullable: true,
    name: "profile_picture",
    default: "images/profile-placeholder.jpg",
  })
  profilePicture: string | null;

  @Column({ type: "tinyint", default: 0, name: "must_change_password" })
  mustChangePassword: boolean;
}
