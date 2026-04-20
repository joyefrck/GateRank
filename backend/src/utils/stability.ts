import { STABILITY_RULES, SCORE_WEIGHTS } from '../config/scoring';
import type { StabilityTier } from '../types/domain';

export interface LatencyStats {
  meanMs: number | null;
  stdMs: number | null;
  cv: number | null;
}

export interface EffectiveLatencyStats extends LatencyStats {
  sampleCount: number;
  evaluatedSampleCount: number;
  evaluatedSamples: number[];
}

export function computeLatencyStats(samples: number[]): LatencyStats {
  const normalizedSamples = normalizeSamples(samples);
  if (normalizedSamples.length === 0) {
    return {
      meanMs: null,
      stdMs: null,
      cv: null,
    };
  }

  const meanMs = average(normalizedSamples);
  const stdMs = standardDeviation(normalizedSamples, meanMs);
  const cv = meanMs > 0 ? stdMs / meanMs : null;

  return {
    meanMs: round2(meanMs),
    stdMs: round2(stdMs),
    cv: cv === null ? null : round4(cv),
  };
}

export function computeEffectiveLatencyStats(samples: number[]): EffectiveLatencyStats {
  const normalizedSamples = normalizeSamples(samples);
  const evaluatedSamples = trimSamples(normalizedSamples);
  if (evaluatedSamples.length === 0) {
    return {
      meanMs: null,
      stdMs: null,
      cv: null,
      sampleCount: normalizedSamples.length,
      evaluatedSampleCount: 0,
      evaluatedSamples: [],
    };
  }

  const meanMs = average(evaluatedSamples);
  const stdMs = standardDeviation(evaluatedSamples, meanMs);
  const cv =
    meanMs > 0 ? stdMs / Math.max(meanMs, STABILITY_RULES.effectiveMeanFloorMs) : null;

  return {
    meanMs: round2(meanMs),
    stdMs: round2(stdMs),
    cv: cv === null ? null : round4(cv),
    sampleCount: normalizedSamples.length,
    evaluatedSampleCount: evaluatedSamples.length,
    evaluatedSamples,
  };
}

export function computeUptimeScore(uptimePercent: number): number {
  return round2(clamp((uptimePercent - STABILITY_RULES.uptimeBaseline) * 20, 0, 100));
}

export function computeStabilityScore(latencyCv: number | null): number {
  if (latencyCv === null || !Number.isFinite(latencyCv)) {
    return 0;
  }
  return round2(clamp(100 - latencyCv * 100, 0, 100));
}

export function computeStreakScore(stableDaysStreak: number): number {
  return round2(
    clamp((stableDaysStreak / STABILITY_RULES.streakCapDays) * 100, 0, 100),
  );
}

export function computeSScore(
  uptimeScore: number,
  stabilityScore: number,
  streakScore: number,
): number {
  return round2(
    uptimeScore * SCORE_WEIGHTS.stability.uptime +
      stabilityScore * SCORE_WEIGHTS.stability.stability +
      streakScore * SCORE_WEIGHTS.stability.streak,
  );
}

export function isStableDay(
  uptimePercent: number,
  latencySamples: number[],
): boolean {
  return getStabilityTier(uptimePercent, latencySamples) === 'stable';
}

export function isHealthyDay(
  uptimePercent: number,
  latencySamples: number[],
): boolean {
  return getStabilityTier(uptimePercent, latencySamples) !== 'volatile';
}

export function getStabilityTier(
  uptimePercent: number,
  latencySamples: number[],
): StabilityTier {
  if (uptimePercent < STABILITY_RULES.minHealthyDailyUptimePercent) {
    return 'volatile';
  }

  const effectiveStats = computeEffectiveLatencyStats(latencySamples);
  if (
    effectiveStats.evaluatedSampleCount <= 0 ||
    effectiveStats.cv === null ||
    !Number.isFinite(effectiveStats.cv)
  ) {
    return 'volatile';
  }

  if (
    uptimePercent >= STABILITY_RULES.minDailyUptimePercent &&
    effectiveStats.cv <= STABILITY_RULES.maxLatencyCv
  ) {
    return 'stable';
  }

  if (effectiveStats.cv <= STABILITY_RULES.maxMinorLatencyCv) {
    return 'minor_fluctuation';
  }

  return 'volatile';
}

function normalizeSamples(samples: number[]): number[] {
  return samples.filter((sample) => Number.isFinite(sample)).map((sample) => round2(sample));
}

function trimSamples(samples: number[]): number[] {
  if (samples.length < STABILITY_RULES.trimMinSampleCount) {
    return samples.slice();
  }

  const sorted = samples.slice().sort((left, right) => left - right);
  return sorted.slice(
    STABILITY_RULES.trimEdgeSampleCount,
    sorted.length - STABILITY_RULES.trimEdgeSampleCount,
  );
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[], meanValue: number): number {
  if (values.length === 1) {
    return 0;
  }

  const variance =
    values.reduce((sum, value) => sum + (value - meanValue) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
