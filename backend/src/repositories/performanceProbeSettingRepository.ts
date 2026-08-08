import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { PERFORMANCE_PROBE_DEFINITIONS } from '../config/performanceProbes';
import type {
  AirportPerformanceProbeSetting,
  AirportPerformanceProbeSettingsInput,
  AirportPerformanceProbeSettingsView,
  PerformanceProbeId,
} from '../types/domain';
import { sqlDateTimeToTimezoneIso } from '../utils/time';

interface PerformanceProbeSettingRow extends RowDataPacket {
  airport_id: number;
  probe_id: PerformanceProbeId;
  test_enabled: number;
  include_in_result: number;
  config_version: number;
  updated_by: string;
  updated_at: string;
}

export class PerformanceProbeSettingsConflictError extends Error {
  constructor() {
    super('performance probe settings were updated by another request');
    this.name = 'PerformanceProbeSettingsConflictError';
  }
}

export class PerformanceProbeSettingRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS airport_performance_probe_settings (
        airport_id BIGINT UNSIGNED NOT NULL,
        probe_id VARCHAR(64) NOT NULL,
        test_enabled TINYINT(1) NOT NULL DEFAULT 0,
        include_in_result TINYINT(1) NOT NULL DEFAULT 0,
        config_version INT UNSIGNED NOT NULL DEFAULT 1,
        updated_by VARCHAR(128) NOT NULL DEFAULT 'admin',
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (airport_id, probe_id),
        INDEX idx_performance_probe_settings_probe (probe_id, test_enabled),
        CONSTRAINT fk_performance_probe_settings_airport FOREIGN KEY (airport_id) REFERENCES airports(id),
        CONSTRAINT fk_performance_probe_settings_probe FOREIGN KEY (probe_id) REFERENCES performance_probes(probe_id)
      )`,
    );
  }

  async getByAirport(airportId: number): Promise<AirportPerformanceProbeSettingsView> {
    const [rows] = await this.pool.query<PerformanceProbeSettingRow[]>(
      `SELECT airport_id, probe_id, test_enabled, include_in_result, config_version, updated_by, updated_at
         FROM airport_performance_probe_settings
        WHERE airport_id = ?`,
      [airportId],
    );
    return buildView(airportId, rows);
  }

  async saveAll(input: AirportPerformanceProbeSettingsInput): Promise<AirportPerformanceProbeSettingsView> {
    const normalized = validateAndNormalizeSettings(input.settings);
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const currentVersion = await getCurrentVersionForUpdate(connection, input.airport_id);
      if (currentVersion !== input.expected_config_version) {
        throw new PerformanceProbeSettingsConflictError();
      }
      const nextVersion = currentVersion + 1;
      for (const setting of normalized) {
        await connection.execute<ResultSetHeader>(
          `INSERT INTO airport_performance_probe_settings (
             airport_id, probe_id, test_enabled, include_in_result, config_version, updated_by
           ) VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             test_enabled = VALUES(test_enabled),
             include_in_result = VALUES(include_in_result),
             config_version = VALUES(config_version),
             updated_by = VALUES(updated_by),
             updated_at = CURRENT_TIMESTAMP`,
          [
            input.airport_id,
            setting.probe_id,
            setting.test_enabled ? 1 : 0,
            setting.include_in_result ? 1 : 0,
            nextVersion,
            input.updated_by || 'admin',
          ],
        );
      }
      await connection.commit();
      return {
        airport_id: input.airport_id,
        config_version: nextVersion,
        settings: normalized.map((setting) => ({
          ...setting,
          updated_by: input.updated_by || 'admin',
          updated_at: null,
        })),
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

async function getCurrentVersionForUpdate(connection: PoolConnection, airportId: number): Promise<number> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT COALESCE(MAX(config_version), 0) AS config_version
       FROM airport_performance_probe_settings
      WHERE airport_id = ?
      FOR UPDATE`,
    [airportId],
  );
  return Number(rows[0]?.config_version || 0);
}

function buildView(
  airportId: number,
  rows: PerformanceProbeSettingRow[],
): AirportPerformanceProbeSettingsView {
  const storedByProbe = new Map(rows.map((row) => [row.probe_id, row]));
  const configVersion = rows.reduce((max, row) => Math.max(max, Number(row.config_version || 0)), 0);
  return {
    airport_id: airportId,
    config_version: configVersion,
    settings: PERFORMANCE_PROBE_DEFINITIONS.map((definition) => {
      const row = storedByProbe.get(definition.probe_id);
      if (!row) {
        return defaultSetting(definition.probe_id);
      }
      return {
        probe_id: row.probe_id,
        test_enabled: Boolean(row.test_enabled),
        include_in_result: Boolean(row.include_in_result),
        updated_by: row.updated_by,
        updated_at: sqlDateTimeToTimezoneIso(row.updated_at),
      };
    }),
  };
}

function validateAndNormalizeSettings(
  settings: AirportPerformanceProbeSettingsInput['settings'],
): Array<Pick<AirportPerformanceProbeSetting, 'probe_id' | 'test_enabled' | 'include_in_result'>> {
  const received = new Map<PerformanceProbeId, AirportPerformanceProbeSettingsInput['settings'][number]>();
  for (const setting of settings) {
    if (received.has(setting.probe_id)) {
      throw new Error(`duplicate probe setting: ${setting.probe_id}`);
    }
    received.set(setting.probe_id, setting);
  }
  const expectedIds = PERFORMANCE_PROBE_DEFINITIONS.map((definition) => definition.probe_id);
  if (received.size !== expectedIds.length || expectedIds.some((probeId) => !received.has(probeId))) {
    throw new Error('settings must include every registered performance probe exactly once');
  }

  const normalized = expectedIds.map((probeId) => {
    const setting = received.get(probeId)!;
    const testEnabled = Boolean(setting.test_enabled);
    const includeInResult = Boolean(setting.include_in_result);
    if (includeInResult && !testEnabled) {
      throw new Error(`include_in_result requires test_enabled for ${probeId}`);
    }
    return {
      probe_id: probeId,
      test_enabled: testEnabled,
      include_in_result: includeInResult,
    };
  });
  if (!normalized.some((setting) => setting.test_enabled && setting.include_in_result)) {
    throw new Error('at least one probe must be included in performance results');
  }
  return normalized;
}

function defaultSetting(probeId: PerformanceProbeId): AirportPerformanceProbeSetting {
  const isLegacy = probeId === 'legacy-control';
  return {
    probe_id: probeId,
    test_enabled: isLegacy,
    include_in_result: isLegacy,
    updated_by: null,
    updated_at: null,
  };
}
