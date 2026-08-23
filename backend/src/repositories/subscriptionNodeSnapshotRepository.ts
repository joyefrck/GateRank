import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type {
  SubscriptionNodeSnapshot,
  SubscriptionNodeSnapshotInput,
  SubscriptionNodeSnapshotNode,
  SubscriptionNodeSnapshotUnsupportedNode,
} from '../types/domain';
import { isInformationalNodeName } from '../utils/informationalNode';
import { findNodeRegionDefinition } from '../utils/nodeRegion';
import { sqlDateTimeToTimezoneIso } from '../utils/time';

interface SubscriptionNodeSnapshotRow extends RowDataPacket {
  id: number;
  airport_id: number;
  captured_at: string;
  source: string;
  subscription_url: string | null;
  subscription_format: string | null;
  parsed_nodes_count: number;
  supported_nodes_count: number;
  region_counts_json: unknown;
  nodes_json: unknown;
  unsupported_nodes_json: unknown;
  created_at: string;
}

export class SubscriptionNodeSnapshotRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS airport_subscription_node_snapshots (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        airport_id BIGINT UNSIGNED NOT NULL,
        captured_at DATETIME NOT NULL,
        source VARCHAR(128) NOT NULL DEFAULT 'cron-performance',
        subscription_url VARCHAR(1024) NULL,
        subscription_format VARCHAR(64) NULL,
        parsed_nodes_count INT UNSIGNED NOT NULL DEFAULT 0,
        supported_nodes_count INT UNSIGNED NOT NULL DEFAULT 0,
        region_counts_json JSON NULL,
        nodes_json JSON NOT NULL,
        unsupported_nodes_json JSON NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_subscription_node_snapshots_airport_time (airport_id, captured_at DESC),
        CONSTRAINT fk_subscription_node_snapshots_airport FOREIGN KEY (airport_id) REFERENCES airports(id)
      )`,
    );
    await this.ensureRegionCountsColumn();
    await this.backfillLatestRegionCounts();
  }

  async insert(input: SubscriptionNodeSnapshotInput): Promise<number> {
    const nodes = normalizeNodes(input.nodes);
    const unsupportedNodes = normalizeUnsupportedNodes(input.unsupported_nodes || []);
    const regionCounts = buildSubscriptionNodeRegionCounts(nodes);
    const [result] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO airport_subscription_node_snapshots (
         airport_id, captured_at, source, subscription_url, subscription_format,
         parsed_nodes_count, supported_nodes_count, region_counts_json, nodes_json, unsupported_nodes_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.airport_id,
        input.captured_at,
        input.source || 'cron-performance',
        input.subscription_url ?? null,
        input.subscription_format ?? null,
        Math.max(0, Number(input.parsed_nodes_count ?? nodes.length)),
        Math.max(0, Number(input.supported_nodes_count ?? nodes.length)),
        JSON.stringify(regionCounts),
        JSON.stringify(nodes),
        JSON.stringify(unsupportedNodes),
      ],
    );
    return result.insertId;
  }

  async getLatestByAirport(airportId: number): Promise<SubscriptionNodeSnapshot | null> {
    const [rows] = await this.pool.query<SubscriptionNodeSnapshotRow[]>(
      `SELECT id, airport_id, captured_at, source, subscription_url, subscription_format,
              parsed_nodes_count, supported_nodes_count, region_counts_json, nodes_json, unsupported_nodes_json, created_at
         FROM airport_subscription_node_snapshots
        WHERE airport_id = ?
        ORDER BY captured_at DESC, id DESC
        LIMIT 1`,
      [airportId],
    );

    return rows[0] ? toSubscriptionNodeSnapshot(rows[0]) : null;
  }

  async getById(snapshotId: number): Promise<SubscriptionNodeSnapshot | null> {
    const [rows] = await this.pool.query<SubscriptionNodeSnapshotRow[]>(
      `SELECT id, airport_id, captured_at, source, subscription_url, subscription_format,
              parsed_nodes_count, supported_nodes_count, region_counts_json, nodes_json, unsupported_nodes_json, created_at
         FROM airport_subscription_node_snapshots
        WHERE id = ?
        LIMIT 1`,
      [snapshotId],
    );
    return rows[0] ? toSubscriptionNodeSnapshot(rows[0]) : null;
  }

  private async ensureRegionCountsColumn(): Promise<void> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT 1
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'airport_subscription_node_snapshots'
          AND COLUMN_NAME = 'region_counts_json'
        LIMIT 1`,
    );
    if (rows.length === 0) {
      await this.pool.query(
        'ALTER TABLE airport_subscription_node_snapshots ADD COLUMN region_counts_json JSON NULL AFTER supported_nodes_count',
      );
    }
  }

  private async backfillLatestRegionCounts(): Promise<void> {
    const [rows] = await this.pool.query<Array<RowDataPacket & { id: number; nodes_json: unknown }>>(
      `SELECT latest.id, latest.nodes_json
         FROM airport_subscription_node_snapshots latest
        WHERE latest.region_counts_json IS NULL
          AND latest.id = (
            SELECT candidate.id
              FROM airport_subscription_node_snapshots candidate
             WHERE candidate.airport_id = latest.airport_id
             ORDER BY candidate.captured_at DESC, candidate.id DESC
             LIMIT 1
          )`,
    );
    for (const row of rows) {
      const nodes = normalizeNodes(safeJson(row.nodes_json));
      await this.pool.execute(
        `UPDATE airport_subscription_node_snapshots
            SET region_counts_json = ?
          WHERE id = ? AND region_counts_json IS NULL`,
        [JSON.stringify(buildSubscriptionNodeRegionCounts(nodes)), Number(row.id)],
      );
    }
  }
}

