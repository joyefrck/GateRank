import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type {
  PerformanceNodePreference,
  PerformanceNodePreferenceInput,
  PerformanceNodePreferenceNode,
} from '../types/domain';
import { sqlDateTimeToTimezoneIso } from '../utils/time';

interface PerformanceNodePreferenceRow extends RowDataPacket {
  airport_id: number;
  selected_nodes_json: unknown;
  updated_by: string;
  updated_at: string;
}

export class PerformanceNodePreferenceRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS airport_performance_node_preferences (
        airport_id BIGINT UNSIGNED NOT NULL,
        selected_nodes_json JSON NOT NULL,
        updated_by VARCHAR(128) NOT NULL DEFAULT 'admin',
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (airport_id),
        CONSTRAINT fk_performance_node_preferences_airport FOREIGN KEY (airport_id) REFERENCES airports(id)
      )`,
    );
  }

  async getByAirport(airportId: number): Promise<PerformanceNodePreference | null> {
    const [rows] = await this.pool.query<PerformanceNodePreferenceRow[]>(
      `SELECT airport_id, selected_nodes_json, updated_by, updated_at
         FROM airport_performance_node_preferences
        WHERE airport_id = ?
        LIMIT 1`,
      [airportId],
    );

    return rows[0] ? toPerformanceNodePreference(rows[0]) : null;
  }

  async save(input: PerformanceNodePreferenceInput): Promise<void> {
    const selectedNodes = normalizeSelectedNodes(input.selected_nodes);
    await this.pool.execute<ResultSetHeader>(
      `INSERT INTO airport_performance_node_preferences (
         airport_id, selected_nodes_json, updated_by
       ) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         selected_nodes_json = VALUES(selected_nodes_json),
         updated_by = VALUES(updated_by),
         updated_at = CURRENT_TIMESTAMP`,
      [
        input.airport_id,
        JSON.stringify(selectedNodes),
        input.updated_by || 'admin',
      ],
    );
  }

  async clear(airportId: number): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      'DELETE FROM airport_performance_node_preferences WHERE airport_id = ?',
      [airportId],
    );
    return result.affectedRows > 0;
  }
}

function toPerformanceNodePreference(row: PerformanceNodePreferenceRow): PerformanceNodePreference {
  return {
    airport_id: Number(row.airport_id),
    selected_nodes: normalizeSelectedNodes(safeJson(row.selected_nodes_json)),
    updated_by: row.updated_by,
    updated_at: sqlDateTimeToTimezoneIso(row.updated_at),
  };
}

function normalizeSelectedNodes(value: unknown): PerformanceNodePreferenceNode[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const nodes: PerformanceNodePreferenceNode[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const record = item as Record<string, unknown>;
    const key = String(record.key || '').trim();
    const name = String(record.name || '').trim();
    if (!key || !name || seen.has(key)) {
      continue;
    }
    seen.add(key);
    nodes.push({
      key,
      name,
      region: record.region == null ? null : String(record.region),
      type: record.type == null ? null : String(record.type),
    });
  }
  return nodes;
}

function safeJson(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
