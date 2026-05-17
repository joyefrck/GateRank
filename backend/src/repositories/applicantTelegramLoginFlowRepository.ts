import { createHash, randomBytes } from 'node:crypto';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { sqlDateTimeToTimezoneIso } from '../utils/time';

export const TELEGRAM_LOGIN_START_PREFIX = 'gr_login_';

export type ApplicantTelegramLoginFlowStatus = 'pending' | 'completed' | 'failed' | 'consumed' | 'expired';

interface ApplicantTelegramLoginFlowRow extends RowDataPacket {
  id: number;
  flow_id: string;
  start_token_hash: string;
  poll_token_hash: string;
  applicant_account_id: number | null;
  telegram_user_id: string | null;
  status: ApplicantTelegramLoginFlowStatus;
  failure_reason: string | null;
  expires_at: string;
  completed_at: string | null;
  consumed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicantTelegramLoginFlow {
  id: number;
  flow_id: string;
  applicant_account_id: number | null;
  telegram_user_id: string | null;
  status: ApplicantTelegramLoginFlowStatus;
  failure_reason: string | null;
  expires_at: string;
  completed_at: string | null;
  consumed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatedApplicantTelegramLoginFlow {
  flow_id: string;
  start_token: string;
  poll_token: string;
  expires_at: string;
}

export class ApplicantTelegramLoginFlowRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS applicant_telegram_login_flows (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        flow_id VARCHAR(64) NOT NULL,
        start_token_hash CHAR(64) NOT NULL,
        poll_token_hash CHAR(64) NOT NULL,
        applicant_account_id BIGINT UNSIGNED NULL,
        telegram_user_id VARCHAR(64) NULL,
        status ENUM('pending', 'completed', 'failed', 'consumed', 'expired') NOT NULL DEFAULT 'pending',
        failure_reason VARCHAR(255) NULL,
        expires_at DATETIME NOT NULL,
        completed_at DATETIME NULL,
        consumed_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_applicant_telegram_login_flows_flow_id (flow_id),
        UNIQUE KEY uk_applicant_telegram_login_flows_start_token (start_token_hash),
        INDEX idx_applicant_telegram_login_flows_poll (flow_id, poll_token_hash),
        INDEX idx_applicant_telegram_login_flows_status_expires (status, expires_at),
        INDEX idx_applicant_telegram_login_flows_account_created (applicant_account_id, created_at DESC)
      )
    `);
  }

  async create(now = new Date()): Promise<CreatedApplicantTelegramLoginFlow> {
    const flowId = randomBytes(12).toString('base64url');
    const startToken = `${TELEGRAM_LOGIN_START_PREFIX}${flowId}_${randomBytes(18).toString('base64url')}`;
    const pollToken = randomBytes(24).toString('base64url');
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

    await this.pool.execute<ResultSetHeader>(
      `INSERT INTO applicant_telegram_login_flows (flow_id, start_token_hash, poll_token_hash, expires_at)
       VALUES (?, ?, ?, ?)`,
      [flowId, hashToken(startToken), hashToken(pollToken), formatSqlDateTime(expiresAt)],
    );

    return {
      flow_id: flowId,
      start_token: startToken,
      poll_token: pollToken,
      expires_at: expiresAt.toISOString(),
    };
  }

  async completeByStartToken(
    startToken: string,
    applicantAccountId: number,
    telegramUserId: string,
    now = new Date(),
  ): Promise<'completed' | 'expired' | 'invalid'> {
    const flow = await this.getPendingByStartToken(startToken);
    if (!flow) {
      return 'invalid';
    }
    if (new Date(flow.expires_at).getTime() <= now.getTime()) {
      await this.expire(flow.id, now);
      return 'expired';
    }

    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE applicant_telegram_login_flows
          SET status = 'completed',
              applicant_account_id = ?,
              telegram_user_id = ?,
              completed_at = ?
        WHERE id = ?
          AND status = 'pending'`,
      [applicantAccountId, telegramUserId, formatSqlDateTime(now), flow.id],
    );
    return result.affectedRows > 0 ? 'completed' : 'invalid';
  }

  async failByStartToken(
    startToken: string,
    reason: string,
    telegramUserId: string | null = null,
    now = new Date(),
  ): Promise<'failed' | 'expired' | 'invalid'> {
    const flow = await this.getPendingByStartToken(startToken);
    if (!flow) {
      return 'invalid';
    }
    if (new Date(flow.expires_at).getTime() <= now.getTime()) {
      await this.expire(flow.id, now);
      return 'expired';
    }

    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE applicant_telegram_login_flows
          SET status = 'failed',
              failure_reason = ?,
              telegram_user_id = ?,
              completed_at = ?
        WHERE id = ?
          AND status = 'pending'`,
      [reason, telegramUserId, formatSqlDateTime(now), flow.id],
    );
    return result.affectedRows > 0 ? 'failed' : 'invalid';
  }

  async consumeForLogin(
    flowId: string,
    pollToken: string,
    now = new Date(),
  ): Promise<
    | { status: 'pending' | 'failed' | 'expired' | 'consumed'; failure_reason?: string | null }
    | { status: 'completed'; applicant_account_id: number }
    | null
  > {
    const flow = await this.getByFlowAndPollToken(flowId, pollToken);
    if (!flow) {
      return null;
    }

    if (flow.status === 'pending' && new Date(flow.expires_at).getTime() <= now.getTime()) {
      await this.expire(flow.id, now);
      return { status: 'expired', failure_reason: 'Telegram 登录链接已过期，请重新发起登录' };
    }
    if (flow.status === 'completed' && flow.applicant_account_id) {
      const [result] = await this.pool.execute<ResultSetHeader>(
        `UPDATE applicant_telegram_login_flows
            SET status = 'consumed',
                consumed_at = ?
          WHERE id = ?
            AND status = 'completed'`,
        [formatSqlDateTime(now), flow.id],
      );
      return result.affectedRows > 0
        ? { status: 'completed', applicant_account_id: flow.applicant_account_id }
        : { status: 'consumed', failure_reason: 'Telegram 登录凭证已使用，请重新登录' };
    }
    if (flow.status === 'completed') {
      return { status: 'failed', failure_reason: 'Telegram 登录凭证无效，请重新登录' };
    }

    return {
      status: flow.status,
      failure_reason: flow.failure_reason,
    };
  }

  private async getPendingByStartToken(startToken: string): Promise<ApplicantTelegramLoginFlow | null> {
    const [rows] = await this.pool.query<ApplicantTelegramLoginFlowRow[]>(
      `${this.selectSql()} WHERE start_token_hash = ? AND status = 'pending' LIMIT 1`,
      [hashToken(startToken)],
    );
    return rows[0] ? toApplicantTelegramLoginFlow(rows[0]) : null;
  }

  private async getByFlowAndPollToken(
    flowId: string,
    pollToken: string,
  ): Promise<ApplicantTelegramLoginFlow | null> {
    const [rows] = await this.pool.query<ApplicantTelegramLoginFlowRow[]>(
      `${this.selectSql()} WHERE flow_id = ? AND poll_token_hash = ? LIMIT 1`,
      [flowId, hashToken(pollToken)],
    );
    return rows[0] ? toApplicantTelegramLoginFlow(rows[0]) : null;
  }

  private async expire(id: number, now: Date): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE applicant_telegram_login_flows
          SET status = 'expired',
              consumed_at = ?,
              failure_reason = 'Telegram 登录链接已过期，请重新发起登录'
        WHERE id = ?
          AND status = 'pending'`,
      [formatSqlDateTime(now), id],
    );
    return result.affectedRows > 0;
  }

  private selectSql(): string {
    return `SELECT
      id,
      flow_id,
      start_token_hash,
      poll_token_hash,
      applicant_account_id,
      telegram_user_id,
      status,
      failure_reason,
      DATE_FORMAT(expires_at, '%Y-%m-%d %H:%i:%s') AS expires_at,
      DATE_FORMAT(completed_at, '%Y-%m-%d %H:%i:%s') AS completed_at,
      DATE_FORMAT(consumed_at, '%Y-%m-%d %H:%i:%s') AS consumed_at,
      DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
      DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
    FROM applicant_telegram_login_flows`;
  }
}

function toApplicantTelegramLoginFlow(row: ApplicantTelegramLoginFlowRow): ApplicantTelegramLoginFlow {
  return {
    id: Number(row.id),
    flow_id: row.flow_id,
    applicant_account_id: row.applicant_account_id == null ? null : Number(row.applicant_account_id),
    telegram_user_id: row.telegram_user_id,
    status: row.status,
    failure_reason: row.failure_reason,
    expires_at: sqlDateTimeToTimezoneIso(row.expires_at),
    completed_at: row.completed_at ? sqlDateTimeToTimezoneIso(row.completed_at) : null,
    consumed_at: row.consumed_at ? sqlDateTimeToTimezoneIso(row.consumed_at) : null,
    created_at: sqlDateTimeToTimezoneIso(row.created_at),
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
