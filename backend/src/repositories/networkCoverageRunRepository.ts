import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type {
  NetworkCoverageRun,
  NetworkCoverageRunInput,
  NetworkCoverageRunNode,
  NetworkCoverageRunStatus,
} from '../types/domain';
import { computeNetworkCoverageScore } from '../services/networkCoverageScoring';
import { formatDateOnly, sqlDateTimeToTimezoneIso } from '../utils/time';

interface NetworkCoverageRunRow extends RowDataPacket {
  id: number;
  airport_id: number;
  sampled_at: unknown;
  sampled_date: unknown;
  source: string;
  status: NetworkCoverageRunStatus;
  subscription_format: string | null;
  detected_nodes_count: number;
  healthy_nodes_count: number;
  unhealthy_nodes_count: number;
  unsupported_nodes_count: number;
  unknown_healthy_nodes_count: number;
  healthy_node_rate: number;
  core_regions_json: unknown;
  extended_regions_json: unknown;
  region_counts_json: unknown;
  max_region_code: string | null;
  max_region_share: number;
  node_count_score: number;
  core_coverage_score: number;
  extended_coverage_score: number;
  region_score: number;
  health_rate_score: number;
  balance_score: number;
  score_n: number;
  rule_version: string;
  nodes_json: unknown;
  error_code: string | null;
  error_message: string | null;
  diagnostics_json: unknown;
  created_at: unknown;
}

const SELECT_COLUMNS = `id, airport_id, sampled_at, sampled_date, source, status,
  subscription_format, detected_nodes_count, healthy_nodes_count, unhealthy_nodes_count,
  unsupported_nodes_count, unknown_healthy_nodes_count, healthy_node_rate,
  core_regions_json, extended_regions_json, region_counts_json, max_region_code,
  max_region_share, node_count_score, core_coverage_score, extended_coverage_score,
  region_score, health_rate_score, balance_score, score_n, rule_version, nodes_json,
  error_code, error_message, diagnostics_json, created_at`;

