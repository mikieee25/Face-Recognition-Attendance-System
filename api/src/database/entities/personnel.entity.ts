import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Station } from "../../stations/station.entity";

export enum PersonnelSection {
  ADMIN = "admin",
  OPERATION = "operation",
}

@Entity("personnel")
export class Personnel {
  @Column({ type: "varchar", length: 255, nullable: true })
  address: string | null;

  @Column({
    type: "varchar",
    length: 50,
    nullable: true,
    name: "contact_number",
  })
  contactNumber: string | null;

  @Column({ type: "varchar", length: 20, nullable: true })
  gender: string | null;

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 100, name: "first_name" })
  firstName: string;

  @Column({ type: "varchar", length: 100, name: "last_name" })
  lastName: string;

  @Column({ type: "varchar", length: 100 })
  rank: string;

  @Column({
    type: "enum",
    enum: PersonnelSection,
    default: PersonnelSection.ADMIN,
  })
  section: PersonnelSection;

  @Column({ type: "int", name: "station_id" })
  stationId: number;

  @ManyToOne(() => Station)
  @JoinColumn({ name: "station_id" })
  station: Station;

  @Column({ type: "datetime", nullable: true, name: "date_created" })
  dateCreated: Date | null;

  @Column({ type: "varchar", length: 255, nullable: true, name: "image_path" })
  imagePath: string | null;

  @Column({ type: "tinyint", default: 1, name: "is_active" })
  isActive: boolean;
}
