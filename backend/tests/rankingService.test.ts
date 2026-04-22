import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRankings } from '../src/services/rankingService';

function createRow(
  id: number,
  options: {
    status?: 'normal' | 'risk' | 'down';
    is_listed?: boolean;
    riskPenalty?: number;
    displayScore?: number;
    healthyDaysStreak?: number;
    s?: number;
    tags?: string[];
    stabilityTier?: 'stable' | 'minor_fluctuation' | 'volatile';
  } = {},
) {
  const {
    status = 'normal',
    is_listed = true,
    riskPenalty = 0,
    displayScore = 100 - id,
    healthyDaysStreak = 30 - id,
    s = 90 - id,
    tags = [],
    stabilityTier = 'stable',
  } = options;

  return {
    airport: {
      id,
      name: `Airport ${id}`,
      website: `https://airport-${id}.example.com`,
      status,
      is_listed,
      plan_price_month: 10,
      has_trial: true,
      tags,
      created_at: '2025-01-01',
    },
    metrics: {
      airport_id: id,
      date: '2026-03-24',
      uptime_percent_30d: 99,
      median_latency_ms: 60,
      median_download_mbps: 100,
      packet_loss_percent: 0,
      stable_days_streak: healthyDaysStreak,
      healthy_days_streak: healthyDaysStreak,
      stability_tier: stabilityTier,
      domain_ok: true,
      ssl_days_left: 90,
      recent_complaints_count: 0,
      history_incidents: 0,
    },
    score: {
      s,
      p: 80,
      c: 80,
      r: 95,
      risk_penalty: riskPenalty,
      score: displayScore,
      recent_score: displayScore,
      historical_score: displayScore,
      final_score: displayScore,
      details: {
        total_score: displayScore,
      },
    },
  };
}

function getDateOrdinal(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

test('buildRankings excludes penalized airports from today ranking and down airports from all active lists', () => {
  const rankings = buildRankings('2026-03-24', [
    createRow(1, { riskPenalty: 10, displayScore: 120 }),
    createRow(2, { status: 'risk', riskPenalty: 0, displayScore: 110 }),
    createRow(3, { status: 'down', riskPenalty: 0, displayScore: 130 }),
  ]);

  assert.deepEqual(rankings.risk.map((item) => item.airport_id), [2]);
  assert.ok(rankings.today.every((item) => item.airport_id !== 3));
  assert.ok(rankings.today.every((item) => item.airport_id !== 1));
  assert.ok(rankings.stable.every((item) => item.airport_id !== 3));
});

test('buildRankings excludes risk-watch and volatile airports from today ranking', () => {
  const rankings = buildRankings('2026-03-24', [
    createRow(1, { displayScore: 120, tags: ['风险观察'] }),
    createRow(2, { displayScore: 119, stabilityTier: 'volatile' }),
    createRow(3, { displayScore: 118 }),
    createRow(4, { displayScore: 117, stabilityTier: 'minor_fluctuation' }),
  ]);

  assert.deepEqual(rankings.today.map((item) => item.airport_id).sort((left, right) => left - right), [3, 4]);
});

test('buildRankings rotates today picks within the top-quality candidate pool', () => {
  const rows = Array.from({ length: 10 }, (_, index) => createRow(index + 1));

  const firstDay = buildRankings('2026-03-24', rows).today.map((item) => item.airport_id);
  const secondDay = buildRankings('2026-03-25', rows).today.map((item) => item.airport_id);
  const repeatedFirstDay = buildRankings('2026-03-24', rows).today.map((item) => item.airport_id);
  const expectedPool = Array.from({ length: 9 }, (_, index) => index + 1);
  const expectedFirstDay = Array.from(
    { length: 3 },
    (_, index) => expectedPool[(getDateOrdinal('2026-03-24') + index) % expectedPool.length],
  );
  const expectedSecondDay = Array.from(
    { length: 3 },
    (_, index) => expectedPool[(getDateOrdinal('2026-03-25') + index) % expectedPool.length],
  );

  assert.deepEqual(firstDay, expectedFirstDay);
  assert.deepEqual(secondDay, expectedSecondDay);
  assert.deepEqual(repeatedFirstDay, expectedFirstDay);
  assert.ok(firstDay.every((airportId) => expectedPool.includes(airportId)));
  assert.ok(!firstDay.includes(10));
});

test('buildRankings does not backfill today picks with penalized airports when fewer than three are eligible', () => {
  const rankings = buildRankings('2026-03-24', [
    createRow(1, { riskPenalty: 0 }),
    createRow(2, { riskPenalty: 0 }),
    createRow(3, { riskPenalty: 5, displayScore: 120 }),
    createRow(4, { is_listed: false, riskPenalty: 0, displayScore: 118 }),
  ]);

  assert.deepEqual(rankings.today.map((item) => item.airport_id).sort((left, right) => left - right), [1, 2]);
  assert.equal(rankings.today.length, 2);
});
