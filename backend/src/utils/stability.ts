import { STABILITY_RULES, SCORE_WEIGHTS } from '../config/scoring';

export interface LatencyStats {
  meanMs: number | null;
  stdMs: number | null;
  cv: number | null;
}

export function computeLatencyStats(samples: number[]): LatencyStats {
  if (samples.length === 0) {
    return {
      meanMs: null,
      stdMs: null,
      cv: null,
    };
  }

  const meanMs = average(samples);
  const stdMs = standardDeviation(samples, meanMs);
  const cv = meanMs > 0 ? stdMs / meanMs : null;

  return {
    meanMs: round2(meanMs),
    stdMs: round2(stdMs),
    cv: cv === null ? null : round4(cv),
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
  latencyCv: number | null,
  latencySampleCount: number,
): boolean {
  if (uptimePercent < STABILITY_RULES.minDailyUptimePercent) {
    return false;
  }
  if (latencySampleCount <= 0 || latencyCv === null || !Number.isFinite(latencyCv)) {
    return false;
  }
  return latencyCv <= STABILITY_RULES.maxLatencyCv;
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
