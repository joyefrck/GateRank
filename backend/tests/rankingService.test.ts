import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRankings } from '../src/services/rankingService';

test('buildRankings excludes normal airports from risk ranking', () => {
  const rankings = buildRankings('2026-03-24', [
    {
      airport: {
        id: 1,
        name: 'Normal Airport',
        website: 'https://normal.example.com',
        status: 'normal',
        plan_price_month: 10,
        has_trial: true,
        tags: [],
        created_at: '2025-01-01',
      },
      metrics: {
        airport_id: 1,
        date: '2026-03-24',
        uptime_percent_30d: 90,
        median_latency_ms: 60,
        median_download_mbps: 100,
        packet_loss_percent: 0,
        stable_days_streak: 10,
        domain_ok: false,
        ssl_days_left: 3,
        recent_complaints_count: 8,
        history_incidents: 2,
      },
      score: {
        s: 70,
        p: 70,
        c: 70,
        r: 40,
        risk_penalty: 60,
        score: 60,
        recent_score: 60,
        historical_score: 60,
        final_score: 60,
        details: {},
      },
    },
    {
      airport: {
        id: 2,
        name: 'Risk Airport',
        website: 'https://risk.example.com',
        status: 'risk',
        plan_price_month: 10,
        has_trial: true,
        tags: [],
        created_at: '2025-01-01',
      },
      metrics: {
        airport_id: 2,
        date: '2026-03-24',
        uptime_percent_30d: 80,
        median_latency_ms: 80,
        median_download_mbps: 50,
        packet_loss_percent: 5,
        stable_days_streak: 1,
        domain_ok: false,
        ssl_days_left: 1,
        recent_complaints_count: 10,
        history_incidents: 3,
      },
      score: {
        s: 50,
        p: 40,
        c: 45,
        r: 20,
        risk_penalty: 80,
        score: 35,
        recent_score: 35,
        historical_score: 35,
        final_score: 35,
        details: {},
      },
    },
  ]);

  assert.deepEqual(rankings.risk.map((item) => item.airport_id), [2]);
});
