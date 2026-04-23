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

test('buildRankings excludes down airports from today ranking and all active lists', () => {
  const rankings = buildRankings('2026-03-24', [
    createRow(1, { riskPenalty: 10, displayScore: 120 }),
    createRow(2, { status: 'risk', riskPenalty: 0, displayScore: 110 }),
    createRow(3, { status: 'down', riskPenalty: 0, displayScore: 130 }),
  ]);

  assert.deepEqual(rankings.risk.map((item) => item.airport_id), [2]);
  assert.ok(rankings.today.every((item) => item.airport_id !== 3));
  assert.ok(rankings.today.some((item) => item.airport_id === 1));
  assert.ok(rankings.stable.every((item) => item.airport_id !== 3));
});

test('buildRankings excludes risk-watch airports from today ranking but allows volatile ones', () => {
  const rankings = buildRankings('2026-03-24', [
    createRow(1, { displayScore: 120, tags: ['风险观察'] }),
    createRow(2, { displayScore: 119, stabilityTier: 'volatile' }),
    createRow(3, { displayScore: 118 }),
    createRow(4, { displayScore: 117, stabilityTier: 'minor_fluctuation' }),
  ]);

  assert.deepEqual(rankings.today.map((item) => item.airport_id), [2, 3, 4]);
});

test('buildRankings sorts today picks by display score descending', () => {
  const rankings = buildRankings('2026-03-24', [
    createRow(1, { displayScore: 88 }),
    createRow(2, { displayScore: 97 }),
    createRow(3, { displayScore: 91 }),
    createRow(4, { displayScore: 95 }),
  ]);

  assert.deepEqual(rankings.today.map((item) => item.airport_id), [2, 4, 3]);
});

test('buildRankings uses streak, stability score, and id as today pick tiebreakers', () => {
  const rankings = buildRankings('2026-03-24', [
    createRow(1, { displayScore: 100, healthyDaysStreak: 10, s: 85 }),
    createRow(2, { displayScore: 100, healthyDaysStreak: 10, s: 85 }),
    createRow(3, { displayScore: 100, healthyDaysStreak: 12, s: 70 }),
    createRow(4, { displayScore: 100, healthyDaysStreak: 10, s: 90 }),
  ]);

  assert.deepEqual(rankings.today.map((item) => item.airport_id), [3, 4, 1]);
});

test('buildRankings falls back to final score when total score is missing', () => {
  const base = createRow(1, { displayScore: 80 });
  const higherFinal = createRow(2, { displayScore: 70 });
  higherFinal.score.final_score = 95;
  higherFinal.score.details = {} as any;

  const rankings = buildRankings('2026-03-24', [base, higherFinal]);

  assert.deepEqual(rankings.today.map((item) => item.airport_id), [2, 1]);
});

test('buildRankings does not backfill today picks with excluded airports when fewer than three are eligible', () => {
  const rankings = buildRankings('2026-03-24', [
    createRow(1, { riskPenalty: 0 }),
    createRow(2, { riskPenalty: 5, stabilityTier: 'volatile' }),
    createRow(3, { tags: ['风险观察'], displayScore: 120 }),
    createRow(4, { is_listed: false, displayScore: 118 }),
  ]);

  assert.deepEqual(rankings.today.map((item) => item.airport_id), [1, 2]);
  assert.equal(rankings.today.length, 2);
});
