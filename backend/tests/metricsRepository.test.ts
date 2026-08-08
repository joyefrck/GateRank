import test from 'node:test';
import assert from 'node:assert/strict';
import { MetricsRepository } from '../src/repositories/metricsRepository';

test('MetricsRepository normalizes DATE columns to YYYY-MM-DD', async () => {
  const repository = new MetricsRepository({
    query: async () => [[
      {
        airport_id: 1,
        date: new Date('2026-03-22T00:00:00.000Z'),
        uptime_percent_30d: 99.9,
        uptime_percent_today: 100,
        latency_samples_ms: [10, 12],
        latency_mean_ms: 11,
        latency_std_ms: 1,
        latency_cv: 0.1,
        download_samples_mbps: [88.8],
        median_latency_ms: 11,
        median_download_mbps: 88.8,
        packet_loss_percent: 0,
        performance_latency_score: 90,
        performance_speed_score: 80,
        performance_loss_score: 100,
        performance_score: 88,
        performance_rule_summary: 'cn_dual_probe_v1',
        performance_included_probe_ids_json: '["cn-guangzhou","cn-shanghai"]',
        performance_review_status: 'normal',
        performance_pending_probe_ids_json: '[]',
        stable_days_streak: 3,
        healthy_days_streak: 5,
        is_stable_day: 1,
        stability_tier: 'minor_fluctuation',
        domain_ok: 1,
        ssl_days_left: 30,
        recent_complaints_count: 0,
        history_incidents: 0,
      },
    ]],
  } as never);

  const metrics = await repository.getByAirportAndDate(1, '2026-03-22');
  assert.ok(metrics);
  assert.equal(metrics.date, '2026-03-22');
  assert.equal(metrics?.healthy_days_streak, 5);
  assert.equal(metrics?.stability_tier, 'minor_fluctuation');
  assert.equal(metrics?.performance_score, 88);
  assert.deepEqual(metrics?.performance_included_probe_ids, ['cn-guangzhou', 'cn-shanghai']);
  assert.deepEqual(metrics?.performance_pending_probe_ids, []);
});

test('MetricsRepository writes one parameter for every daily metrics placeholder', async () => {
  let placeholderCount = 0;
  let parameterCount = 0;
  const repository = new MetricsRepository({
    execute: async (sql: string, params: unknown[]) => {
      placeholderCount = (sql.match(/\?/g) || []).length;
      parameterCount = params.length;
      return [{ affectedRows: 1 }];
    },
  } as never);

  await repository.upsertDaily({
    airport_id: 1,
    date: '2026-08-08',
    uptime_percent_30d: 100,
    median_latency_ms: 80,
    median_download_mbps: 130,
    packet_loss_percent: 0,
    performance_latency_score: 90,
    performance_speed_score: 80,
    performance_loss_score: 100,
    performance_score: 88,
    performance_included_probe_ids: ['cn-guangzhou', 'cn-shanghai'],
    performance_pending_probe_ids: [],
    stable_days_streak: 1,
    domain_ok: true,
    ssl_days_left: 30,
    recent_complaints_count: 0,
    history_incidents: 0,
  });

  assert.equal(parameterCount, placeholderCount);
});
