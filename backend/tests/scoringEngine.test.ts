import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcComplaintPenalty,
  calcHistoryPenalty,
  calcNodeAvailabilityPenalty,
  calcPriceScore,
  calcSslPenalty,
  coldStartFactor,
  computeFinalEngineScore,
  computeWeightedScore,
  computeScore,
  normalizeLinear,
  riskLevelFromScore,
  timeDecayWeight,
} from '../src/services/scoringEngine';
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

test('timeDecayWeight applies exponential decay by day', () => {
  assert.equal(timeDecayWeight(0), 1);
  assert.equal(Number(timeDecayWeight(3).toFixed(6)), 0.740818);
});

test('computeWeightedScore emphasizes newer dates', () => {
  const out = computeWeightedScore(
    [
      { date: '2026-03-20', score: 80 },
      { date: '2026-03-21', score: 85 },
      { date: '2026-03-22', score: 70 },
    ],
    '2026-03-22',
  );

  assert.equal(out, 77.99);
});

test('computeFinalEngineScore combines S/P/R and price with cold start factor', () => {
  const out = computeFinalEngineScore({
    sSeries: [{ date: '2026-03-20', score: 80 }],
    pSeries: [{ date: '2026-03-20', score: 70 }],
    rSeries: [{ date: '2026-03-20', score: 90 }],
    pricePer100gb: 20,
    referenceDate: '2026-03-20',
  });

  assert.equal(calcPriceScore(20), 100);
  assert.equal(coldStartFactor(1), 0.14);
  assert.equal(out.s, 80);
  assert.equal(out.p, 70);
  assert.equal(out.r, 90);
  assert.equal(out.c, 100);
  assert.equal(out.data_days, 1);
  assert.equal(out.final_score, 11.34);
});

test('calcPriceScore uses three monthly price bands', () => {
  assert.equal(calcPriceScore(1), 100);
  assert.equal(calcPriceScore(20), 100);
  assert.equal(calcPriceScore(30), 100);
  assert.equal(calcPriceScore(31), 80);
  assert.equal(calcPriceScore(40), 80);
  assert.equal(calcPriceScore(50), 80);
  assert.equal(calcPriceScore(51), 60);
  assert.equal(calcPriceScore(80), 60);
});

test('computeScore does not use trial support in the price dimension', () => {
  const baseAirport: Airport = {
    id: 1,
    name: 'A',
    website: 'https://a.example.com',
    status: 'normal',
    is_listed: true,
    plan_price_month: 40,
    has_trial: true,
    tags: [],
    created_at: '2026-03-20',
  };

  const metrics: DailyMetrics = {
    airport_id: 1,
    date: '2026-03-22',
    uptime_percent_30d: 99,
    uptime_percent_today: 99,
    latency_samples_ms: [100, 120],
    median_latency_ms: 110,
    median_download_mbps: 100,
    packet_loss_percent: 1,
    stable_days_streak: 15,
    healthy_days_streak: 15,
    domain_ok: true,
    ssl_days_left: 30,
    recent_complaints_count: 0,
    history_incidents: 0,
  };

  const withTrial = computeScore(baseAirport, metrics, 0);
  const withoutTrial = computeScore({ ...baseAirport, has_trial: false }, metrics, 0);

  assert.equal(withTrial.details.price_score, 80);
  assert.equal(withTrial.details.value_score, 5);
  assert.equal(withTrial.c, 65);
  assert.equal(withTrial.c, withoutTrial.c);
  assert.equal(withTrial.score, withoutTrial.score);
  assert.equal(Object.prototype.hasOwnProperty.call(withTrial.details, 'trial_score'), false);
});

test('computeScore prefers complete precomputed regional performance components', () => {
  const airport: Airport = {
    id: 1,
    name: 'A',
    website: 'https://a.example.com',
    status: 'normal',
    is_listed: true,
    plan_price_month: 40,
    has_trial: false,
    tags: [],
    created_at: '2026-08-08',
  };
  const metrics: DailyMetrics = {
    airport_id: 1,
    date: '2026-08-08',
    uptime_percent_30d: 100,
    median_latency_ms: 999,
    median_download_mbps: 1,
    packet_loss_percent: 100,
    performance_latency_score: 88,
    performance_speed_score: 77,
    performance_loss_score: 99,
    performance_score: 85.8,
    performance_rule_summary: 'cn_dual_probe_v1',
    performance_included_probe_ids: ['cn-guangzhou', 'cn-shanghai'],
    stable_days_streak: 1,
    domain_ok: true,
    ssl_days_left: 30,
    recent_complaints_count: 0,
    history_incidents: 0,
  };

  const score = computeScore(airport, metrics, 0);

  assert.equal(score.p, 85.8);
  assert.equal(score.details.latency_score, 88);
  assert.equal(score.details.speed_score, 77);
  assert.equal(score.details.loss_score, 99);
});

