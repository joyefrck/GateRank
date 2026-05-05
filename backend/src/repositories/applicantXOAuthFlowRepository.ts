import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { sqlDateTimeToTimezoneIso } from '../utils/time';

export type ApplicantXOAuthFlowType = 'bind' | 'login';

interface ApplicantXOAuthFlowRow extends RowDataPacket {
  id: number;
  flow_type: ApplicantXOAuthFlowType;
  state: string;
  code_verifier: string;
  applicant_account_id: number | null;
  status: 'pending' | 'completed' | 'consumed' | 'expired';
  handoff_code: string | null;
  handoff_expires_at: string | null;
  x_user_id: string | null;
  x_username: string | null;
  x_display_name: string | null;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicantXOAuthFlow {
  id: number;
  flow_type: ApplicantXOAuthFlowType;
  state: string;
  code_verifier: string;
  applicant_account_id: number | null;
  status: 'pending' | 'completed' | 'consumed' | 'expired';
  handoff_code: string | null;
  handoff_expires_at: string | null;
  x_user_id: string | null;
  x_username: string | null;
  x_display_name: string | null;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateApplicantXOAuthFlowInput {
  flow_type: ApplicantXOAuthFlowType;
  state: string;
  code_verifier: string;
  applicant_account_id?: number | null;
  expires_at: string;
}

export interface CompleteApplicantXOAuthFlowInput {
  handoff_code?: string | null;
  handoff_expires_at?: string | null;
  x_user_id: string;
  x_username: string | null;
  x_display_name: string | null;
}

export class ApplicantXOAuthFlowRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS applicant_x_oauth_flows (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        flow_type ENUM('bind', 'login') NOT NULL,
        state VARCHAR(128) NOT NULL,
        code_verifier VARCHAR(128) NOT NULL,
        applicant_account_id BIGINT UNSIGNED NULL,
        status ENUM('pending', 'completed', 'consumed', 'expired') NOT NULL DEFAULT 'pending',
        handoff_code VARCHAR(128) NULL,
        handoff_expires_at DATETIME NULL,
        x_user_id VARCHAR(64) NULL,
        x_username VARCHAR(255) NULL,
        x_display_name VARCHAR(255) NULL,
        expires_at DATETIME NOT NULL,
        consumed_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_applicant_x_oauth_state (state),
        UNIQUE KEY uk_applicant_x_oauth_handoff_code (handoff_code),
        INDEX idx_applicant_x_oauth_status_expires (status, expires_at),
        INDEX idx_applicant_x_oauth_account_created (applicant_account_id, created_at DESC)
      )
    `);
  }

  async create(input: CreateApplicantXOAuthFlowInput): Promise<number> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO applicant_x_oauth_flows (
         flow_type,
         state,
         code_verifier,
         applicant_account_id,
         expires_at
       ) VALUES (?, ?, ?, ?, ?)`,
      [
        input.flow_type,
        input.state,
        input.code_verifier,
        input.applicant_account_id ?? null,
        input.expires_at,
      ],
    );
    return result.insertId;
  }

  async getPendingByState(state: string): Promise<ApplicantXOAuthFlow | null> {
    const [rows] = await this.pool.query<ApplicantXOAuthFlowRow[]>(
      `${this.selectSql()} WHERE state = ? AND status = 'pending' LIMIT 1`,
      [state],
    );
    return rows[0] ? toApplicantXOAuthFlow(rows[0]) : null;
  }

  async complete(id: number, input: CompleteApplicantXOAuthFlowInput): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE applicant_x_oauth_flows
          SET status = 'completed',
              handoff_code = ?,
              handoff_expires_at = ?,
              x_user_id = ?,
              x_username = ?,
              x_display_name = ?
        WHERE id = ?
          AND status = 'pending'`,
      [
        input.handoff_code ?? null,
        input.handoff_expires_at ?? null,
        input.x_user_id,
        input.x_username,
        input.x_display_name,
        id,
      ],
    );
    return result.affectedRows > 0;
  }

  async expire(id: number, consumedAt: string): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE applicant_x_oauth_flows
          SET status = 'expired',
              consumed_at = ?
        WHERE id = ?
          AND status = 'pending'`,
      [consumedAt, id],
    );
    return result.affectedRows > 0;
  }

  async consumeHandoffCode(handoffCode: string, consumedAt: string): Promise<ApplicantXOAuthFlow | null> {
    const [rows] = await this.pool.query<ApplicantXOAuthFlowRow[]>(
      `${this.selectSql()} WHERE handoff_code = ? AND status = 'completed' LIMIT 1`,
      [handoffCode],
    );
    const flow = rows[0] ? toApplicantXOAuthFlow(rows[0]) : null;
    if (!flow) {
      return null;
    }

    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE applicant_x_oauth_flows
          SET status = 'consumed',
              consumed_at = ?
        WHERE id = ?
          AND status = 'completed'`,
      [consumedAt, flow.id],
    );

    return result.affectedRows > 0 ? flow : null;
  }

  private selectSql(): string {
    return `SELECT
      id,
      flow_type,
      state,
      code_verifier,
      applicant_account_id,
      status,
      handoff_code,
      DATE_FORMAT(handoff_expires_at, '%Y-%m-%d %H:%i:%s') AS handoff_expires_at,
      x_user_id,
      x_username,
      x_display_name,
      DATE_FORMAT(expires_at, '%Y-%m-%d %H:%i:%s') AS expires_at,
      DATE_FORMAT(consumed_at, '%Y-%m-%d %H:%i:%s') AS consumed_at,
      DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
      DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
    FROM applicant_x_oauth_flows`;
  }
}

function toApplicantXOAuthFlow(row: ApplicantXOAuthFlowRow): ApplicantXOAuthFlow {
  return {
    id: Number(row.id),
    flow_type: row.flow_type,
    state: row.state,
    code_verifier: row.code_verifier,
    applicant_account_id: row.applicant_account_id == null ? null : Number(row.applicant_account_id),
    status: row.status,
    handoff_code: row.handoff_code,
    handoff_expires_at: row.handoff_expires_at ? sqlDateTimeToTimezoneIso(row.handoff_expires_at) : null,
    x_user_id: row.x_user_id,
    x_username: row.x_username,
    x_display_name: row.x_display_name,
    expires_at: sqlDateTimeToTimezoneIso(row.expires_at),
    consumed_at: row.consumed_at ? sqlDateTimeToTimezoneIso(row.consumed_at) : null,
    created_at: sqlDateTimeToTimezoneIso(row.created_at),
    updated_at: sqlDateTimeToTimezoneIso(row.updated_at),
  };
}
