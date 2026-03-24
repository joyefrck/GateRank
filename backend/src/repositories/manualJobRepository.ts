import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { ManualJob, ManualJobKind, ManualJobStatus } from '../types/domain';
import { formatDateOnly, sqlDateTimeToTimezoneIso } from '../utils/time';

interface ManualJobRow extends RowDataPacket {
  id: number;
  airport_id: number;
  date: unknown;
  kind: ManualJobKind;
  status: ManualJobStatus;
  message: string | null;
  created_by: string;
  request_id: string;
  started_at: unknown;
  finished_at: unknown;
  created_at: unknown;
  updated_at: unknown;
}

export class ManualJobRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS admin_manual_jobs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        airport_id BIGINT UNSIGNED NOT NULL,
        date DATE NOT NULL,
        kind ENUM('full', 'stability', 'performance', 'risk', 'time_decay') NOT NULL,
        status ENUM('queued', 'running', 'succeeded', 'failed') NOT NULL DEFAULT 'queued',
        message TEXT NULL,
        created_by VARCHAR(128) NOT NULL,
        request_id VARCHAR(64) NOT NULL,
        started_at DATETIME NULL,
        finished_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_admin_manual_jobs_lookup (airport_id, date, kind, status),
        INDEX idx_admin_manual_jobs_created_at (created_at),
        CONSTRAINT fk_admin_manual_jobs_airport FOREIGN KEY (airport_id) REFERENCES airports(id)
      )
    `);
  }

  async create(input: {
    airport_id: number;
    date: string;
    kind: ManualJobKind;
    created_by: string;
    request_id: string;
  }): Promise<ManualJob> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO admin_manual_jobs (airport_id, date, kind, status, created_by, request_id)
       VALUES (?, ?, ?, 'queued', ?, ?)`,
      [input.airport_id, input.date, input.kind, input.created_by, input.request_id],
    );
    const job = await this.getById(result.insertId);
    if (!job) {
      throw new Error(`manual job ${result.insertId} not found after create`);
    }
    return job;
  }

  async getById(id: number): Promise<ManualJob | null> {
    const [rows] = await this.pool.query<ManualJobRow[]>(
      `SELECT id, airport_id, date, kind, status, message, created_by, request_id,
              started_at, finished_at, created_at, updated_at
         FROM admin_manual_jobs
        WHERE id = ?
        LIMIT 1`,
      [id],
    );
    return rows[0] ? toManualJob(rows[0]) : null;
  }

  async findActive(airportId: number, date: string, kind: ManualJobKind): Promise<ManualJob | null> {
    const [rows] = await this.pool.query<ManualJobRow[]>(
      `SELECT id, airport_id, date, kind, status, message, created_by, request_id,
              started_at, finished_at, created_at, updated_at
         FROM admin_manual_jobs
        WHERE airport_id = ?
          AND date = ?
          AND kind = ?
          AND status IN ('queued', 'running')
        ORDER BY id DESC
        LIMIT 1`,
      [airportId, date, kind],
    );
    return rows[0] ? toManualJob(rows[0]) : null;
  }

  async markRunning(id: number, message: string | null = null): Promise<void> {
    await this.pool.execute<ResultSetHeader>(
      `UPDATE admin_manual_jobs
          SET status = 'running',
              message = ?,
              started_at = CURRENT_TIMESTAMP,
              finished_at = NULL
        WHERE id = ?`,
      [message, id],
    );
  }

  async markFinished(id: number, status: Extract<ManualJobStatus, 'succeeded' | 'failed'>, message: string | null): Promise<void> {
    await this.pool.execute<ResultSetHeader>(
      `UPDATE admin_manual_jobs
          SET status = ?,
              message = ?,
              finished_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [status, message, id],
    );
  }

  async failActiveJobs(message: string): Promise<void> {
    await this.pool.execute<ResultSetHeader>(
      `UPDATE admin_manual_jobs
          SET status = 'failed',
              message = ?,
              finished_at = CURRENT_TIMESTAMP
        WHERE status IN ('queued', 'running')`,
      [message],
    );
  }
}

function toManualJob(row: ManualJobRow): ManualJob {
  return {
    id: row.id,
    airport_id: row.airport_id,
    date: formatDateOnly(row.date),
    kind: row.kind,
    status: row.status,
    message: row.message,
    created_by: row.created_by,
    request_id: row.request_id,
    started_at: toDateTimeString(row.started_at),
    finished_at: toDateTimeString(row.finished_at),
    created_at: toDateTimeString(row.created_at) || new Date().toISOString(),
    updated_at: toDateTimeString(row.updated_at) || new Date().toISOString(),
  };
}

function toDateTimeString(value: unknown): string | null {
  if (!value) {
    return null;
  }
  return sqlDateTimeToTimezoneIso(value);
}
