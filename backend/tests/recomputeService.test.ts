import test from 'node:test';
import assert from 'node:assert/strict';
import type { Airport, DailyMetrics, ScoreBreakdown } from '../src/types/domain';
import { RecomputeService } from '../src/services/recomputeService';

test('recomputeForDate computes scores and replaces rankings idempotently', async () => {
  const airports: Airport[] = [
    {
      id: 1,
      name: 'A',
      website: 'https://a.example.com',
      status: 'normal',
      plan_price_month: 20,
      has_trial: true,
      tags: [],
      created_at: '2026-03-10',
    },
    {
      id: 2,
      name: 'B',
      website: 'https://b.example.com',
      status: 'risk',
      plan_price_month: 50,
      has_trial: false,
      tags: [],
      created_at: '2026-03-21',
    },
  ];

  const metrics: DailyMetrics[] = [
    {
      airport_id: 1,
      date: '2026-03-22',
      uptime_percent_30d: 99.9,
      median_latency_ms: 70,
      median_download_mbps: 300,
      packet_loss_percent: 0.1,
      stable_days_streak: 50,
      domain_ok: true,
      ssl_days_left: 90,
      recent_complaints_count: 0,
      history_incidents: 0,
    },
    {
      airport_id: 2,
      date: '2026-03-22',
      uptime_percent_30d: 96,
      median_latency_ms: 220,
      median_download_mbps: 80,
      packet_loss_percent: 1.5,
      stable_days_streak: 6,
      domain_ok: true,
      ssl_days_left: 12,
      recent_complaints_count: 3,
      history_incidents: 1,
    },
  ];

  const storedScores = new Map<string, ScoreBreakdown>();
  const replaced = new Map<string, number>();

  const svc = new RecomputeService({
    airportRepository: { listAll: async () => airports },
    metricsRepository: { getByDate: async () => metrics },
    scoreRepository: {
      getLatestHistoricalScore: async (airportId: number) => (airportId === 1 ? 90 : 70),
      upsertDaily: async (airportId: number, date: string, score: ScoreBreakdown) => {
        storedScores.set(`${airportId}:${date}`, score);
      },
    },
    rankingRepository: {
      replaceForDate: async (_date, listType, rows) => {
        replaced.set(listType, rows.length);
      },
    },
  });

  const out1 = await svc.recomputeForDate('2026-03-22');
  const out2 = await svc.recomputeForDate('2026-03-22');

  assert.equal(out1.recomputed, 2);
  assert.equal(out2.recomputed, 2);
  assert.equal(storedScores.size, 2);
  assert.equal(replaced.size, 5);
  assert.ok((replaced.get('today') || 0) >= 1);
});