test('computeScore returns bounded and weighted output', () => {
  const airport: Airport = {
    id: 1,
    name: 'A',
    website: 'https://a.example.com',
    status: 'normal',
    is_listed: true,
    plan_price_month: 20,
    has_trial: true,
    tags: ['cheap'],
    created_at: '2026-03-20',
  };

  const metrics: DailyMetrics = {
    airport_id: 1,
    date: '2026-03-22',
    uptime_percent_30d: 99.8,
    uptime_percent_today: 99.8,
    latency_samples_ms: [100, 110, 90, 105, 95],
    median_latency_ms: 100,
    median_download_mbps: 250,
    packet_loss_percent: 0.2,
    stable_days_streak: 28,
    healthy_days_streak: 28,
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
  assert.equal(out.final_score, 91.76);
  assert.equal(out.details.ssl_penalty, 0);
  assert.equal(out.details.complaint_penalty, 3);
  assert.equal(out.details.history_penalty, 0);
  assert.equal(out.details.performance_included_probes, '');
  assert.equal(out.details.total_penalty, 3);
  assert.equal(out.details.risk_level, 'low');
});

test('computeScore uses uptime, latency cv and streak formulas for S', () => {
  const airport: Airport = {
    id: 1,
    name: 'A',
    website: 'https://a.example.com',
    status: 'normal',
    is_listed: true,
    plan_price_month: 20,
    has_trial: false,
    tags: [],
    created_at: '2026-03-20',
  };

  const metrics: DailyMetrics = {
    airport_id: 1,
    date: '2026-03-22',
    uptime_percent_30d: 98,
    uptime_percent_today: 99,
    latency_samples_ms: [100, 120],
    median_latency_ms: 110,
    median_download_mbps: 100,
    packet_loss_percent: 1,
    stable_days_streak: 15,
    healthy_days_streak: 15,
    domain_ok: true,
    ssl_days_left: 30,
    recent_complaints_count: 0,
    history_incidents: 0,
  };

  const out = computeScore(airport, metrics, 0);
  assert.equal(out.details.uptime_score, 80);
  assert.equal(out.details.stability_score, 100);
  assert.equal(out.details.streak_score, 50);
  assert.equal(out.s, 80);
});

test('computeScore uses effective latency cv for low-latency routes', () => {
  const airport: Airport = {
    id: 1,
    name: 'A',
    website: 'https://a.example.com',
    status: 'normal',
    is_listed: true,
    plan_price_month: 20,
    has_trial: false,
    tags: [],
    created_at: '2026-03-20',
  };

  const metrics: DailyMetrics = {
    airport_id: 1,
    date: '2026-03-28',
    uptime_percent_30d: 99.8,
    uptime_percent_today: 100,
    latency_samples_ms: [3.7, 6.03, 3.74, 5.89, 3.48, 59.19],
    latency_cv: 1.4909,
    median_latency_ms: 20,
    median_download_mbps: 100,
    packet_loss_percent: 0.2,
    stable_days_streak: 15,
    healthy_days_streak: 15,
    stability_tier: 'volatile',
    domain_ok: true,
    ssl_days_left: 30,
    recent_complaints_count: 0,
    history_incidents: 0,
  };

  const out = computeScore(airport, metrics, 0);
  assert.equal(out.details.latency_cv_raw, 1.4909);
  assert.equal(out.details.effective_latency_cv, 0);
  assert.equal(out.details.stability_tier, 'stable');
  assert.equal(out.details.stability_rule_version, 'stability_tier_v4');
  assert.equal(out.details.stability_score, 100);
  assert.equal(out.s, 90);
});

test('computeScore applies gradual penalties to sustained 600ms+ latency samples', () => {
  const airport: Airport = {
    id: 1,
    name: 'A',
    website: 'https://a.example.com',
    status: 'normal',
    is_listed: true,
    plan_price_month: 20,
    has_trial: false,
    tags: [],
    created_at: '2026-03-20',
  };

  const metrics: DailyMetrics = {
    airport_id: 1,
    date: '2026-03-28',
    uptime_percent_30d: 99.8,
    uptime_percent_today: 100,
    latency_samples_ms: [600, 620, 650, 680, 700],
    median_latency_ms: 80,
    median_download_mbps: 100,
    packet_loss_percent: 0.2,
    stable_days_streak: 0,
    healthy_days_streak: 0,
    domain_ok: true,
    ssl_days_left: 30,
    recent_complaints_count: 0,
    history_incidents: 0,
  };

  const out = computeScore(airport, metrics, 0);
  assert.equal(out.details.effective_latency_cv, 0.45);
  assert.equal(out.details.stability_score, 55);
});

test('computeScore prefers healthy streak days when minor fluctuation should not over-penalize S', () => {
  const airport: Airport = {
    id: 1,
    name: 'A',
    website: 'https://a.example.com',
    status: 'normal',
    is_listed: true,
    plan_price_month: 20,
    has_trial: false,
    tags: [],
    created_at: '2026-03-20',
  };

  const metrics: DailyMetrics = {
    airport_id: 1,
    date: '2026-04-02',
    uptime_percent_30d: 99.1,
    uptime_percent_today: 100,
    latency_samples_ms: [350, 380, 420, 460, 490],
    median_latency_ms: 60,
    median_download_mbps: 100,
    packet_loss_percent: 0.2,
    stable_days_streak: 0,
    healthy_days_streak: 12,
    stability_tier: 'minor_fluctuation',
    domain_ok: true,
    ssl_days_left: 30,
    recent_complaints_count: 0,
    history_incidents: 0,
  };

  const out = computeScore(airport, metrics, 0);
  assert.equal(out.details.streak_basis_days, 12);
  assert.equal(out.details.stability_tier, 'minor_fluctuation');
  assert.equal(out.details.streak_score, 40);
});

test('risk penalty helpers follow stepped MVP rules', () => {
  assert.equal(calcSslPenalty(null), 5);
  assert.equal(calcSslPenalty(-1), 30);
  assert.equal(calcSslPenalty(3), 20);
  assert.equal(calcSslPenalty(10), 10);
  assert.equal(calcSslPenalty(20), 5);
  assert.equal(calcSslPenalty(45), 0);

  assert.equal(calcComplaintPenalty(2), 6);
  assert.equal(calcComplaintPenalty(10), 15);
  assert.equal(calcHistoryPenalty(2), 20);
  assert.equal(calcHistoryPenalty(10), 30);
  assert.equal(calcNodeAvailabilityPenalty(null), 0);
  assert.equal(calcNodeAvailabilityPenalty(5), 0);
  assert.equal(calcNodeAvailabilityPenalty(20), 10);
  assert.equal(calcNodeAvailabilityPenalty(25), 12.5);
  assert.equal(calcNodeAvailabilityPenalty(50), 25);
  assert.equal(calcNodeAvailabilityPenalty(100), 30);

  assert.equal(riskLevelFromScore(90), 'low');
  assert.equal(riskLevelFromScore(72), 'medium_low');
  assert.equal(riskLevelFromScore(55), 'medium');
  assert.equal(riskLevelFromScore(40), 'high');
});

test('computeScore applies node availability penalty to R only', () => {
  const airport: Airport = {
    id: 1,
    name: 'A',
    website: 'https://a.example.com',
    status: 'normal',
    is_listed: true,
    plan_price_month: 20,
    has_trial: false,
    tags: [],
    created_at: '2026-03-20',
  };

  const metrics: DailyMetrics = {
    airport_id: 1,
    date: '2026-03-22',
    uptime_percent_30d: 99,
    uptime_percent_today: 99,
    latency_samples_ms: [100, 120],
    median_latency_ms: 110,
    median_download_mbps: 100,
    packet_loss_percent: 1,
    available_nodes_count: 15,
    unavailable_nodes_count: 5,
    node_availability_percent: 75,
    node_unavailability_percent: 25,
    stable_days_streak: 15,
    healthy_days_streak: 15,
    domain_ok: true,
    ssl_days_left: 30,
    recent_complaints_count: 0,
    history_incidents: 0,
  };

  const out = computeScore(airport, metrics, 0);
  assert.equal(out.details.node_availability_penalty, 12.5);
  assert.equal(out.risk_penalty, 12.5);
  assert.equal(out.r, 87.5);
  assert.equal(out.details.available_nodes_count, 15);
  assert.equal(out.details.unavailable_nodes_count, 5);
  assert.equal(out.details.node_unavailability_percent, 25);
});

test('computeScore treats missing ssl data as light risk', () => {
  const airport: Airport = {
    id: 1,
    name: 'A',
    website: 'https://a.example.com',
    status: 'normal',
    is_listed: true,
    plan_price_month: 20,
    has_trial: false,
    tags: [],
    created_at: '2026-03-20',
  };

  const metrics: DailyMetrics = {
    airport_id: 1,
    date: '2026-03-22',
    uptime_percent_30d: 99,
    uptime_percent_today: 99,
    latency_samples_ms: [100, 120],
    median_latency_ms: 110,
    median_download_mbps: 100,
    packet_loss_percent: 1,
    stable_days_streak: 15,
    healthy_days_streak: 15,
    domain_ok: true,
    ssl_days_left: null,
    recent_complaints_count: 2,
    history_incidents: 1,
  };

  const out = computeScore(airport, metrics, 0);
  assert.equal(out.risk_penalty, 21);
  assert.equal(out.r, 79);
  assert.equal(out.details.ssl_penalty, 5);
  assert.equal(out.details.complaint_penalty, 6);
  assert.equal(out.details.history_penalty, 10);
  assert.equal(out.details.total_penalty, 21);
  assert.equal(out.details.risk_level, 'medium_low');
});
