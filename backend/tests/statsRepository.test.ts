import test from 'node:test';
import assert from 'node:assert/strict';
import { StatsRepository } from '../src/repositories/statsRepository';

test('StatsRepository.getHomeStats uses latest sampled_at across all test tables', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const repository = new StatsRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });

      if (sql.includes('FROM airports')) {
        return [[{ total: 6 }]];
      }
      if (sql.includes('FROM airport_probe_samples') && sql.includes('COUNT(*) AS total')) {
        return [[{ total: 399 }]];
      }
      return [[{ latest_at: '2026-03-25T00:24:58.000Z' }]];
    },
  } as never);

  const result = await repository.getHomeStats('2026-03-25');

  assert.equal(result.monitored_airports, 6);
  assert.equal(result.realtime_tests, 399);
  assert.equal(result.latest_data_at, '2026-03-25T00:24:58.000Z');

  const latestCall = calls.find((call) => call.sql.includes('SELECT MAX(ts) AS latest_at'));
  assert.ok(latestCall);
  assert.ok(latestCall.sql.includes('FROM airport_probe_samples'));
  assert.ok(latestCall.sql.includes('FROM airport_packet_loss_samples'));
  assert.ok(latestCall.sql.includes('FROM airport_performance_runs'));
  assert.ok(!latestCall.sql.includes('FROM airport_rankings_daily'));
  assert.ok(!latestCall.sql.includes('FROM airport_scores_daily'));
  assert.ok(!latestCall.sql.includes('FROM airport_metrics_daily'));
  assert.deepEqual(latestCall.params, ['2026-03-25', '2026-03-25', '2026-03-25']);
});
