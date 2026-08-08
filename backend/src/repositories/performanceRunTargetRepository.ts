import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import type { PerformanceRunTarget } from '../types/domain';
import { sqlDateTimeToTimezoneIso } from '../utils/time';

interface PerformanceRunTargetRow extends RowDataPacket {
  run_id: number;
  node_key: string;
  target_key: string;
  bytes_downloaded: number;
  duration_ms: number;
  download_mbps: number | null;
  http_status: number | null;
  error_code: string | null;
  valid: number;
  created_at: string;
}

export class PerformanceRunTargetRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS performance_run_targets (
        run_id BIGINT UNSIGNED NOT NULL,
        node_key VARCHAR(128) NOT NULL,
        target_key VARCHAR(128) NOT NULL,
        bytes_downloaded BIGINT UNSIGNED NOT NULL DEFAULT 0,
        duration_ms DECIMAL(12,2) NOT NULL DEFAULT 0,
        download_mbps DECIMAL(10,2) NULL,
        http_status SMALLINT UNSIGNED NULL,
        error_code VARCHAR(128) NULL,
        valid TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (run_id, node_key, target_key),
        INDEX idx_performance_run_targets_target (target_key, created_at),
        CONSTRAINT fk_performance_run_targets_run FOREIGN KEY (run_id) REFERENCES airport_performance_runs(id) ON DELETE CASCADE
      )`,
    );
  }

  async insertMany(targets: PerformanceRunTarget[]): Promise<void> {
    for (const target of targets) {
      validateTarget(target);
      await this.pool.execute<ResultSetHeader>(
        `INSERT INTO performance_run_targets (
           run_id, node_key, target_key, bytes_downloaded, duration_ms,
           download_mbps, http_status, error_code, valid
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           bytes_downloaded = VALUES(bytes_downloaded),
           duration_ms = VALUES(duration_ms),
           download_mbps = VALUES(download_mbps),
           http_status = VALUES(http_status),
           error_code = VALUES(error_code),
           valid = VALUES(valid)`,
        [
          target.run_id,
          target.node_key,
          target.target_key,
          target.bytes_downloaded,
          target.duration_ms,
          target.download_mbps,
          target.http_status,
          target.error_code,
          target.valid ? 1 : 0,
        ],
      );
    }
  }

  async listByRun(runId: number): Promise<PerformanceRunTarget[]> {
    const [rows] = await this.pool.query<PerformanceRunTargetRow[]>(
      `SELECT run_id, node_key, target_key, bytes_downloaded, duration_ms,
              download_mbps, http_status, error_code, valid, created_at
         FROM performance_run_targets
        WHERE run_id = ?
        ORDER BY node_key, target_key`,
      [runId],
    );
    return rows.map((row) => ({
      run_id: Number(row.run_id),
      node_key: row.node_key,
      target_key: row.target_key,
      bytes_downloaded: Number(row.bytes_downloaded),
      duration_ms: Number(row.duration_ms),
      download_mbps: nullableNumber(row.download_mbps),
      http_status: nullableNumber(row.http_status),
      error_code: row.error_code,
      valid: Boolean(row.valid),
      created_at: sqlDateTimeToTimezoneIso(row.created_at),
    }));
  }

  async listByDate(date: string): Promise<Array<PerformanceRunTarget & { airport_id: number }>> {
    const [rows] = await this.pool.query<Array<PerformanceRunTargetRow & { airport_id: number }>>(
      `SELECT t.run_id, r.airport_id, t.node_key, t.target_key, t.bytes_downloaded,
              t.duration_ms, t.download_mbps, t.http_status, t.error_code, t.valid, t.created_at
         FROM performance_run_targets t
         JOIN airport_performance_runs r ON r.id = t.run_id
        WHERE r.sampled_date = ?
        ORDER BY t.target_key, r.airport_id, t.run_id, t.node_key`,
      [date],
    );
    return rows.map((row) => ({
      run_id: Number(row.run_id),
      airport_id: Number(row.airport_id),
      node_key: row.node_key,
      target_key: row.target_key,
      bytes_downloaded: Number(row.bytes_downloaded),
      duration_ms: Number(row.duration_ms),
      download_mbps: nullableNumber(row.download_mbps),
      http_status: nullableNumber(row.http_status),
      error_code: row.error_code,
      valid: Boolean(row.valid),
      created_at: sqlDateTimeToTimezoneIso(row.created_at),
    }));
  }
}

function validateTarget(target: PerformanceRunTarget): void {
  for (const [field, value] of Object.entries({
    run_id: target.run_id,
    bytes_downloaded: target.bytes_downloaded,
    duration_ms: target.duration_ms,
  })) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`${field} must be non-negative and finite`);
  }
  if (target.download_mbps !== null && (!Number.isFinite(target.download_mbps) || target.download_mbps < 0)) {
    throw new Error('download_mbps must be null or a non-negative finite number');
  }
  if (!target.node_key.trim() || !target.target_key.trim()) throw new Error('node_key and target_key are required');
}

function nullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
