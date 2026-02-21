import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * InitialSchema — creates the fresh clean schema for the BFP Sorsogon Attendance System.
 *
 * Tables created:
 *   - station          : standalone fire station entity
 *   - user             : system users with role enum (admin/station_user/kiosk)
 *   - personnel        : fire personnel with station FK and shift scheduling columns
 *   - attendance_record: separate time_in/time_out records per capture
 *   - pending_approval : low-confidence captures awaiting admin review
 *   - face_data        : face image files and embeddings (legacy face service compat)
 *   - face_embeddings  : structured face embeddings from face service
 *   - activity_log     : audit trail of user actions
 */
export class InitialSchema1700000000000 implements MigrationInterface {
  name = "InitialSchema1700000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop existing tables in reverse dependency order
    await queryRunner.query(`DROP TABLE IF EXISTS \`activity_log\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`face_embeddings\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`face_data\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`pending_approval\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`pending_attendance\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`attendance_record\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`attendance\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`personnel\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`user\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`station\``);

    // station
    await queryRunner.query(`
      CREATE TABLE \`station\` (
        \`id\`         INT          NOT NULL AUTO_INCREMENT,
        \`name\`       VARCHAR(255) NOT NULL,
        \`location\`   VARCHAR(255) NOT NULL,
        \`created_at\` DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    // user
    await queryRunner.query(`
      CREATE TABLE \`user\` (
        \`id\`                   INT          NOT NULL AUTO_INCREMENT,
        \`username\`             VARCHAR(100) NOT NULL,
        \`email\`                VARCHAR(150) NOT NULL,
        \`password_hash\`        VARCHAR(255) NOT NULL,
        \`role\`                 ENUM('admin','station_user','kiosk') NOT NULL,
        \`station_id\`           INT          NULL,
        \`is_active\`            TINYINT      NOT NULL DEFAULT 1,
        \`created_at\`           DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`profile_picture\`      VARCHAR(255) NULL DEFAULT 'images/profile-placeholder.jpg',
        \`must_change_password\` TINYINT      NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_user_username\` (\`username\`),
        UNIQUE KEY \`UQ_user_email\`    (\`email\`),
        CONSTRAINT \`FK_user_station\` FOREIGN KEY (\`station_id\`) REFERENCES \`station\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    // personnel
    await queryRunner.query(`
      CREATE TABLE \`personnel\` (
        \`id\`                 INT          NOT NULL AUTO_INCREMENT,
        \`first_name\`         VARCHAR(100) NOT NULL,
        \`last_name\`          VARCHAR(100) NOT NULL,
        \`rank\`               VARCHAR(100) NOT NULL,
        \`station_id\`         INT          NOT NULL,
        \`date_created\`       DATETIME     NULL,
        \`image_path\`         VARCHAR(255) NULL,
        \`is_active\`          TINYINT      NOT NULL DEFAULT 1,
        \`shift_start_time\`   TIME         NULL,
        \`shift_end_time\`     TIME         NULL,
        \`is_shifting\`        TINYINT      NOT NULL DEFAULT 0,
        \`shift_start_date\`   DATE         NULL,
        \`shift_duration_days\` INT         NOT NULL DEFAULT 15,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_personnel_station\` FOREIGN KEY (\`station_id\`) REFERENCES \`station\` (\`id\`)
      ) ENGINE=InnoDB
    `);

    // attendance_record
    await queryRunner.query(`
      CREATE TABLE \`attendance_record\` (
        \`id\`           INT          NOT NULL AUTO_INCREMENT,
        \`personnel_id\` INT          NOT NULL,
        \`type\`         ENUM('time_in','time_out') NOT NULL,
        \`status\`       ENUM('confirmed','pending','rejected') NOT NULL DEFAULT 'confirmed',
        \`confidence\`   FLOAT        NULL,
        \`image_path\`   VARCHAR(255) NULL,
        \`is_manual\`    TINYINT      NOT NULL DEFAULT 0,
        \`created_by\`   INT          NULL,
        \`created_at\`   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`modified_by\`  INT          NULL,
        \`modified_at\`  DATETIME     NULL,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_attendance_record_personnel\` FOREIGN KEY (\`personnel_id\`) REFERENCES \`personnel\` (\`id\`),
        CONSTRAINT \`FK_attendance_record_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`user\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    // pending_approval
    await queryRunner.query(`
      CREATE TABLE \`pending_approval\` (
        \`id\`              INT          NOT NULL AUTO_INCREMENT,
        \`personnel_id\`    INT          NOT NULL,
        \`attendance_type\` ENUM('TIME_IN','TIME_OUT') NOT NULL,
        \`confidence\`      FLOAT        NULL,
        \`image_path\`      VARCHAR(255) NOT NULL,
        \`reviewed_by\`     INT          NULL,
        \`review_status\`   ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
        \`reviewed_at\`     DATETIME     NULL,
        \`created_at\`      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_pending_approval_personnel\` FOREIGN KEY (\`personnel_id\`) REFERENCES \`personnel\` (\`id\`),
        CONSTRAINT \`FK_pending_approval_reviewed_by\` FOREIGN KEY (\`reviewed_by\`) REFERENCES \`user\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    // face_data (kept for face service compatibility)
    await queryRunner.query(`
      CREATE TABLE \`face_data\` (
        \`id\`           INT          NOT NULL AUTO_INCREMENT,
        \`personnel_id\` INT          NOT NULL,
        \`filename\`     VARCHAR(255) NOT NULL,
        \`embedding\`    LONGTEXT     NULL,
        \`confidence\`   FLOAT        NULL,
        \`date_created\` DATETIME     NULL,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_face_data_personnel\` FOREIGN KEY (\`personnel_id\`) REFERENCES \`personnel\` (\`id\`)
      ) ENGINE=InnoDB
    `);

    // face_embeddings
    await queryRunner.query(`
      CREATE TABLE \`face_embeddings\` (
        \`id\`           INT         NOT NULL AUTO_INCREMENT,
        \`personnel_id\` INT         NOT NULL,
        \`embedding\`    JSON        NOT NULL,
        \`created_at\`   DATETIME    NOT NULL DEFAULT NOW(),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_face_embeddings_personnel\` FOREIGN KEY (\`personnel_id\`) REFERENCES \`personnel\` (\`id\`)
      ) ENGINE=InnoDB
    `);

    // activity_log
    await queryRunner.query(`
      CREATE TABLE \`activity_log\` (
        \`id\`          INT          NOT NULL AUTO_INCREMENT,
        \`user_id\`     INT          NOT NULL,
        \`title\`       VARCHAR(255) NOT NULL,
        \`description\` TEXT         NULL,
        \`timestamp\`   DATETIME     NULL,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_activity_log_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`user\` (\`id\`)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`activity_log\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`face_embeddings\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`face_data\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`pending_approval\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`attendance_record\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`personnel\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`user\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`station\``);
  }
}
