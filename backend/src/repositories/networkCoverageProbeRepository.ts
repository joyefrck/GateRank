import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { PerformanceProbeId } from '../types/domain';

export const COVERAGE_PROBE_PROFILE = 'network_coverage_proxy_http_v1';
export interface CoverageProbeResult {
  sampled_at: string;
  status: 'success' | 'failed';
  nodes: Array<{ key: string; healthy: boolean; error_code: string | null }>;
}
export interface CoverageProbeBatch {
  id: number;
  batch_key: string;
  airport_id: number;
  date: string;
  sampled_at: string;
  source: string;
  snapshot_id: number;
  jobs: Partial<Record<PerformanceProbeId, string>>;
  results: Partial<Record<PerformanceProbeId, CoverageProbeResult>>;
  status: 'pending' | 'completed' | 'failed' | 'superseded';
  run_id: number | null;
}

export class NetworkCoverageProbeRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS network_coverage_probe_batches (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      batch_key CHAR(36) NOT NULL UNIQUE,
      airport_id BIGINT UNSIGNED NOT NULL,
      sampled_date DATE NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      data_json JSON NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_coverage_batch_airport (airport_id, sampled_date, status, id),
      CONSTRAINT fk_coverage_batch_airport FOREIGN KEY (airport_id) REFERENCES airports(id)
    )`);
  }

  async insert(batch: CoverageProbeBatch, connection: PoolConnection): Promise<void> {
    const [result] = await connection.execute<ResultSetHeader>(
      'INSERT INTO network_coverage_probe_batches (batch_key, airport_id, sampled_date, status, data_json) VALUES (?, ?, ?, ?, ?)',
      [batch.batch_key, batch.airport_id, batch.date, batch.status, JSON.stringify(batch)],
    );
    batch.id = result.insertId;
  }

  async get(batchKey: string, connection: Pool | PoolConnection = this.pool, lock = false): Promise<CoverageProbeBatch | null> {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT id, data_json FROM network_coverage_probe_batches WHERE batch_key = ?${lock ? ' FOR UPDATE' : ''}`,
      [batchKey],
    );
    if (!rows[0]) return null;
    const data = typeof rows[0].data_json === 'string' ? JSON.parse(rows[0].data_json) : rows[0].data_json;
    return { ...data, id: Number(rows[0].id) };
  }

  async save(batch: CoverageProbeBatch, connection: PoolConnection): Promise<void> {
    await connection.execute('UPDATE network_coverage_probe_batches SET status = ?, data_json = ? WHERE id = ?',
      [batch.status, JSON.stringify(batch), batch.id]);
  }

  async hasNewerCompleted(batch: CoverageProbeBatch, connection: PoolConnection): Promise<boolean> {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM network_coverage_probe_batches WHERE airport_id = ? AND sampled_date = ? AND status = 'completed' AND id > ? LIMIT 1",
      [batch.airport_id, batch.date, batch.id],
    );
    return rows.length > 0;
  }

  async lockAirport(airportId: number, connection: PoolConnection): Promise<void> {
    await connection.query('SELECT id FROM airports WHERE id = ? FOR UPDATE', [airportId]);
  }
}
