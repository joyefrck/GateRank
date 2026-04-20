import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeEffectiveLatencyStats,
  computeStabilityScore,
  getStabilityTier,
  isHealthyDay,
  isStableDay,
} from '../src/utils/stability';

test('computeEffectiveLatencyStats protects low-latency routes from inflated CV', () => {
  const stats = computeEffectiveLatencyStats([3.7, 6.03, 3.74, 5.89, 3.48]);

  assert.equal(stats.sampleCount, 5);
  assert.equal(stats.evaluatedSampleCount, 3);
  assert.equal(stats.cv, 0.1023);
  assert.equal(isStableDay(100, [3.7, 6.03, 3.74, 5.89, 3.48]), true);
});

test('computeEffectiveLatencyStats tolerates a single spike when the rest of the samples are stable', () => {
  const stats = computeEffectiveLatencyStats([59.19, 3.82, 7.21, 6.63, 6.94]);

  assert.equal(stats.sampleCount, 5);
  assert.deepEqual(stats.evaluatedSamples, [6.63, 6.94, 7.21]);
  assert.equal(stats.cv, 0.0237);
  assert.equal(isStableDay(100, [59.19, 3.82, 7.21, 6.63, 6.94]), true);
});

test('getStabilityTier marks slightly noisy but available days as minor fluctuation', () => {
  const samples = [10, 12, 22, 20, 14];
  assert.equal(getStabilityTier(100, samples), 'minor_fluctuation');
  assert.equal(isStableDay(100, samples), false);
  assert.equal(isHealthyDay(100, samples), true);
});

test('getStabilityTier treats missing valid latency samples as volatile', () => {
  assert.equal(getStabilityTier(100, []), 'volatile');
  assert.equal(isHealthyDay(100, []), false);
});

test('isStableDay still rejects genuinely noisy latency samples', () => {
  const samples = [5, 20, 40, 60, 90];
  const stats = computeEffectiveLatencyStats(samples);

  assert.equal(stats.cv, 0.4082);
  assert.equal(getStabilityTier(100, samples), 'volatile');
  assert.equal(isStableDay(100, samples), false);
  assert.equal(computeStabilityScore(stats.cv), 59.18);
});
