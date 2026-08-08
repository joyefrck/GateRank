import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type {
  PerformanceCalibrationStatus,
  PerformanceProbeId,
  PerformanceReviewStatus,
  PerformanceRun,
  PerformanceRunInput,
  PerformanceRunMode,
  PerformanceRunNode,
  PerformanceScoringRuleVersion,
  PerformanceRunStatus,
} from '../types/domain';
import { sqlDateTimeToTimezoneIso } from '../utils/time';

interface PerformanceRunRow extends RowDataPacket {
  id: number;
  airport_id: number;
  sampled_at: string;
  sampled_date: string | null;
  source: string;
  status: PerformanceRunStatus;
  job_id: string | null;
  probe_id: PerformanceProbeId | null;
  region_code: string | null;
  provider: string | null;
  bandwidth_mbps: number | null;
  run_mode: PerformanceRunMode | null;
  test_profile: string | null;
  scoring_rule_version: PerformanceScoringRuleVersion | null;
  config_version: number | null;
  calibration_status: PerformanceCalibrationStatus | null;
  calibration_mbps: number | null;
  review_status: PerformanceReviewStatus | null;
  review_reasons_json: unknown;
  subscription_format: string | null;
  parsed_nodes_count: number;
  supported_nodes_count: number;
  selected_nodes_json: unknown;
  tested_nodes_json: unknown;
  available_nodes_count: number | null;
  unavailable_nodes_count: number | null;
  node_availability_percent: number | null;
  node_unavailability_percent: number | null;
  median_latency_ms: number | null;
  median_download_mbps: number | null;
  packet_loss_percent: number | null;
  error_code: string | null;
  error_message: string | null;
  diagnostics_json: unknown;
}

const SELECT_COLUMNS = `id, airport_id, sampled_at, sampled_date, source, status,
  job_id, probe_id, region_code, provider, bandwidth_mbps, run_mode, test_profile,
  scoring_rule_version, config_version, calibration_status, calibration_mbps,
  review_status, review_reasons_json, subscription_format, parsed_nodes_count,
  supported_nodes_count, selected_nodes_json, tested_nodes_json, available_nodes_count,
  unavailable_nodes_count, node_availability_percent, node_unavailability_percent,
  median_latency_ms, median_download_mbps, packet_loss_percent, error_code,
  error_message, diagnostics_json`;

