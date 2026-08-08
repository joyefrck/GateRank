import test from 'node:test';
import assert from 'node:assert/strict';

import { PerformanceProbeJobRepository } from '../src/repositories/performanceProbeJobRepository';

test('PerformanceProbeJobRepository creates immutable jobs and leases the oldest queued job', async () => {
  const calls: Array<{ method: string; sql: string; params?: unknown[] }> = [];
  const connection = {
    beginTransaction: async () => undefined,
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ method: 'query', sql, params });
      if (sql.includes('FOR UPDATE')) {
        return [[{
          job_id: '11111111-1111-4111-8111-111111111111',
          airport_id: 9,
          probe_id: 'cn-shanghai',
          node_snapshot_id: 12,
          config_version: 3,
          test_enabled_snapshot: 1,
          include_in_result_snapshot: 0,
          selected_node_keys_json: '[]',
          test_profile: 'mainland_multi_target_v1',
          scoring_rule_version: 'cn_dual_probe_v1',
          source: 'manual-performance',
          status: 'queued',
          lease_owner: null,
          lease_expires_at: null,
          attempts: 0,
          idempotency_key: '2026-08-08:9:cn-shanghai:manual-performance:3',
          created_at: '2026-08-08 10:00:00',
          updated_at: '2026-08-08 10:00:00',
          completed_at: null,
        }]];
      }
      return [[]];
    },
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ method: 'execute', sql, params });
      return [{ affectedRows: 1 }];
    },
    commit: async () => undefined,
    rollback: async () => undefined,
    release: () => undefined,
  };
  const repository = new PerformanceProbeJobRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ method: 'query', sql, params });
      return [[]];
    },
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ method: 'execute', sql, params });
      return [{ affectedRows: 1 }];
    },
    getConnection: async () => connection,
  } as never);

  await repository.ensureSchema();
  const created = await repository.create({
    job_id: '11111111-1111-4111-8111-111111111111',
    airport_id: 9,
    probe_id: 'cn-shanghai',
    node_snapshot_id: 12,
    config_version: 3,
    test_enabled_snapshot: true,
    include_in_result_snapshot: false,
    selected_node_keys: [],
    test_profile: 'mainland_multi_target_v1',
    scoring_rule_version: 'cn_dual_probe_v1',
    source: 'manual-performance',
    idempotency_key: '2026-08-08:9:cn-shanghai:manual-performance:3',
  });
  const leased = await repository.leaseNext('cn-shanghai', 'worker-a', 120);

  assert.equal(created, true);
  assert.equal(leased?.probe_id, 'cn-shanghai');
  assert.equal(leased?.include_in_result_snapshot, false);
  assert.equal(leased?.config_version, 3);
  assert.equal(leased?.status, 'leased');
  assert.ok(calls.some((call) => call.sql.includes('CREATE TABLE IF NOT EXISTS performance_probe_jobs')));
  assert.ok(calls.some((call) => call.sql.includes("status = 'leased'")));
});

test('PerformanceProbeJobRepository completes a job idempotently', async () => {
  const repository = new PerformanceProbeJobRepository({
    execute: async (sql: string, params?: unknown[]) => {
      assert.match(sql, /status = 'completed'/);
      assert.deepEqual(params, [44, 'job-1', 'cn-guangzhou']);
      return [{ affectedRows: 1 }];
    },
  } as never);

  assert.equal(await repository.markCompleted('job-1', 'cn-guangzhou', 44), true);
});

test('PerformanceProbeJobRepository commits and rolls back submission transactions', async () => {
  const events: string[] = [];
  const connection = {
    beginTransaction: async () => events.push('begin'),
    commit: async () => events.push('commit'),
    rollback: async () => events.push('rollback'),
    release: () => events.push('release'),
  };
  const repository = new PerformanceProbeJobRepository({
    getConnection: async () => connection,
  } as never);

  assert.equal(await repository.withTransaction(async () => 'ok'), 'ok');
  await assert.rejects(
    repository.withTransaction(async () => {
      throw new Error('write_failed');
    }),
    /write_failed/,
  );
  assert.deepEqual(events, [
    'begin', 'commit', 'release',
    'begin', 'rollback', 'release',
  ]);
});
