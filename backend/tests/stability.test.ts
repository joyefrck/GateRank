import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeEffectiveLatencyStats,
  computeStabilityScore,
  getStabilityTier,
  isHealthyDay,
  isStableDay,
} from '../src/utils/stability';

test('computeEffectiveLatencyStats protects low-latency routes from inflated CV without trimming small sets', () => {
  const stats = computeEffectiveLatencyStats([3.7, 6.03, 3.74, 5.89, 3.48]);

  assert.equal(stats.sampleCount, 5);
  assert.equal(stats.evaluatedSampleCount, 5);
  assert.equal(stats.cv, 0);
  assert.equal(isStableDay(100, [3.7, 6.03, 3.74, 5.89, 3.48]), true);
});

test('computeEffectiveLatencyStats drops only the max latency sample when six samples are present', () => {
  const stats = computeEffectiveLatencyStats([59.19, 3.82, 7.21, 6.63, 6.94, 8.01]);

  assert.equal(stats.sampleCount, 6);
  assert.deepEqual(stats.evaluatedSamples, [3.82, 6.63, 6.94, 7.21, 8.01]);
  assert.equal(stats.cv, 0);
  assert.equal(isStableDay(100, [59.19, 3.82, 7.21, 6.63, 6.94, 8.01]), true);
});

test('computeEffectiveLatencyStats treats all samples under 200ms as normal stability', () => {
  const samples = [5, 60, 190, 120, 88];
  const stats = computeEffectiveLatencyStats(samples);

  assert.equal(stats.cv, 0);
  assert.equal(getStabilityTier(100, samples), 'stable');
  assert.equal(isStableDay(100, samples), true);
  assert.equal(computeStabilityScore(stats.cv), 100);
});

test('getStabilityTier keeps sustained 250ms latency in the stable ladder band', () => {
  const samples = [240, 250, 260, 255, 245];
  const stats = computeEffectiveLatencyStats(samples);

  assert.equal(stats.cv, 0.1);
  assert.equal(getStabilityTier(100, samples), 'stable');
  assert.equal(isStableDay(100, samples), true);
  assert.equal(computeStabilityScore(stats.cv), 90);
});

test('getStabilityTier marks sustained 350-500ms latency as minor fluctuation', () => {
  const samples = [350, 380, 420, 460, 490];
  const stats = computeEffectiveLatencyStats(samples);

  assert.equal(stats.cv, 0.25);
  assert.equal(getStabilityTier(100, samples), 'minor_fluctuation');
  assert.equal(isStableDay(100, samples), false);
  assert.equal(isHealthyDay(100, samples), true);
  assert.equal(computeStabilityScore(stats.cv), 75);
});

test('getStabilityTier treats missing valid latency samples as volatile', () => {
  assert.equal(getStabilityTier(100, []), 'volatile');
  assert.equal(isHealthyDay(100, []), false);
});

test('isStableDay gradually rejects sustained 600ms+ latency without zeroing the score', () => {
  const samples = [600, 620, 650, 680, 700];
  const stats = computeEffectiveLatencyStats(samples);

  assert.equal(stats.cv, 0.45);
  assert.equal(getStabilityTier(100, samples), 'volatile');
  assert.equal(isStableDay(100, samples), false);
  assert.equal(computeStabilityScore(stats.cv), 55);
});

test('computeEffectiveLatencyStats trims a single high latency spike before applying the ladder', () => {
  const samples = [10, 12, 14, 16, 18, 900];
  const stats = computeEffectiveLatencyStats(samples);

  assert.deepEqual(stats.evaluatedSamples, [10, 12, 14, 16, 18]);
  assert.equal(stats.cv, 0);
  assert.equal(getStabilityTier(100, samples), 'stable');
});
