import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Personnel } from "./personnel.entity";

@Entity("face_data")
export class FaceData {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int", name: "personnel_id" })
  personnelId: number;

  @ManyToOne(() => Personnel)
  @JoinColumn({ name: "personnel_id" })
  personnel: Personnel;

  @Column({ type: "varchar", length: 255 })
  filename: string;

  /**
   * Face embedding stored as JSON string (longtext in DB).
   * Represents a float array (e.g. 128-dim or 512-dim vector).
   */
  @Column({ type: "longtext", nullable: true })
  embedding: string | null;

  @Column({ type: "float", nullable: true })
  confidence: number | null;

  @Column({ type: "datetime", nullable: true, name: "date_created" })
  dateCreated: Date | null;
}

/**
 * FaceEmbedding — stores face embeddings returned by the Face Service
 * after successful face registration. (Requirements 4.7, 4.8)
 */
@Entity("face_embeddings")
export class FaceEmbedding {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int", name: "personnel_id" })
  personnelId: number;

  @ManyToOne(() => Personnel)
  @JoinColumn({ name: "personnel_id" })
  personnel: Personnel;

  /**
   * Embedding vector stored as JSON (e.g. 512-dim float array).
   */
  @Column({ type: "json" })
  embedding: number[];

  @Column({ type: "datetime", name: "created_at", default: () => "NOW()" })
  createdAt: Date;
}
