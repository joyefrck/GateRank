import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import type {
  PerformanceProbeId,
  PerformanceProbeJob,
  PerformanceProbeJobInput,
} from '../types/domain';
import { sqlDateTimeToTimezoneIso } from '../utils/time';

interface PerformanceProbeJobRow extends RowDataPacket, Omit<PerformanceProbeJob,
  'test_enabled_snapshot' | 'include_in_result_snapshot' | 'lease_expires_at' |
  'selected_node_keys' | 'created_at' | 'updated_at' | 'completed_at'> {
  test_enabled_snapshot: number;
  include_in_result_snapshot: number;
  selected_node_keys_json: unknown;
  lease_expires_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

const SELECT_COLUMNS = `job_id, airport_id, probe_id, node_snapshot_id, config_version,
  test_enabled_snapshot, include_in_result_snapshot, test_profile, scoring_rule_version,
  selected_node_keys_json,
  source, status, lease_owner, lease_expires_at, attempts, idempotency_key, run_id,
  created_at, updated_at, completed_at`;

export class PerformanceProbeJobRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS performance_probe_jobs (
        job_id CHAR(36) NOT NULL,
        airport_id BIGINT UNSIGNED NOT NULL,
        probe_id VARCHAR(64) NOT NULL,
        node_snapshot_id BIGINT UNSIGNED NOT NULL,
        config_version INT UNSIGNED NOT NULL,
        test_enabled_snapshot TINYINT(1) NOT NULL,
        include_in_result_snapshot TINYINT(1) NOT NULL,
        test_profile VARCHAR(64) NOT NULL,
        scoring_rule_version VARCHAR(64) NOT NULL,
        selected_node_keys_json JSON NOT NULL,
        source VARCHAR(128) NOT NULL,
        status ENUM('queued', 'leased', 'completed', 'failed', 'expired') NOT NULL DEFAULT 'queued',
        lease_owner VARCHAR(128) NULL,
        lease_expires_at DATETIME NULL,
        attempts INT UNSIGNED NOT NULL DEFAULT 0,
        idempotency_key VARCHAR(255) NOT NULL,
        run_id BIGINT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        completed_at DATETIME NULL,
        PRIMARY KEY (job_id),
        UNIQUE KEY uq_performance_probe_jobs_idempotency (probe_id, idempotency_key),
        INDEX idx_performance_probe_jobs_lease (probe_id, status, created_at),
        INDEX idx_performance_probe_jobs_airport (airport_id, created_at),
        CONSTRAINT fk_performance_probe_jobs_airport FOREIGN KEY (airport_id) REFERENCES airports(id),
        CONSTRAINT fk_performance_probe_jobs_probe FOREIGN KEY (probe_id) REFERENCES performance_probes(probe_id),
        CONSTRAINT fk_performance_probe_jobs_snapshot FOREIGN KEY (node_snapshot_id) REFERENCES airport_subscription_node_snapshots(id)
      )`,
    );
    await this.ensureColumn('selected_node_keys_json', "JSON NULL AFTER scoring_rule_version");
  }

  async create(input: PerformanceProbeJobInput): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `INSERT IGNORE INTO performance_probe_jobs (
         job_id, airport_id, probe_id, node_snapshot_id, config_version,
         test_enabled_snapshot, include_in_result_snapshot, test_profile,
         scoring_rule_version, selected_node_keys_json, source, idempotency_key
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.job_id,
        input.airport_id,
        input.probe_id,
        input.node_snapshot_id,
        input.config_version,
        input.test_enabled_snapshot ? 1 : 0,
        input.include_in_result_snapshot ? 1 : 0,
        input.test_profile,
        input.scoring_rule_version,
        JSON.stringify(input.selected_node_keys),
        input.source,
        input.idempotency_key,
      ],
    );
    return result.affectedRows > 0;
  }

  async leaseNext(
    probeId: PerformanceProbeId,
    leaseOwner: string,
    leaseSeconds: number,
  ): Promise<PerformanceProbeJob | null> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute<ResultSetHeader>(
        `UPDATE performance_probe_jobs
            SET status = 'queued', lease_owner = NULL, lease_expires_at = NULL
          WHERE probe_id = ? AND status = 'leased' AND lease_expires_at < CURRENT_TIMESTAMP`,
        [probeId],
      );
      const [rows] = await connection.query<PerformanceProbeJobRow[]>(
        `SELECT ${SELECT_COLUMNS}
           FROM performance_probe_jobs
          WHERE probe_id = ? AND status = 'queued'
          ORDER BY created_at ASC
          LIMIT 1
          FOR UPDATE`,
        [probeId],
      );
      const row = rows[0];
      if (!row) {
        await connection.commit();
        return null;
      }
      const seconds = Math.max(30, Math.min(Math.floor(leaseSeconds), 3600));
      await connection.execute<ResultSetHeader>(
        `UPDATE performance_probe_jobs
            SET status = 'leased', lease_owner = ?,
                lease_expires_at = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? SECOND),
                attempts = attempts + 1
          WHERE job_id = ? AND status = 'queued'`,
        [leaseOwner, seconds, row.job_id],
      );
      await connection.commit();
      return {
        ...toPerformanceProbeJob(row),
        status: 'leased',
        lease_owner: leaseOwner,
        attempts: Number(row.attempts) + 1,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async getById(jobId: string): Promise<PerformanceProbeJob | null> {
    const [rows] = await this.pool.query<PerformanceProbeJobRow[]>(
      `SELECT ${SELECT_COLUMNS} FROM performance_probe_jobs WHERE job_id = ? LIMIT 1`,
      [jobId],
    );
    return rows[0] ? toPerformanceProbeJob(rows[0]) : null;
  }

  async markCompleted(jobId: string, probeId: PerformanceProbeId, runId: number): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE performance_probe_jobs
          SET status = 'completed', run_id = ?, completed_at = CURRENT_TIMESTAMP,
              lease_expires_at = NULL
        WHERE job_id = ? AND probe_id = ? AND status IN ('leased', 'completed')`,
      [runId, jobId, probeId],
    );
    return result.affectedRows > 0;
  }

  private async ensureColumn(columnName: string, definition: string): Promise<void> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT 1
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'performance_probe_jobs'
          AND COLUMN_NAME = ?
        LIMIT 1`,
      [columnName],
    );
    if (rows.length === 0) {
      await this.pool.query(`ALTER TABLE performance_probe_jobs ADD COLUMN ${columnName} ${definition}`);
      if (columnName === 'selected_node_keys_json') {
        await this.pool.query("UPDATE performance_probe_jobs SET selected_node_keys_json = JSON_ARRAY() WHERE selected_node_keys_json IS NULL");
      }
    }
  }
}

function toPerformanceProbeJob(row: PerformanceProbeJobRow): PerformanceProbeJob {
  return {
    ...row,
    airport_id: Number(row.airport_id),
    node_snapshot_id: Number(row.node_snapshot_id),
    config_version: Number(row.config_version),
    test_enabled_snapshot: Boolean(row.test_enabled_snapshot),
    include_in_result_snapshot: Boolean(row.include_in_result_snapshot),
    selected_node_keys: safeStringArray(row.selected_node_keys_json),
    attempts: Number(row.attempts),
    run_id: row.run_id == null ? null : Number(row.run_id),
    lease_expires_at: nullableDate(row.lease_expires_at),
    created_at: sqlDateTimeToTimezoneIso(row.created_at),
    updated_at: sqlDateTimeToTimezoneIso(row.updated_at),
    completed_at: nullableDate(row.completed_at),
  };
}

function nullableDate(value: string | null): string | null {
  return value == null ? null : sqlDateTimeToTimezoneIso(value);
}

function safeStringArray(value: unknown): string[] {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}
