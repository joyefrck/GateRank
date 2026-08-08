import test from 'node:test';
import assert from 'node:assert/strict';

import { PerformanceRunTargetRepository } from '../src/repositories/performanceRunTargetRepository';

test('PerformanceRunTargetRepository stores and reads target-level evidence', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const repository = new PerformanceRunTargetRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('FROM performance_run_targets')) {
        return [[{
          run_id: 44,
          node_key: 'node-a',
          target_key: 'target-a',
          bytes_downloaded: 5000000,
          duration_ms: 438.6,
          download_mbps: 91.2,
          http_status: 200,
          error_code: null,
          valid: 1,
          created_at: '2026-08-08 12:00:00',
        }]];
      }
      return [[]];
    },
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return [{ affectedRows: 1 }];
    },
  } as never);

  await repository.ensureSchema();
  await repository.insertMany([{
    run_id: 44,
    node_key: 'node-a',
    target_key: 'target-a',
    bytes_downloaded: 5000000,
    duration_ms: 438.6,
    download_mbps: 91.2,
    http_status: 200,
    error_code: null,
    valid: true,
  }]);
  const rows = await repository.listByRun(44);

  assert.equal(rows[0]?.download_mbps, 91.2);
  assert.equal(rows[0]?.valid, true);
  assert.ok(calls.some((call) => call.sql.includes('CREATE TABLE IF NOT EXISTS performance_run_targets')));
});

test('PerformanceRunTargetRepository rejects invalid numeric evidence', async () => {
  const repository = new PerformanceRunTargetRepository({
    execute: async () => [{ affectedRows: 1 }],
  } as never);

  await assert.rejects(repository.insertMany([{
    run_id: 44,
    node_key: 'node-a',
    target_key: 'target-a',
    bytes_downloaded: 1,
    duration_ms: 1,
    download_mbps: Number.NaN,
    http_status: null,
    error_code: null,
    valid: false,
  }]), /download_mbps/);
});