export class NetworkCoverageRunRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS airport_network_coverage_runs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        airport_id BIGINT UNSIGNED NOT NULL,
        sampled_at DATETIME NOT NULL,
        sampled_date DATE NOT NULL,
        source VARCHAR(128) NOT NULL DEFAULT 'network-coverage',
        status ENUM('success', 'partial', 'skipped', 'failed') NOT NULL,
        subscription_format VARCHAR(64) NULL,
        detected_nodes_count INT UNSIGNED NOT NULL DEFAULT 0,
        healthy_nodes_count INT UNSIGNED NOT NULL DEFAULT 0,
        unhealthy_nodes_count INT UNSIGNED NOT NULL DEFAULT 0,
        unsupported_nodes_count INT UNSIGNED NOT NULL DEFAULT 0,
        unknown_healthy_nodes_count INT UNSIGNED NOT NULL DEFAULT 0,
        healthy_node_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
        core_regions_json JSON NOT NULL,
        extended_regions_json JSON NOT NULL,
        region_counts_json JSON NOT NULL,
        max_region_code VARCHAR(32) NULL,
        max_region_share DECIMAL(5,2) NOT NULL DEFAULT 0,
        node_count_score DECIMAL(6,2) NOT NULL DEFAULT 0,
        core_coverage_score DECIMAL(6,2) NOT NULL DEFAULT 0,
        extended_coverage_score DECIMAL(6,2) NOT NULL DEFAULT 0,
        region_score DECIMAL(6,2) NOT NULL DEFAULT 0,
        health_rate_score DECIMAL(6,2) NOT NULL DEFAULT 0,
        balance_score DECIMAL(6,2) NOT NULL DEFAULT 0,
        score_n DECIMAL(6,2) NOT NULL DEFAULT 0,
        rule_version VARCHAR(64) NOT NULL,
        nodes_json JSON NOT NULL,
        error_code VARCHAR(128) NULL,
        error_message TEXT NULL,
        diagnostics_json JSON NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_network_coverage_airport_date (airport_id, sampled_date, sampled_at DESC),
        INDEX idx_network_coverage_date_status (sampled_date, status),
        CONSTRAINT fk_network_coverage_airport FOREIGN KEY (airport_id) REFERENCES airports(id)
      )
    `);
    await this.ensureScoreNColumn();
  }

  async insert(input: NetworkCoverageRunInput): Promise<NetworkCoverageRun> {
    const score = computeNetworkCoverageScore(input.nodes || [], input.unsupported_nodes_count || 0);
    const [result] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO airport_network_coverage_runs (
         airport_id, sampled_at, sampled_date, source, status, subscription_format,
         detected_nodes_count, healthy_nodes_count, unhealthy_nodes_count, unsupported_nodes_count,
         unknown_healthy_nodes_count, healthy_node_rate, core_regions_json, extended_regions_json,
         region_counts_json, max_region_code, max_region_share, node_count_score,
         core_coverage_score, extended_coverage_score, region_score, health_rate_score,
         balance_score, score_n, rule_version, nodes_json, error_code, error_message, diagnostics_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.airport_id,
        input.sampled_at,
        input.sampled_date,
        input.source,
        input.status,
        input.subscription_format ?? null,
        score.detected_nodes_count,
        score.healthy_nodes_count,
        score.unhealthy_nodes_count,
        score.unsupported_nodes_count,
        score.unknown_healthy_nodes_count,
        score.healthy_node_rate,
        JSON.stringify(score.core_regions),
        JSON.stringify(score.extended_regions),
        JSON.stringify(score.region_counts),
        score.max_region_code,
        score.max_region_share,
        score.node_count_score,
        score.core_coverage_score,
        score.extended_coverage_score,
        score.region_score,
        score.health_rate_score,
        score.balance_score,
        score.score_n,
        score.rule_version,
        JSON.stringify(score.nodes),
        input.error_code ?? null,
        input.error_message ?? null,
        JSON.stringify(input.diagnostics || {}),
      ],
    );
    const created = await this.getById(result.insertId);
    if (!created) throw new Error(`network coverage run ${result.insertId} not found after insert`);
    return created;
  }

  async getById(id: number): Promise<NetworkCoverageRun | null> {
    const [rows] = await this.pool.query<NetworkCoverageRunRow[]>(
      `SELECT ${SELECT_COLUMNS} FROM airport_network_coverage_runs WHERE id = ? LIMIT 1`,
      [id],
    );
    return rows[0] ? toRun(rows[0]) : null;
  }

  async getLatestByAirportAndDate(airportId: number, date: string): Promise<NetworkCoverageRun | null> {
    const [rows] = await this.pool.query<NetworkCoverageRunRow[]>(
      `SELECT ${SELECT_COLUMNS}
         FROM airport_network_coverage_runs
        WHERE airport_id = ? AND sampled_date = ?
        ORDER BY sampled_at DESC, id DESC
        LIMIT 1`,
      [airportId, date],
    );
    return rows[0] ? toRun(rows[0]) : null;
  }

  async getLatestSuccessfulByAirportAndDate(airportId: number, date: string): Promise<NetworkCoverageRun | null> {
    const [rows] = await this.pool.query<NetworkCoverageRunRow[]>(
      `SELECT ${SELECT_COLUMNS}
         FROM airport_network_coverage_runs
        WHERE airport_id = ? AND sampled_date = ? AND status = 'success'
        ORDER BY sampled_at DESC, id DESC
        LIMIT 1`,
      [airportId, date],
    );
    return rows[0] ? toRun(rows[0]) : null;
  }

  async getSuccessfulByAirportIdsAndDate(airportIds: number[], date: string): Promise<Map<number, NetworkCoverageRun>> {
    if (airportIds.length === 0) return new Map();
    const placeholders = airportIds.map(() => '?').join(', ');
    const [rows] = await this.pool.query<NetworkCoverageRunRow[]>(
      `SELECT ${SELECT_COLUMNS}
         FROM airport_network_coverage_runs
        WHERE id IN (
          SELECT MAX(id)
            FROM airport_network_coverage_runs
           WHERE sampled_date = ? AND status = 'success' AND airport_id IN (${placeholders})
           GROUP BY airport_id
        )`,
      [date, ...airportIds],
    );
    return new Map(rows.map((row) => [Number(row.airport_id), toRun(row)]));
  }

  private async ensureScoreNColumn(): Promise<void> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'airport_scores_daily'
          AND COLUMN_NAME = 'score_n' LIMIT 1`,
    );
    if (rows.length === 0) {
      await this.pool.query('ALTER TABLE airport_scores_daily ADD COLUMN score_n DECIMAL(6,2) NULL AFTER score_p');
    }
  }
}

