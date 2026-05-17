import { createHash, randomBytes } from 'node:crypto';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { formatSqlDateTimeInTimezone, sqlDateTimeToTimezoneIso } from '../utils/time';

const CODE_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;

interface ApplicantEmailChangeCodeRow extends RowDataPacket {
  id: number;
  applicant_account_id: number;
  email: string;
  code_hash: string;
  code_salt: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}

export interface ApplicantEmailChangeCode {
  id: number;
  applicant_account_id: number;
  email: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}

export type ConsumeApplicantEmailChangeCodeResult = 'consumed' | 'invalid' | 'expired' | 'already_consumed';

export class ApplicantEmailChangeCodeRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS applicant_email_change_codes (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        applicant_account_id BIGINT UNSIGNED NOT NULL,
        email VARCHAR(255) NOT NULL,
        code_hash CHAR(64) NOT NULL,
        code_salt VARCHAR(32) NOT NULL,
        expires_at DATETIME NOT NULL,
        consumed_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_applicant_email_codes_account_email_created (applicant_account_id, email, created_at DESC),
        INDEX idx_applicant_email_codes_expires (expires_at)
      )
    `);
  }

  async getCooldownRecord(
    applicantAccountId: number,
    email: string,
    now = new Date(),
  ): Promise<ApplicantEmailChangeCode | null> {
    const cooldownStart = new Date(now.getTime() - RESEND_COOLDOWN_SECONDS * 1000);
    const [rows] = await this.pool.query<ApplicantEmailChangeCodeRow[]>(
      `${this.selectSql()}
       WHERE applicant_account_id = ?
         AND email = ?
         AND consumed_at IS NULL
         AND created_at > ?
       ORDER BY id DESC
       LIMIT 1`,
      [applicantAccountId, email, formatSqlDateTimeInTimezone(cooldownStart)],
    );
    return rows[0] ? toApplicantEmailChangeCode(rows[0]) : null;
  }

  async create(
    applicantAccountId: number,
    email: string,
    code: string,
    now = new Date(),
  ): Promise<ApplicantEmailChangeCode> {
    const salt = randomBytes(12).toString('hex');
    const expiresAt = new Date(now.getTime() + CODE_TTL_MINUTES * 60 * 1000);
    const [result] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO applicant_email_change_codes (
         applicant_account_id,
         email,
         code_hash,
         code_salt,
         expires_at
       ) VALUES (?, ?, ?, ?, ?)`,
      [
        applicantAccountId,
        email,
        hashCode(code, salt),
        salt,
        formatSqlDateTimeInTimezone(expiresAt),
      ],
    );
    return {
      id: result.insertId,
      applicant_account_id: applicantAccountId,
      email,
      expires_at: expiresAt.toISOString(),
      consumed_at: null,
      created_at: now.toISOString(),
    };
  }

  async consume(
    applicantAccountId: number,
    email: string,
    code: string,
    now = new Date(),
  ): Promise<ConsumeApplicantEmailChangeCodeResult> {
    const [rows] = await this.pool.query<ApplicantEmailChangeCodeRow[]>(
      `${this.selectSql()}
       WHERE applicant_account_id = ?
         AND email = ?
       ORDER BY id DESC
       LIMIT 1`,
      [applicantAccountId, email],
    );
    const record = rows[0];
    if (!record) {
      return 'invalid';
    }
    if (record.consumed_at) {
      return 'already_consumed';
    }
    if (sqlDateTimeToDate(record.expires_at).getTime() <= now.getTime()) {
      return 'expired';
    }
    if (record.code_hash !== hashCode(code, record.code_salt)) {
      return 'invalid';
    }

    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE applicant_email_change_codes
          SET consumed_at = ?
        WHERE id = ?
          AND consumed_at IS NULL`,
      [formatSqlDateTimeInTimezone(now), record.id],
    );
    return result.affectedRows > 0 ? 'consumed' : 'already_consumed';
  }

  private selectSql(): string {
    return `SELECT
        id,
        applicant_account_id,
        email,
        code_hash,
        code_salt,
        DATE_FORMAT(expires_at, '%Y-%m-%d %H:%i:%s') AS expires_at,
        DATE_FORMAT(consumed_at, '%Y-%m-%d %H:%i:%s') AS consumed_at,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
      FROM applicant_email_change_codes`;
  }
}

function hashCode(code: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${code}`).digest('hex');
}

function sqlDateTimeToDate(value: string): Date {
  return new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}+08:00`);
}

function toApplicantEmailChangeCode(row: ApplicantEmailChangeCodeRow): ApplicantEmailChangeCode {
  return {
    id: Number(row.id),
    applicant_account_id: Number(row.applicant_account_id),
    email: row.email,
    expires_at: sqlDateTimeToTimezoneIso(row.expires_at),
    consumed_at: row.consumed_at ? sqlDateTimeToTimezoneIso(row.consumed_at) : null,
    created_at: sqlDateTimeToTimezoneIso(row.created_at),
  };
}
