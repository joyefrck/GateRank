import assert from 'node:assert/strict';
import test from 'node:test';
import { isHomeSummaryEligible, type HomeSummaryCandidate } from '../src/utils/homeSummaryEligibility';

function candidate(): HomeSummaryCandidate {
  return { airport: { is_listed: true, status: 'normal', tags: [] },
    metrics: { stable_days_streak: 14, domain_ok: true, ssl_days_left: 90, recent_complaints_count: 0, history_incidents: 0 },
    score: { s: 80, p: 65, c: 75, r: 75, details: {} } };
}

test('inclusive thresholds admit both sections; every gate excludes values below its boundary', () => {
  assert.ok(isHomeSummaryEligible(candidate(), 'most_stable'));
  assert.ok(isHomeSummaryEligible(candidate(), 'best_value'));
  for (const key of ['s', 'p', 'c', 'r'] as const) {
    const row = candidate(); row.score[key] -= 0.01;
    assert.equal(isHomeSummaryEligible(row, 'best_value'), false, key);
    assert.equal(isHomeSummaryEligible(row, 'most_stable'), key === 'p' || key === 'c', key);
  }
  const row = candidate(); row.metrics.stable_days_streak = 13;
  assert.equal(isHomeSummaryEligible(row, 'most_stable'), false);
});

test('detail scales follow existing tags and missing/nonfinite evidence cannot qualify', () => {
  const row = candidate();
  row.score.details = { stability_score: 79, price_score: 74 };
  row.score.s = row.score.c = 100;
  assert.equal(isHomeSummaryEligible(row, 'most_stable'), false);
  row.score.details.stability_score = 80;
  assert.equal(isHomeSummaryEligible(row, 'most_stable'), true);
  assert.equal(isHomeSummaryEligible(row, 'best_value'), false);
  for (const value of [NaN, Infinity, undefined]) {
    const bad = candidate(); bad.metrics.stable_days_streak = value as number;
    assert.equal(isHomeSummaryEligible(bad, 'most_stable'), false);
  }
});

test('unlisted, risky, down, tagged and active risk records are excluded', () => {
  const mutations: Array<(row: HomeSummaryCandidate) => void> = [
    row => { row.airport.is_listed = false; }, row => { row.airport.status = 'risk'; },
    row => { row.airport.status = 'down'; }, row => { row.airport.tags = ['风险观察']; },
    row => { row.airport.tags = ['不推荐']; }, row => { row.metrics.domain_ok = false; },
    row => { row.metrics.ssl_days_left = null; }, row => { row.metrics.recent_complaints_count = 1; },
    row => { row.metrics.history_incidents = 1; }, row => { row.score.details.complaint_penalty = 1; },
  ];
  for (const mutate of mutations) {
    const row = candidate(); mutate(row);
    assert.equal(isHomeSummaryEligible(row, 'most_stable'), false);
    assert.equal(isHomeSummaryEligible(row, 'best_value'), false);
  }
});