function toSubscriptionNodeSnapshot(row: SubscriptionNodeSnapshotRow): SubscriptionNodeSnapshot {
  return {
    id: row.id,
    airport_id: row.airport_id,
    captured_at: sqlDateTimeToTimezoneIso(row.captured_at),
    source: row.source,
    subscription_url: row.subscription_url,
    subscription_format: row.subscription_format,
    parsed_nodes_count: Number(row.parsed_nodes_count),
    supported_nodes_count: Number(row.supported_nodes_count),
    region_counts: safeRegionCounts(row.region_counts_json),
    nodes: normalizeNodes(safeJson(row.nodes_json)),
    unsupported_nodes: normalizeUnsupportedNodes(safeJson(row.unsupported_nodes_json)),
    created_at: sqlDateTimeToTimezoneIso(row.created_at),
  };
}

export function buildSubscriptionNodeRegionCounts(
  nodes: readonly SubscriptionNodeSnapshotNode[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const node of nodes) {
    if (isInformationalNodeName(node.name)) {
      continue;
    }
    const definition = findNodeRegionDefinition(`${node.region || ''} ${node.name}`);
    if (definition) {
      counts[definition.code] = (counts[definition.code] || 0) + 1;
    }
  }
  return counts;
}

function normalizeNodes(value: unknown): SubscriptionNodeSnapshotNode[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const record = item as Record<string, unknown>;
      const outbound = record.outbound && typeof record.outbound === 'object' && !Array.isArray(record.outbound)
        ? (record.outbound as Record<string, unknown>)
        : {};
      return {
        name: String(record.name || ''),
        region: record.region == null ? null : String(record.region),
        type: String(record.type || ''),
        outbound,
        raw_uri: String(record.raw_uri || ''),
      };
    })
    .filter((item) => item.name && item.type && item.raw_uri && Object.keys(item.outbound).length > 0);
}

function normalizeUnsupportedNodes(value: unknown): SubscriptionNodeSnapshotUnsupportedNode[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const record = item as Record<string, unknown>;
      return {
        uri: String(record.uri || ''),
        reason: String(record.reason || ''),
      };
    })
    .filter((item) => item.uri || item.reason);
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

function safeRegionCounts(value: unknown): Record<string, number> {
  const source = safeJson(value);
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(source)
      .map(([key, count]) => [key, Math.max(0, Number(count) || 0)] as const)
      .filter(([, count]) => count > 0),
  );
}