function toRun(row: NetworkCoverageRunRow): NetworkCoverageRun {
  return {
    id: Number(row.id),
    airport_id: Number(row.airport_id),
    sampled_at: sqlDateTimeToTimezoneIso(row.sampled_at),
    sampled_date: formatDateOnly(row.sampled_date),
    source: row.source,
    status: row.status,
    subscription_format: row.subscription_format,
    detected_nodes_count: Number(row.detected_nodes_count),
    healthy_nodes_count: Number(row.healthy_nodes_count),
    unhealthy_nodes_count: Number(row.unhealthy_nodes_count),
    unsupported_nodes_count: Number(row.unsupported_nodes_count),
    unknown_healthy_nodes_count: Number(row.unknown_healthy_nodes_count),
    healthy_node_rate: Number(row.healthy_node_rate),
    core_regions: stringArray(row.core_regions_json),
    extended_regions: stringArray(row.extended_regions_json),
    region_counts: numberRecord(row.region_counts_json),
    max_region_code: row.max_region_code,
    max_region_share: Number(row.max_region_share),
    node_count_score: Number(row.node_count_score),
    core_coverage_score: Number(row.core_coverage_score),
    extended_coverage_score: Number(row.extended_coverage_score),
    region_score: Number(row.region_score),
    health_rate_score: Number(row.health_rate_score),
    balance_score: Number(row.balance_score),
    score_n: Number(row.score_n),
    rule_version: row.rule_version,
    nodes: nodeArray(row.nodes_json),
    error_code: row.error_code,
    error_message: row.error_message,
    diagnostics: objectValue(row.diagnostics_json),
    created_at: sqlDateTimeToTimezoneIso(row.created_at),
  };
}

function parseJson(value: unknown): unknown {
  if (typeof value === 'object' && value !== null) return value;
  try { return JSON.parse(String(value)); } catch { return null; }
}

function stringArray(value: unknown): string[] {
  const parsed = parseJson(value);
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

function numberRecord(value: unknown): Record<string, number> {
  const parsed = parseJson(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return Object.fromEntries(Object.entries(parsed).map(([key, count]) => [key, Number(count) || 0]));
}

function nodeArray(value: unknown): NetworkCoverageRunNode[] {
  const parsed = parseJson(value);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item) => item && typeof item === 'object').map((item) => {
    const record = item as Record<string, unknown>;
    const group = record.region_group === 'core' || record.region_group === 'extended' ? record.region_group : 'unknown';
    return {
      key: String(record.key || ''),
      name: String(record.name || ''),
      type: record.type == null ? null : String(record.type),
      healthy: Boolean(record.healthy),
      error_code: record.error_code == null ? null : String(record.error_code),
      region_code: String(record.region_code || 'UNKNOWN'),
      region_name: String(record.region_name || '未知地区'),
      region_group: group,
    };
  });
}

function objectValue(value: unknown): Record<string, unknown> {
  const parsed = parseJson(value);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
}
