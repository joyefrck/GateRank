import test from 'node:test';
import assert from 'node:assert/strict';
import { applyScoreComponents, finalComponentTotal } from '../../shared/gateRankScore';
import { componentEditorState, storeComponentCalculation, effectiveComponent } from '../src/services/scoreComponents';
import { computeFinalEngineScore } from '../src/services/scoringEngine';

const automatic = { s: 70, p: 80, n: 90, c: 100, r: 60 };
test('component overrides are final inputs, preserve zero, and use the existing cold-start factor', () => {
  assert.equal(finalComponentTotal(automatic, 'v2_spncr', 1), 79);
  const effective = applyScoreComponents(automatic, { s: 0, p: 100, c: null }, 'v2_spncr');
  assert.deepEqual(effective, { ...automatic, s: 0, p: 100 });
  assert.equal(finalComponentTotal(effective, 'v2_spncr', 0.43), 27.52);
  assert.deepEqual(automatic, { s: 70, p: 80, n: 90, c: 100, r: 60 });
});

test('v1 ignores N and preserves its original weights and rounding order', () => {
  const effective = applyScoreComponents(automatic, { n: 100 }, 'v1_spcr');
  assert.equal(effective.n, null);
  assert.equal(finalComponentTotal(effective, 'v1_spcr', 1), 74);
  assert.equal(finalComponentTotal({ ...effective, s: 33.33, p: 22.22 }, 'v1_spcr', 0.14), 5.88);
});

test('editor calculation preserves legacy totals until converted and keeps raw series untouched', () => {
  const calculated = computeFinalEngineScore({
    sSeries: [{ date: '2026-09-04', score: 70 }], pSeries: [{ date: '2026-09-04', score: 80 }],
    rSeries: [{ date: '2026-09-04', score: 60 }], pricePer100gb: 20,
    referenceDate: '2026-09-04', ruleVersion: 'v2_spncr', networkCoverageScore: 90,
  });
  const details = { score_rule_version: 'v2_spncr', manual_total_score: 95, manual_score_p: 0 };
  const state = componentEditorState(calculated, details);
  assert.equal(state.total_score, 95);
  assert.equal(state.formula_total_score, 7.7);
  assert.equal(state.effective.p, 0);
  const score = { ...automatic, score: 79, recent_score: 79, historical_score: 79, final_score: 79, risk_penalty: 40, details };
  storeComponentCalculation(score, calculated);
  assert.equal(score.p, 80);
  assert.equal(effectiveComponent(score, 'p'), 0);
  assert.equal(effectiveComponent({ s: 70 }, 's'), 70);
});
