import test from 'node:test';
import assert from 'node:assert/strict';

import { PerformanceProbeRepository } from '../src/repositories/performanceProbeRepository';

test('PerformanceProbeRepository seeds metadata without storing plaintext tokens', async () => {
  const calls: Array<{ method: string; sql: string; params?: unknown[] }> = [];
  const repository = new PerformanceProbeRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ method: 'query', sql, params });
      if (sql.includes('FROM performance_probes') && sql.includes('ORDER BY')) {
        return [[{
          probe_id: 'cn-shanghai',
          display_name: '上海',
          region_code: 'cn-shanghai',
          provider: 'tencent-cloud',
          bandwidth_mbps: 200,
          probe_type: 'mainland',
          test_profile: 'mainland_multi_target_v1',
          scoring_rule_version: 'cn_dual_probe_v1',
          globally_enabled: 1,
          token_hash: 'hash-only',
          token_last_rotated_at: '2026-08-08 10:00:00',
          last_seen_at: null,
          created_at: '2026-08-08 09:00:00',
          updated_at: '2026-08-08 10:00:00',
        }]];
      }
      return [[]];
    },
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ method: 'execute', sql, params });
      return [{ affectedRows: 1 }];
    },
  } as never);

  await repository.ensureSchema();
  const probes = await repository.list();
  await repository.setTokenHash('cn-shanghai', 'a'.repeat(64));
  await repository.revokeToken('cn-shanghai');
  await repository.setGloballyEnabled('cn-shanghai', true);
  await repository.touchLastSeen('cn-shanghai');

  assert.ok(calls[0]?.sql.includes('CREATE TABLE IF NOT EXISTS performance_probes'));
  assert.equal(calls.filter((call) => call.sql.includes('INSERT INTO performance_probes')).length, 3);
  assert.equal(probes[0]?.probe_id, 'cn-shanghai');
  assert.equal(probes[0]?.token_configured, true);
  assert.equal('token_hash' in (probes[0] || {}), false);
  assert.ok(calls.some((call) => call.sql.includes('token_hash = NULL')));
  assert.equal(calls.some((call) => (JSON.stringify(call.params) || '').includes('plaintext-token')), false);
});

test('PerformanceProbeRepository resolves only globally enabled token hashes', async () => {
  const repository = new PerformanceProbeRepository({
    query: async (sql: string, params?: unknown[]) => {
      assert.match(sql, /globally_enabled = 1/);
      assert.deepEqual(params, ['b'.repeat(64)]);
      return [[{
        probe_id: 'cn-guangzhou',
        display_name: '广州',
        region_code: 'cn-guangzhou',
        provider: 'tencent-cloud',
        bandwidth_mbps: 200,
        probe_type: 'mainland',
        test_profile: 'mainland_multi_target_v1',
        scoring_rule_version: 'cn_dual_probe_v1',
        globally_enabled: 1,
        token_hash: 'b'.repeat(64),
        token_last_rotated_at: null,
        last_seen_at: null,
        created_at: '2026-08-08 09:00:00',
        updated_at: '2026-08-08 09:00:00',
      }]];
    },
    execute: async () => [{ affectedRows: 0 }],
  } as never);

  const probe = await repository.findEnabledByTokenHash('b'.repeat(64));
  assert.equal(probe?.probe_id, 'cn-guangzhou');
});
