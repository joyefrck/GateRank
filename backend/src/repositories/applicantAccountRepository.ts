import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { sqlDateTimeToTimezoneIso } from '../utils/time';

interface ApplicantAccountRow extends RowDataPacket {
  id: number;
  application_id: number;
  email: string;
  password_hash: string;
  must_change_password: number;
  last_login_at: string | null;
  x_user_id: string | null;
  x_username: string | null;
  x_display_name: string | null;
  x_bound_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicantAccount {
  id: number;
  application_id: number;
  email: string;
  password_hash: string;
  must_change_password: boolean;
  last_login_at: string | null;
  x_user_id?: string | null;
  x_username?: string | null;
  x_display_name?: string | null;
  x_bound_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicantXIdentityInput {
  x_user_id: string;
  x_username: string | null;
  x_display_name: string | null;
  x_bound_at: string;
}

export interface CreateApplicantAccountInput {
  application_id: number;
  email: string;
  password_hash: string;
  must_change_password?: boolean;
}

export class ApplicantAccountRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS applicant_accounts (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        application_id BIGINT UNSIGNED NOT NULL,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        must_change_password TINYINT(1) NOT NULL DEFAULT 1,
        last_login_at DATETIME NULL,
        x_user_id VARCHAR(64) NULL,
        x_username VARCHAR(255) NULL,
        x_display_name VARCHAR(255) NULL,
        x_bound_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_applicant_accounts_application_id (application_id),
        UNIQUE KEY uk_applicant_accounts_email (email),
        UNIQUE KEY uk_applicant_accounts_x_user_id (x_user_id),
        INDEX idx_applicant_accounts_email (email)
      )
    `);

    await this.ensureColumn('email', 'VARCHAR(255) NOT NULL AFTER application_id');
    await this.ensureColumn('password_hash', 'VARCHAR(255) NOT NULL AFTER email');
    await this.ensureColumn('must_change_password', 'TINYINT(1) NOT NULL DEFAULT 1 AFTER password_hash');
    await this.ensureColumn('last_login_at', 'DATETIME NULL AFTER must_change_password');
    await this.ensureColumn('x_user_id', 'VARCHAR(64) NULL AFTER last_login_at');
    await this.ensureColumn('x_username', 'VARCHAR(255) NULL AFTER x_user_id');
    await this.ensureColumn('x_display_name', 'VARCHAR(255) NULL AFTER x_username');
    await this.ensureColumn('x_bound_at', 'DATETIME NULL AFTER x_display_name');
    await this.ensureIndex('uk_applicant_accounts_x_user_id', 'UNIQUE KEY uk_applicant_accounts_x_user_id (x_user_id)');
  }

  async create(input: CreateApplicantAccountInput): Promise<number> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO applicant_accounts (
         application_id,
         email,
         password_hash,
         must_change_password
       ) VALUES (?, ?, ?, ?)`,
      [
        input.application_id,
        input.email,
        input.password_hash,
        input.must_change_password === false ? 0 : 1,
      ],
    );
    return result.insertId;
  }

  async getByEmail(email: string): Promise<ApplicantAccount | null> {
    const [rows] = await this.pool.query<ApplicantAccountRow[]>(
      `SELECT
         id,
         application_id,
         email,
         password_hash,
         must_change_password,
         DATE_FORMAT(last_login_at, '%Y-%m-%d %H:%i:%s') AS last_login_at,
         x_user_id,
         x_username,
         x_display_name,
         DATE_FORMAT(x_bound_at, '%Y-%m-%d %H:%i:%s') AS x_bound_at,
         DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
         DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
       FROM applicant_accounts
       WHERE email = ?
       LIMIT 1`,
      [email],
    );

    return rows[0] ? toApplicantAccount(rows[0]) : null;
  }

  async getById(id: number): Promise<ApplicantAccount | null> {
    const [rows] = await this.pool.query<ApplicantAccountRow[]>(
      `SELECT
         id,
         application_id,
         email,
         password_hash,
         must_change_password,
         DATE_FORMAT(last_login_at, '%Y-%m-%d %H:%i:%s') AS last_login_at,
         x_user_id,
         x_username,
         x_display_name,
         DATE_FORMAT(x_bound_at, '%Y-%m-%d %H:%i:%s') AS x_bound_at,
         DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
         DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
       FROM applicant_accounts
       WHERE id = ?
       LIMIT 1`,
      [id],
    );

    return rows[0] ? toApplicantAccount(rows[0]) : null;
  }

  async getByXUserId(xUserId: string): Promise<ApplicantAccount | null> {
    const [rows] = await this.pool.query<ApplicantAccountRow[]>(
      `SELECT
         id,
         application_id,
         email,
         password_hash,
         must_change_password,
         DATE_FORMAT(last_login_at, '%Y-%m-%d %H:%i:%s') AS last_login_at,
         x_user_id,
         x_username,
         x_display_name,
         DATE_FORMAT(x_bound_at, '%Y-%m-%d %H:%i:%s') AS x_bound_at,
         DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
         DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
       FROM applicant_accounts
       WHERE x_user_id = ?
       LIMIT 1`,
      [xUserId],
    );

    return rows[0] ? toApplicantAccount(rows[0]) : null;
  }

  async updatePassword(id: number, passwordHash: string, mustChangePassword: boolean): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE applicant_accounts
          SET password_hash = ?, must_change_password = ?
        WHERE id = ?`,
      [passwordHash, mustChangePassword ? 1 : 0, id],
    );
    return result.affectedRows > 0;
  }

  async updateEmail(id: number, email: string): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE applicant_accounts
          SET email = ?
        WHERE id = ?`,
      [email, id],
    );
    return result.affectedRows > 0;
  }

  async touchLogin(id: number, loggedInAt: string): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE applicant_accounts
          SET last_login_at = ?
        WHERE id = ?`,
      [loggedInAt, id],
    );
    return result.affectedRows > 0;
  }

  async bindXIdentity(id: number, input: ApplicantXIdentityInput): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE applicant_accounts
          SET x_user_id = ?,
              x_username = ?,
              x_display_name = ?,
              x_bound_at = ?
        WHERE id = ?`,
      [input.x_user_id, input.x_username, input.x_display_name, input.x_bound_at, id],
    );
    return result.affectedRows > 0;
  }

  async unbindXIdentity(id: number): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE applicant_accounts
          SET x_user_id = NULL,
              x_username = NULL,
              x_display_name = NULL,
              x_bound_at = NULL
        WHERE id = ?`,
      [id],
    );
    return result.affectedRows > 0;
  }

  private async ensureColumn(columnName: string, definition: string): Promise<void> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT 1
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
        LIMIT 1`,
      ['applicant_accounts', columnName],
    );

    if (rows.length === 0) {
      await this.pool.query(`ALTER TABLE applicant_accounts ADD COLUMN ${columnName} ${definition}`);
    }
  }

  private async ensureIndex(indexName: string, definition: string): Promise<void> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT 1
         FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND INDEX_NAME = ?
        LIMIT 1`,
      ['applicant_accounts', indexName],
    );

    if (rows.length === 0) {
      await this.pool.query(`ALTER TABLE applicant_accounts ADD ${definition}`);
    }
  }
}

function toApplicantAccount(row: ApplicantAccountRow): ApplicantAccount {
  return {
    id: Number(row.id),
    application_id: Number(row.application_id),
    email: row.email,
    password_hash: row.password_hash,
    must_change_password: Boolean(row.must_change_password),
    last_login_at: row.last_login_at ? sqlDateTimeToTimezoneIso(row.last_login_at) : null,
    x_user_id: row.x_user_id,
    x_username: row.x_username,
    x_display_name: row.x_display_name,
    x_bound_at: row.x_bound_at ? sqlDateTimeToTimezoneIso(row.x_bound_at) : null,
    created_at: sqlDateTimeToTimezoneIso(row.created_at),
    updated_at: sqlDateTimeToTimezoneIso(row.updated_at),
  };
}
