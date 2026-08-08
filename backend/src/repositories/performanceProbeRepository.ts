import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { PERFORMANCE_PROBE_DEFINITIONS } from '../config/performanceProbes';
import type { PerformanceProbe, PerformanceProbeId } from '../types/domain';
import { sqlDateTimeToTimezoneIso } from '../utils/time';

interface PerformanceProbeRow extends RowDataPacket {
  probe_id: PerformanceProbeId;
  display_name: string;
  region_code: string;
  provider: string;
  bandwidth_mbps: number | null;
  probe_type: 'legacy' | 'mainland';
  test_profile: string;
  scoring_rule_version: 'legacy_v1' | 'cn_dual_probe_v1';
  globally_enabled: number;
  token_hash: string | null;
  token_last_rotated_at: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

const SELECT_COLUMNS = `probe_id, display_name, region_code, provider, bandwidth_mbps,
  probe_type, test_profile, scoring_rule_version, globally_enabled, token_hash,
  token_last_rotated_at, last_seen_at, created_at, updated_at`;

export class PerformanceProbeRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS performance_probes (
        probe_id VARCHAR(64) NOT NULL,
        display_name VARCHAR(128) NOT NULL,
        region_code VARCHAR(64) NOT NULL,
        provider VARCHAR(128) NOT NULL,
        bandwidth_mbps INT UNSIGNED NULL,
        probe_type ENUM('legacy', 'mainland') NOT NULL,
        test_profile VARCHAR(64) NOT NULL,
        scoring_rule_version VARCHAR(64) NOT NULL,
        globally_enabled TINYINT(1) NOT NULL DEFAULT 0,
        token_hash CHAR(64) NULL,
        token_last_rotated_at DATETIME NULL,
        last_seen_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (probe_id),
        UNIQUE KEY uq_performance_probes_token_hash (token_hash)
      )`,
    );

    for (const definition of PERFORMANCE_PROBE_DEFINITIONS) {
      await this.pool.execute<ResultSetHeader>(
        `INSERT INTO performance_probes (
           probe_id, display_name, region_code, provider, bandwidth_mbps,
           probe_type, test_profile, scoring_rule_version, globally_enabled
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           display_name = VALUES(display_name),
           region_code = VALUES(region_code),
           provider = VALUES(provider),
           bandwidth_mbps = VALUES(bandwidth_mbps),
           probe_type = VALUES(probe_type),
           test_profile = VALUES(test_profile),
           scoring_rule_version = VALUES(scoring_rule_version)`,
        [
          definition.probe_id,
          definition.display_name,
          definition.region_code,
          definition.provider,
          definition.bandwidth_mbps,
          definition.probe_type,
          definition.test_profile,
          definition.scoring_rule_version,
          definition.probe_id === 'legacy-control' ? 1 : 0,
        ],
      );
    }
  }

  async list(): Promise<PerformanceProbe[]> {
    const [rows] = await this.pool.query<PerformanceProbeRow[]>(
      `SELECT ${SELECT_COLUMNS}
         FROM performance_probes
        ORDER BY FIELD(probe_id, 'legacy-control', 'cn-shanghai', 'cn-guangzhou'), probe_id`,
    );
    return rows.map(toPerformanceProbe);
  }

  async getById(probeId: PerformanceProbeId): Promise<PerformanceProbe | null> {
    const [rows] = await this.pool.query<PerformanceProbeRow[]>(
      `SELECT ${SELECT_COLUMNS}
         FROM performance_probes
        WHERE probe_id = ?
        LIMIT 1`,
      [probeId],
    );
    return rows[0] ? toPerformanceProbe(rows[0]) : null;
  }

  async findEnabledByTokenHash(tokenHash: string): Promise<PerformanceProbe | null> {
    const [rows] = await this.pool.query<PerformanceProbeRow[]>(
      `SELECT ${SELECT_COLUMNS}
         FROM performance_probes
        WHERE token_hash = ?
          AND globally_enabled = 1
        LIMIT 1`,
      [tokenHash],
    );
    return rows[0] ? toPerformanceProbe(rows[0]) : null;
  }

  async setTokenHash(probeId: PerformanceProbeId, tokenHash: string): Promise<void> {
    if (!/^[a-f0-9]{64}$/i.test(tokenHash)) {
      throw new Error('tokenHash must be a 64-character SHA-256 hex digest');
    }
    await this.pool.execute<ResultSetHeader>(
      `UPDATE performance_probes
          SET token_hash = ?, token_last_rotated_at = CURRENT_TIMESTAMP
        WHERE probe_id = ?`,
      [tokenHash.toLowerCase(), probeId],
    );
  }

  async revokeToken(probeId: PerformanceProbeId): Promise<void> {
    await this.pool.execute<ResultSetHeader>(
      `UPDATE performance_probes
          SET token_hash = NULL, token_last_rotated_at = CURRENT_TIMESTAMP
        WHERE probe_id = ?`,
      [probeId],
    );
  }

  async setGloballyEnabled(probeId: PerformanceProbeId, enabled: boolean): Promise<void> {
    await this.pool.execute<ResultSetHeader>(
      'UPDATE performance_probes SET globally_enabled = ? WHERE probe_id = ?',
      [enabled ? 1 : 0, probeId],
    );
  }

  async touchLastSeen(probeId: PerformanceProbeId): Promise<void> {
    await this.pool.execute<ResultSetHeader>(
      'UPDATE performance_probes SET last_seen_at = CURRENT_TIMESTAMP WHERE probe_id = ?',
      [probeId],
    );
  }
}

function toPerformanceProbe(row: PerformanceProbeRow): PerformanceProbe {
  return {
    probe_id: row.probe_id,
    display_name: row.display_name,
    region_code: row.region_code,
    provider: row.provider,
    bandwidth_mbps: nullableNumber(row.bandwidth_mbps),
    probe_type: row.probe_type,
    test_profile: row.test_profile,
    scoring_rule_version: row.scoring_rule_version,
    globally_enabled: Boolean(row.globally_enabled),
    token_configured: Boolean(row.token_hash),
    token_last_rotated_at: nullableDateTime(row.token_last_rotated_at),
    last_seen_at: nullableDateTime(row.last_seen_at),
    created_at: sqlDateTimeToTimezoneIso(row.created_at),
    updated_at: sqlDateTimeToTimezoneIso(row.updated_at),
  };
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullableDateTime(value: unknown): string | null {
  return value == null ? null : sqlDateTimeToTimezoneIso(String(value));
}