export class PerformanceRunRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS airport_performance_runs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        airport_id BIGINT UNSIGNED NOT NULL,
        sampled_at DATETIME NOT NULL,
        sampled_date DATE NULL,
        source VARCHAR(128) NOT NULL DEFAULT 'cron-performance',
        status ENUM('success', 'partial', 'skipped', 'failed') NOT NULL,
        job_id CHAR(36) NULL,
        probe_id VARCHAR(64) NULL,
        region_code VARCHAR(64) NULL,
        provider VARCHAR(128) NULL,
        bandwidth_mbps INT UNSIGNED NULL,
        run_mode ENUM('shadow', 'official') NULL,
        test_profile VARCHAR(64) NULL,
        scoring_rule_version VARCHAR(64) NULL,
        config_version INT UNSIGNED NULL,
        calibration_status ENUM('not_required', 'passed', 'failed') NULL,
        calibration_mbps DECIMAL(10,2) NULL,
        review_status ENUM('normal', 'needs_review', 'suspicious') NULL,
        review_reasons_json JSON NULL,
        subscription_format VARCHAR(64) NULL,
        parsed_nodes_count INT UNSIGNED NOT NULL DEFAULT 0,
        supported_nodes_count INT UNSIGNED NOT NULL DEFAULT 0,
        selected_nodes_json JSON NOT NULL,
        tested_nodes_json JSON NOT NULL,
        available_nodes_count INT UNSIGNED NULL,
        unavailable_nodes_count INT UNSIGNED NULL,
        node_availability_percent DECIMAL(5,2) NULL,
        node_unavailability_percent DECIMAL(5,2) NULL,
        median_latency_ms DECIMAL(8,2) NULL,
        median_download_mbps DECIMAL(8,2) NULL,
        packet_loss_percent DECIMAL(5,2) NULL,
        error_code VARCHAR(64) NULL,
        error_message VARCHAR(1024) NULL,
        diagnostics_json JSON NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_perf_runs_airport_time (airport_id, sampled_at),
        INDEX idx_perf_runs_airport_date_probe (airport_id, sampled_date, probe_id, sampled_at),
        UNIQUE KEY uq_perf_runs_job (job_id),
        CONSTRAINT fk_perf_runs_airport FOREIGN KEY (airport_id) REFERENCES airports(id)
      )`,
    );
    await this.ensureColumn('available_nodes_count', 'INT UNSIGNED NULL AFTER tested_nodes_json');
    await this.ensureColumn('unavailable_nodes_count', 'INT UNSIGNED NULL AFTER available_nodes_count');
    await this.ensureColumn('node_availability_percent', 'DECIMAL(5,2) NULL AFTER unavailable_nodes_count');
    await this.ensureColumn('node_unavailability_percent', 'DECIMAL(5,2) NULL AFTER node_availability_percent');
    await this.ensureColumn('sampled_date', 'DATE NULL AFTER sampled_at');
    await this.ensureColumn('job_id', 'CHAR(36) NULL AFTER status');
    await this.ensureColumn('probe_id', 'VARCHAR(64) NULL AFTER job_id');
    await this.ensureColumn('region_code', 'VARCHAR(64) NULL AFTER probe_id');
    await this.ensureColumn('provider', 'VARCHAR(128) NULL AFTER region_code');
    await this.ensureColumn('bandwidth_mbps', 'INT UNSIGNED NULL AFTER provider');
    await this.ensureColumn("run_mode", "ENUM('shadow', 'official') NULL AFTER bandwidth_mbps");
    await this.ensureColumn('test_profile', 'VARCHAR(64) NULL AFTER run_mode');
    await this.ensureColumn('scoring_rule_version', 'VARCHAR(64) NULL AFTER test_profile');
    await this.ensureColumn('config_version', 'INT UNSIGNED NULL AFTER scoring_rule_version');
    await this.ensureColumn(
      'calibration_status',
      "ENUM('not_required', 'passed', 'failed') NULL AFTER config_version",
    );
    await this.ensureColumn('calibration_mbps', 'DECIMAL(10,2) NULL AFTER calibration_status');
    await this.ensureColumn(
      'review_status',
      "ENUM('normal', 'needs_review', 'suspicious') NULL AFTER calibration_mbps",
    );
    await this.ensureColumn('review_reasons_json', 'JSON NULL AFTER review_status');
    await this.ensureIndex('idx_perf_runs_airport_date_probe', '(airport_id, sampled_date, probe_id, sampled_at)');
    await this.ensureIndex('uq_perf_runs_job', '(job_id)', true);
  }

  async insert(input: PerformanceRunInput): Promise<number> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO airport_performance_runs (
         airport_id, sampled_at, sampled_date, source, status,
         job_id, probe_id, region_code, provider, bandwidth_mbps, run_mode,
         test_profile, scoring_rule_version, config_version, calibration_status,
         calibration_mbps, review_status, review_reasons_json, subscription_format,
         parsed_nodes_count, supported_nodes_count, selected_nodes_json, tested_nodes_json,
         available_nodes_count, unavailable_nodes_count, node_availability_percent, node_unavailability_percent,
         median_latency_ms, median_download_mbps, packet_loss_percent,
         error_code, error_message, diagnostics_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.airport_id,
        input.sampled_at,
        input.sampled_date || input.sampled_at.slice(0, 10),
        input.source || 'cron-performance',
        input.status,
        input.job_id ?? null,
        input.probe_id || 'legacy-control',
        input.region_code ?? null,
        input.provider ?? null,
        nullableNumber(input.bandwidth_mbps),
        input.run_mode || 'official',
        input.test_profile || 'legacy_single_target_v1',
        input.scoring_rule_version || 'legacy_v1',
        Math.max(0, Number(input.config_version || 0)),
        input.calibration_status || (input.probe_id && input.probe_id !== 'legacy-control' ? 'failed' : 'not_required'),
        nullableNumber(input.calibration_mbps),
        input.review_status || 'normal',
        JSON.stringify(input.review_reasons || []),
        input.subscription_format ?? null,
        Math.max(0, Number(input.parsed_nodes_count || 0)),
        Math.max(0, Number(input.supported_nodes_count || 0)),
        JSON.stringify(input.selected_nodes || []),
        JSON.stringify(input.tested_nodes || []),
        nullableNumber(input.available_nodes_count),
        nullableNumber(input.unavailable_nodes_count),
        nullableNumber(input.node_availability_percent),
        nullableNumber(input.node_unavailability_percent),
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
      `SELECT ${SELECT_COLUMNS}
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
      `SELECT ${SELECT_COLUMNS}
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

  async listByAirportAndDate(airportId: number, date: string): Promise<PerformanceRun[]> {
    const [rows] = await this.pool.query<PerformanceRunRow[]>(
      `SELECT ${SELECT_COLUMNS}
         FROM airport_performance_runs
        WHERE airport_id = ?
          AND sampled_at >= ?
          AND sampled_at <= ?
        ORDER BY sampled_at DESC, id DESC`,
      [airportId, `${date} 00:00:00`, `${date} 23:59:59`],
    );
    return rows.map(toPerformanceRun);
  }

  async markReviewStatus(
    runId: number,
    status: PerformanceReviewStatus,
    reasons: string[],
  ): Promise<void> {
    await this.pool.execute<ResultSetHeader>(
      `UPDATE airport_performance_runs
          SET review_status = ?, review_reasons_json = ?
        WHERE id = ?`,
      [status, JSON.stringify(reasons), runId],
    );
  }

  private async ensureColumn(columnName: string, definition: string): Promise<void> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT 1
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
        LIMIT 1`,
      ['airport_performance_runs', columnName],
    );

    if (rows.length === 0) {
      await this.pool.query(
        `ALTER TABLE airport_performance_runs ADD COLUMN ${columnName} ${definition}`,
      );
    }
  }

  private async ensureIndex(indexName: string, columns: string, unique = false): Promise<void> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT 1
         FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND INDEX_NAME = ?
        LIMIT 1`,
      ['airport_performance_runs', indexName],
    );
    if (rows.length === 0) {
      await this.pool.query(
        `ALTER TABLE airport_performance_runs ADD ${unique ? 'UNIQUE ' : ''}INDEX ${indexName} ${columns}`,
      );
    }
  }
}

function toPerformanceRun(row: PerformanceRunRow): PerformanceRun {
  return {
    id: row.id,
    airport_id: row.airport_id,
    sampled_at: sqlDateTimeToTimezoneIso(row.sampled_at),
    sampled_date: row.sampled_date ? String(row.sampled_date).slice(0, 10) : String(row.sampled_at).slice(0, 10),
    source: row.source,
    status: row.status,
    job_id: row.job_id,
    probe_id: row.probe_id || 'legacy-control',
    region_code: row.region_code,
    provider: row.provider,
    bandwidth_mbps: nullableNumber(row.bandwidth_mbps),
    run_mode: row.run_mode || 'official',
    test_profile: row.test_profile || 'legacy_single_target_v1',
    scoring_rule_version: row.scoring_rule_version || 'legacy_v1',
    config_version: Number(row.config_version || 0),
    calibration_status: row.calibration_status || 'not_required',
    calibration_mbps: nullableNumber(row.calibration_mbps),
    review_status: row.review_status || 'normal',
    review_reasons: safeStringArray(row.review_reasons_json),
    subscription_format: row.subscription_format,
    parsed_nodes_count: Number(row.parsed_nodes_count),
    supported_nodes_count: Number(row.supported_nodes_count),
    selected_nodes: safeNodeArray(row.selected_nodes_json),
    tested_nodes: safeNodeArray(row.tested_nodes_json),
    available_nodes_count: nullableNumber(row.available_nodes_count),
    unavailable_nodes_count: nullableNumber(row.unavailable_nodes_count),
    node_availability_percent: nullableNumber(row.node_availability_percent),
    node_unavailability_percent: nullableNumber(row.node_unavailability_percent),
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
        proxy_http_request_failures: nullableNumber(record.proxy_http_request_failures),
        proxy_http_request_attempts: nullableNumber(record.proxy_http_request_attempts),
        proxy_http_request_failure_percent: nullableNumber(record.proxy_http_request_failure_percent),
        connect_failures: nullableNumber(record.connect_failures),
        connect_attempts: nullableNumber(record.connect_attempts),
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

function safeStringArray(value: unknown): string[] {
  const parsed = safeJson(value);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}
