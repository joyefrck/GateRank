import test from 'node:test';
import assert from 'node:assert/strict';
import { computeScore, normalizeLinear } from '../src/services/scoringEngine';
import type { Airport, DailyMetrics } from '../src/types/domain';

test('normalizeLinear clamps for higherIsBetter', () => {
  assert.equal(normalizeLinear(100, 90, 50, true), 100);
  assert.equal(normalizeLinear(40, 90, 50, true), 0);
  assert.equal(normalizeLinear(70, 90, 50, true), 50);
});

test('normalizeLinear clamps for lowerIsBetter', () => {
  assert.equal(normalizeLinear(5, 10, 50, false), 100);
  assert.equal(normalizeLinear(60, 10, 50, false), 0);
  assert.equal(normalizeLinear(30, 10, 50, false), 50);
});

test('computeScore returns bounded and weighted output', () => {
  const airport: Airport = {
    id: 1,
    name: 'A',
    website: 'https://a.example.com',
    status: 'normal',
    plan_price_month: 20,
    has_trial: true,
    tags: ['cheap'],
    created_at: '2026-03-20',
  };

  const metrics: DailyMetrics = {
    airport_id: 1,
    date: '2026-03-22',
    uptime_percent_30d: 99.8,
    median_latency_ms: 100,
    median_download_mbps: 250,
    packet_loss_percent: 0.2,
    stable_days_streak: 28,
    domain_ok: true,
    ssl_days_left: 45,
    recent_complaints_count: 1,
    history_incidents: 0,
  };

  const out = computeScore(airport, metrics, 88);
  assert.ok(out.s >= 0 && out.s <= 100);
  assert.ok(out.p >= 0 && out.p <= 100);
  assert.ok(out.c >= 0 && out.c <= 100);
  assert.ok(out.r >= 0 && out.r <= 100);
  assert.ok(out.score >= 0 && out.score <= 100);
  assert.equal(out.final_score, Number((out.recent_score * 0.7 + 88 * 0.3).toFixed(2)));
});
