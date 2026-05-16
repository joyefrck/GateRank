import { createHash, randomBytes } from 'node:crypto';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { sqlDateTimeToTimezoneIso } from '../utils/time';

interface BindingRow extends RowDataPacket {
  id: number;
  applicant_account_id: number;
  telegram_user_id: string;
  telegram_chat_id: string;
  telegram_username: string | null;
  telegram_first_name: string | null;
  telegram_last_name: string | null;
  bound_at: string;
  updated_at: string;
}

interface BindTokenRow extends RowDataPacket {
  id: number;
  applicant_account_id: number;
  token_hash: string;
  expires_at: string;
  consumed_at: string | null;
}

export interface ApplicantTelegramBinding {
  id: number;
  applicant_account_id: number;
  telegram_user_id: string;
  telegram_chat_id: string;
  telegram_username: string | null;
  telegram_first_name: string | null;
  telegram_last_name: string | null;
  bound_at: string;
  updated_at: string;
}

export interface ApplicantTelegramBindToken {
  token: string;
  expires_at: string;
}

export interface BindTelegramUserInput {
  telegram_user_id: string;
  telegram_chat_id: string;
  telegram_username?: string | null;
  telegram_first_name?: string | null;
  telegram_last_name?: string | null;
}

export class ApplicantTelegramBindingRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS applicant_telegram_bind_tokens (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        applicant_account_id BIGINT UNSIGNED NOT NULL,
        token_hash CHAR(64) NOT NULL,
        expires_at DATETIME NOT NULL,
        consumed_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_applicant_telegram_bind_tokens_hash (token_hash),
        INDEX idx_applicant_telegram_bind_tokens_account_created (applicant_account_id, created_at DESC),
        INDEX idx_applicant_telegram_bind_tokens_expires (expires_at)
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS applicant_telegram_bindings (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        applicant_account_id BIGINT UNSIGNED NOT NULL,
        telegram_user_id VARCHAR(64) NOT NULL,
        telegram_chat_id VARCHAR(64) NOT NULL,
        telegram_username VARCHAR(255) NULL,
        telegram_first_name VARCHAR(255) NULL,
        telegram_last_name VARCHAR(255) NULL,
        bound_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_applicant_telegram_bindings_account (applicant_account_id),
        UNIQUE KEY uk_applicant_telegram_bindings_user (telegram_user_id),
        INDEX idx_applicant_telegram_bindings_chat (telegram_chat_id)
      )
    `);
  }

  async createBindToken(applicantAccountId: number, now = new Date()): Promise<ApplicantTelegramBindToken> {
    const token = randomBytes(18).toString('base64url');
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
    await this.pool.execute<ResultSetHeader>(
      `INSERT INTO applicant_telegram_bind_tokens (applicant_account_id, token_hash, expires_at)
       VALUES (?, ?, ?)`,
      [applicantAccountId, hashToken(token), formatSqlDateTime(expiresAt)],
    );
    return {
      token,
      expires_at: expiresAt.toISOString(),
    };
  }

  async consumeBindToken(token: string, telegramUser: BindTelegramUserInput, now = new Date()): Promise<ApplicantTelegramBinding | null> {
    const tokenHash = hashToken(token);
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [tokenRows] = await connection.query<BindTokenRow[]>(
        `SELECT id, applicant_account_id, token_hash,
                DATE_FORMAT(expires_at, '%Y-%m-%d %H:%i:%s') AS expires_at,
                DATE_FORMAT(consumed_at, '%Y-%m-%d %H:%i:%s') AS consumed_at
           FROM applicant_telegram_bind_tokens
          WHERE token_hash = ?
          LIMIT 1
          FOR UPDATE`,
        [tokenHash],
      );
      const record = tokenRows[0];
      if (!record || record.consumed_at || new Date(record.expires_at.replace(' ', 'T')).getTime() < now.getTime()) {
        await connection.rollback();
        return null;
      }

      await connection.execute<ResultSetHeader>(
        `UPDATE applicant_telegram_bind_tokens
            SET consumed_at = ?
          WHERE id = ?`,
        [formatSqlDateTime(now), record.id],
      );
      await connection.execute<ResultSetHeader>(
        `DELETE FROM applicant_telegram_bindings
          WHERE applicant_account_id = ?
             OR telegram_user_id = ?`,
        [record.applicant_account_id, telegramUser.telegram_user_id],
      );
      await connection.execute<ResultSetHeader>(
        `INSERT INTO applicant_telegram_bindings (
           applicant_account_id, telegram_user_id, telegram_chat_id,
           telegram_username, telegram_first_name, telegram_last_name, bound_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          record.applicant_account_id,
          telegramUser.telegram_user_id,
          telegramUser.telegram_chat_id,
          telegramUser.telegram_username || null,
          telegramUser.telegram_first_name || null,
          telegramUser.telegram_last_name || null,
          formatSqlDateTime(now),
        ],
      );
      const binding = await this.getByApplicantAccountIdForConnection(connection, record.applicant_account_id);
      await connection.commit();
      return binding;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async getByApplicantAccountId(applicantAccountId: number): Promise<ApplicantTelegramBinding | null> {
    const [rows] = await this.pool.query<BindingRow[]>(
      `${bindingSelectSql()} WHERE applicant_account_id = ? LIMIT 1`,
      [applicantAccountId],
    );
    return rows[0] ? toBinding(rows[0]) : null;
  }

  async getByTelegramUserId(telegramUserId: string): Promise<ApplicantTelegramBinding | null> {
    const [rows] = await this.pool.query<BindingRow[]>(
      `${bindingSelectSql()} WHERE telegram_user_id = ? LIMIT 1`,
      [telegramUserId],
    );
    return rows[0] ? toBinding(rows[0]) : null;
  }

  async unbindApplicantAccount(applicantAccountId: number): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `DELETE FROM applicant_telegram_bindings WHERE applicant_account_id = ?`,
      [applicantAccountId],
    );
    return result.affectedRows > 0;
  }

  private async getByApplicantAccountIdForConnection(
    connection: Pick<Pool, 'query'>,
    applicantAccountId: number,
  ): Promise<ApplicantTelegramBinding | null> {
    const [rows] = await connection.query<BindingRow[]>(
      `${bindingSelectSql()} WHERE applicant_account_id = ? LIMIT 1`,
      [applicantAccountId],
    );
    return rows[0] ? toBinding(rows[0]) : null;
  }
}

function bindingSelectSql(): string {
  return `SELECT id, applicant_account_id, telegram_user_id, telegram_chat_id,
                 telegram_username, telegram_first_name, telegram_last_name,
                 DATE_FORMAT(bound_at, '%Y-%m-%d %H:%i:%s') AS bound_at,
                 DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
            FROM applicant_telegram_bindings`;
}

function toBinding(row: BindingRow): ApplicantTelegramBinding {
  return {
    id: Number(row.id),
    applicant_account_id: Number(row.applicant_account_id),
    telegram_user_id: row.telegram_user_id,
    telegram_chat_id: row.telegram_chat_id,
    telegram_username: row.telegram_username,
    telegram_first_name: row.telegram_first_name,
    telegram_last_name: row.telegram_last_name,
    bound_at: sqlDateTimeToTimezoneIso(row.bound_at),
    updated_at: sqlDateTimeToTimezoneIso(row.updated_at),
  };
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function formatSqlDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
