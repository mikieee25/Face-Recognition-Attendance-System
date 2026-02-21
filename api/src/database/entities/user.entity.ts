import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from "typeorm";

export type StationType = "CENTRAL" | "TALISAY" | "BACON" | "ABUYOG";

@Entity("user")
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 100, unique: true })
  username: string;

  @Column({ type: "varchar", length: 150, unique: true })
  email: string;

  @Column({ type: "varchar", length: 255 })
  password: string;

  @Column({
    type: "enum",
    enum: ["CENTRAL", "TALISAY", "BACON", "ABUYOG"],
    name: "station_type",
  })
  stationType: StationType;

  @Column({ type: "tinyint", nullable: true, name: "is_admin" })
  isAdmin: boolean | null;

  @Column({
    type: "datetime",
    nullable: true,
    name: "date_created",
  })
  dateCreated: Date | null;

  @Column({
    type: "varchar",
    length: 255,
    nullable: true,
    default: "images/profile-placeholder.jpg",
    name: "profile_picture",
  })
  profilePicture: string | null;

  @Column({
    type: "tinyint",
    default: 0,
    name: "must_change_password",
  })
  mustChangePassword: boolean;

  @Column({ type: "tinyint", default: 1, name: "is_active" })
  isActive: boolean;

  @Column({ type: "tinyint", default: 0, name: "is_kiosk" })
  isKiosk: boolean;
}
