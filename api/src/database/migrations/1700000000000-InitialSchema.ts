import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * InitialSchema — documents the existing MySQL schema for the BFP Sorsogon Attendance System.
 *
 * Tables:
 *   - user           : system users (admin / station users / kiosk accounts)
 *   - personnel      : fire personnel whose attendance is tracked
 *   - attendance     : daily attendance records (time_in / time_out per personnel per date)
 *   - pending_attendance : low-confidence captures awaiting admin review
 *   - face_data      : face embeddings (longtext JSON) per personnel image
 *   - activity_log   : audit trail of user actions
 *
 * The schema already exists in the target database.
 * This migration is a no-op stub — it exists to anchor the migration history.
 */
export class InitialSchema1700000000000 implements MigrationInterface {
  name = "InitialSchema1700000000000";

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async up(_queryRunner: QueryRunner): Promise<void> {
    // Schema already exists — no DDL changes needed.
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No rollback — preserving existing schema.
  }
}
