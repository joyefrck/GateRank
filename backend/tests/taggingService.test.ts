import test from 'node:test';
import assert from 'node:assert/strict';
import type { Airport, DailyMetrics, ScoreBreakdown } from '../src/types/domain';
import { computeMedian, generateAirportTags } from '../src/services/taggingService';

function buildAirport(partial: Partial<Airport> = {}): Airport {
  return {
    id: 1,
    name: 'A',
    website: 'https://a.example.com',
    status: 'normal',
    plan_price_month: 20,
    has_trial: true,
    tags: [],
    created_at: '2026-03-01',
    ...partial,
  };
}

function buildMetrics(partial: Partial<DailyMetrics> = {}): DailyMetrics {
  return {
    airport_id: 1,
    date: '2026-03-22',
    uptime_percent_30d: 99.9,
    median_latency_ms: 80,
    median_download_mbps: 280,
    packet_loss_percent: 0.1,
    stable_days_streak: 45,
    domain_ok: true,
    ssl_days_left: 90,
    recent_complaints_count: 0,
    history_incidents: 0,
    ...partial,
  };
}

function buildScore(partial: Partial<ScoreBreakdown> = {}): ScoreBreakdown {
  return {
    s: 86,
    p: 88,
    c: 82,
    r: 85,
    risk_penalty: 15,
    score: 85,
    recent_score: 85,
    historical_score: 82,
    final_score: 84.1,
    details: {
      stability_score: 88,
      price_score: 85,
    },
    ...partial,
  };
}

test('generateAirportTags returns 不推荐 when metrics or score missing', () => {
  const airport = buildAirport();
  const tags = generateAirportTags({
    date: '2026-03-22',
    airport,
    metrics: null,
    score: null,
    priceMedian: 20,
  });
  assert.deepEqual(tags, ['不推荐']);
});

test('generateAirportTags returns only 不推荐 for high-risk airport', () => {
  const tags = generateAirportTags({
    date: '2026-03-22',
    airport: buildAirport(),
    metrics: buildMetrics({ history_incidents: 4 }),
    score: buildScore({ r: 55 }),
    priceMedian: 20,
  });
  assert.deepEqual(tags, ['不推荐']);
});

test('generateAirportTags returns expected combined labels', () => {
  const tags = generateAirportTags({
    date: '2026-03-22',
    airport: buildAirport({
      plan_price_month: 40,
      has_trial: false,
      created_at: '2026-03-15',
    }),
    metrics: buildMetrics(),
    score: buildScore({
      final_score: 90,
      recent_score: 90,
      p: 90,
      details: {
        stability_score: 90,
        price_score: 82,
      },
    }),
    priceMedian: 30,
  });
  assert.deepEqual(tags, ['新入榜', '长期稳定', '性价比高', '高性能', '高端路线']);
});

test('generateAirportTags adds 风险观察 when recent complaints exist', () => {
  const tags = generateAirportTags({
    date: '2026-03-22',
    airport: buildAirport(),
    metrics: buildMetrics({ recent_complaints_count: 2 }),
    score: buildScore({ r: 72 }),
    priceMedian: 20,
  });
  assert.ok(tags.includes('风险观察'));
});

test('computeMedian handles odd and even counts', () => {
  assert.equal(computeMedian([3, 1, 2]), 2);
  assert.equal(computeMedian([10, 20, 30, 40]), 25);
  assert.equal(computeMedian([]), 0);
});
