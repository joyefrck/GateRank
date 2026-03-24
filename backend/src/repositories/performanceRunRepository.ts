import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type {
  PerformanceRun,
  PerformanceRunInput,
  PerformanceRunNode,
  PerformanceRunStatus,
} from '../types/domain';
import { sqlDateTimeToTimezoneIso } from '../utils/time';

interface PerformanceRunRow extends RowDataPacket {
  id: number;
  airport_id: number;
  sampled_at: string;
  source: string;
  status: PerformanceRunStatus;
  subscription_format: string | null;
  parsed_nodes_count: number;
  supported_nodes_count: number;
  selected_nodes_json: unknown;
  tested_nodes_json: unknown;
  median_latency_ms: number | null;
  median_download_mbps: number | null;
  packet_loss_percent: number | null;
  error_code: string | null;
  error_message: string | null;
  diagnostics_json: unknown;
}

export class PerformanceRunRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS airport_performance_runs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        airport_id BIGINT UNSIGNED NOT NULL,
        sampled_at DATETIME NOT NULL,
        source VARCHAR(128) NOT NULL DEFAULT 'cron-performance',
        status ENUM('success', 'partial', 'skipped', 'failed') NOT NULL,
        subscription_format VARCHAR(64) NULL,
        parsed_nodes_count INT UNSIGNED NOT NULL DEFAULT 0,
        supported_nodes_count INT UNSIGNED NOT NULL DEFAULT 0,
        selected_nodes_json JSON NOT NULL,
        tested_nodes_json JSON NOT NULL,
        median_latency_ms DECIMAL(8,2) NULL,
        median_download_mbps DECIMAL(8,2) NULL,
        packet_loss_percent DECIMAL(5,2) NULL,
        error_code VARCHAR(64) NULL,
        error_message VARCHAR(1024) NULL,
        diagnostics_json JSON NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_perf_runs_airport_time (airport_id, sampled_at),
        CONSTRAINT fk_perf_runs_airport FOREIGN KEY (airport_id) REFERENCES airports(id)
      )`,
    );
  }

  async insert(input: PerformanceRunInput): Promise<number> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO airport_performance_runs (
         airport_id, sampled_at, source, status, subscription_format,
         parsed_nodes_count, supported_nodes_count, selected_nodes_json, tested_nodes_json,
         median_latency_ms, median_download_mbps, packet_loss_percent,
         error_code, error_message, diagnostics_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.airport_id,
        input.sampled_at,
        input.source || 'cron-performance',
        input.status,
        input.subscription_format ?? null,
        Math.max(0, Number(input.parsed_nodes_count || 0)),
        Math.max(0, Number(input.supported_nodes_count || 0)),
        JSON.stringify(input.selected_nodes || []),
        JSON.stringify(input.tested_nodes || []),
        nullableNumber(input.median_latency_ms),
        nullableNumber(input.median_download_mbps),
        nullableNumber(input.packet_loss_percent),
        input.error_code ?? null,
        input.error_message ?? null,
        JSON.stringify(input.diagnostics || {}),
      ],
    );
    return result.insertId;
  }

  async getLatestByAirportAndDate(airportId: number, date: string): Promise<PerformanceRun | null> {
    const [rows] = await this.pool.query<PerformanceRunRow[]>(
      `SELECT id, airport_id, sampled_at, source, status, subscription_format,
              parsed_nodes_count, supported_nodes_count, selected_nodes_json, tested_nodes_json,
              median_latency_ms, median_download_mbps, packet_loss_percent,
              error_code, error_message, diagnostics_json
         FROM airport_performance_runs
        WHERE airport_id = ?
          AND sampled_at >= ?
          AND sampled_at <= ?
        ORDER BY sampled_at DESC, id DESC
        LIMIT 1`,
      [airportId, `${date} 00:00:00`, `${date} 23:59:59`],
    );

    if (rows.length === 0) {
      return null;
    }

    return toPerformanceRun(rows[0]);
  }

  async getLatestByAirportBeforeDate(airportId: number, date: string): Promise<PerformanceRun | null> {
    const [rows] = await this.pool.query<PerformanceRunRow[]>(
      `SELECT id, airport_id, sampled_at, source, status, subscription_format,
              parsed_nodes_count, supported_nodes_count, selected_nodes_json, tested_nodes_json,
              median_latency_ms, median_download_mbps, packet_loss_percent,
              error_code, error_message, diagnostics_json
         FROM airport_performance_runs
        WHERE airport_id = ?
          AND sampled_at <= ?
        ORDER BY sampled_at DESC, id DESC
        LIMIT 1`,
      [airportId, `${date} 23:59:59`],
    );

    if (rows.length === 0) {
      return null;
    }

    return toPerformanceRun(rows[0]);
  }
}

function toPerformanceRun(row: PerformanceRunRow): PerformanceRun {
  return {
    id: row.id,
    airport_id: row.airport_id,
    sampled_at: sqlDateTimeToTimezoneIso(row.sampled_at),
    source: row.source,
    status: row.status,
    subscription_format: row.subscription_format,
    parsed_nodes_count: Number(row.parsed_nodes_count),
    supported_nodes_count: Number(row.supported_nodes_count),
    selected_nodes: safeNodeArray(row.selected_nodes_json),
    tested_nodes: safeNodeArray(row.tested_nodes_json),
    median_latency_ms: nullableNumber(row.median_latency_ms),
    median_download_mbps: nullableNumber(row.median_download_mbps),
    packet_loss_percent: nullableNumber(row.packet_loss_percent),
    error_code: row.error_code,
    error_message: row.error_message,
    diagnostics: safeObject(row.diagnostics_json),
  };
}

function safeNodeArray(value: unknown): PerformanceRunNode[] {
  const parsed = safeJson(value);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const record = item as Record<string, unknown>;
      return {
        name: String(record.name || ''),
        region: record.region == null ? null : String(record.region),
        type: record.type == null ? null : String(record.type),
        status: record.status == null ? null : String(record.status),
        error_code: record.error_code == null ? null : String(record.error_code),
        connect_latency_samples_ms: safeNumberArray(record.connect_latency_samples_ms),
        connect_latency_median_ms: nullableNumber(record.connect_latency_median_ms),
        proxy_http_latency_samples_ms: safeNumberArray(record.proxy_http_latency_samples_ms),
        proxy_http_latency_median_ms: nullableNumber(record.proxy_http_latency_median_ms),
        download_mbps: nullableNumber(record.download_mbps),
      };
    })
    .filter((item) => item.name);
}

function safeObject(value: unknown): Record<string, unknown> {
  const parsed = safeJson(value);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

function safeJson(value: unknown): unknown {
  if (value == null) {
    return null;
  }
  if (typeof value === 'object') {
    return value;
  }
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function nullableNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function safeNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}
