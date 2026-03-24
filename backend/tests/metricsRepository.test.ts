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
        stable_days_streak: 3,
        is_stable_day: 1,
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
});
