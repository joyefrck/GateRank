import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PerformanceProbeSettingRepository,
  PerformanceProbeSettingsConflictError,
} from '../src/repositories/performanceProbeSettingRepository';

test('PerformanceProbeSettingRepository returns safe migration defaults', async () => {
  const repository = new PerformanceProbeSettingRepository({
    query: async (sql: string) => {
      if (sql.includes('FROM airport_performance_probe_settings')) {
        return [[]];
      }
      return [[]];
    },
  } as never);

  const view = await repository.getByAirport(9);

  assert.equal(view.config_version, 0);
  assert.deepEqual(
    view.settings.map((setting) => [setting.probe_id, setting.test_enabled, setting.include_in_result]),
    [
      ['legacy-control', true, true],
      ['cn-shanghai', false, false],
      ['cn-guangzhou', false, false],
    ],
  );
});

test('PerformanceProbeSettingRepository validates switch invariants before opening a transaction', async () => {
  const repository = new PerformanceProbeSettingRepository({
    getConnection: async () => {
      throw new Error('transaction should not open');
    },
  } as never);

  await assert.rejects(
    repository.saveAll({
      airport_id: 9,
      expected_config_version: 0,
      updated_by: 'ops',
      settings: [
        { probe_id: 'legacy-control', test_enabled: true, include_in_result: true },
        { probe_id: 'cn-shanghai', test_enabled: false, include_in_result: true },
        { probe_id: 'cn-guangzhou', test_enabled: false, include_in_result: false },
      ],
    }),
    /include_in_result requires test_enabled/,
  );

  await assert.rejects(
    repository.saveAll({
      airport_id: 9,
      expected_config_version: 0,
      updated_by: 'ops',
      settings: [
        { probe_id: 'legacy-control', test_enabled: false, include_in_result: false },
        { probe_id: 'cn-shanghai', test_enabled: true, include_in_result: false },
        { probe_id: 'cn-guangzhou', test_enabled: true, include_in_result: false },
      ],
    }),
    /at least one probe must be included/,
  );
});

test('PerformanceProbeSettingRepository saves all rows with one optimistic config version', async () => {
  const statements: Array<{ sql: string; params?: unknown[] }> = [];
  let committed = false;
  let rolledBack = false;
  const connection = {
    beginTransaction: async () => undefined,
    query: async (sql: string, params?: unknown[]) => {
      statements.push({ sql, params });
      return [[{ config_version: 2 }]];
    },
    execute: async (sql: string, params?: unknown[]) => {
      statements.push({ sql, params });
      return [{ affectedRows: 1 }];
    },
    commit: async () => {
      committed = true;
    },
    rollback: async () => {
      rolledBack = true;
    },
    release: () => undefined,
  };
  const repository = new PerformanceProbeSettingRepository({
    getConnection: async () => connection,
  } as never);

  const saved = await repository.saveAll({
    airport_id: 9,
    expected_config_version: 2,
    updated_by: 'ops',
    settings: [
      { probe_id: 'legacy-control', test_enabled: true, include_in_result: true },
      { probe_id: 'cn-shanghai', test_enabled: true, include_in_result: false },
      { probe_id: 'cn-guangzhou', test_enabled: true, include_in_result: false },
    ],
  });

  assert.equal(saved.config_version, 3);
  assert.equal(statements.filter((item) => item.sql.includes('INSERT INTO airport_performance_probe_settings')).length, 3);
  assert.equal(committed, true);
  assert.equal(rolledBack, false);
});

test('PerformanceProbeSettingRepository rejects a stale optimistic config version', async () => {
  let rolledBack = false;
  const connection = {
    beginTransaction: async () => undefined,
    query: async () => [[{ config_version: 4 }]],
    execute: async () => [{ affectedRows: 0 }],
    commit: async () => undefined,
    rollback: async () => {
      rolledBack = true;
    },
    release: () => undefined,
  };
  const repository = new PerformanceProbeSettingRepository({
    getConnection: async () => connection,
  } as never);

  await assert.rejects(
    repository.saveAll({
      airport_id: 9,
      expected_config_version: 3,
      updated_by: 'ops',
      settings: [
        { probe_id: 'legacy-control', test_enabled: true, include_in_result: true },
        { probe_id: 'cn-shanghai', test_enabled: false, include_in_result: false },
        { probe_id: 'cn-guangzhou', test_enabled: false, include_in_result: false },
      ],
    }),
    PerformanceProbeSettingsConflictError,
  );
  assert.equal(rolledBack, true);
});
