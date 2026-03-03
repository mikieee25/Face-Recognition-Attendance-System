import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Personnel } from "./personnel.entity";

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
