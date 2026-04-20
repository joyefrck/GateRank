import {
  STABILITY_RULES,
  FINAL_ENGINE_WEIGHTS,
  SCORE_WEIGHTS,
  THRESHOLDS,
  TIME_DECAY_LAMBDA,
} from '../config/scoring';
import type { Airport, DailyMetrics, ScoreBreakdown, TimeSeriesScorePoint } from '../types/domain';
import {
  computeLatencyStats,
  computeEffectiveLatencyStats,
  computeSScore,
  computeStabilityScore,
  computeStreakScore,
  computeUptimeScore,
} from '../utils/stability';

export function normalizeLinear(
  value: number,
  good: number,
  bad: number,
  higherIsBetter: boolean,
): number {
  if (Number.isNaN(value)) {
    return 0;
  }

  if (higherIsBetter) {
    if (value >= good) return 100;
    if (value <= bad) return 0;
    return clamp(((value - bad) / (good - bad)) * 100, 0, 100);
  }

  if (value <= good) return 100;
  if (value >= bad) return 0;
  return clamp(((bad - value) / (bad - good)) * 100, 0, 100);
}

export function computeScore(
  airport: Airport,
  metrics: DailyMetrics,
  historicalScore: number,
): ScoreBreakdown {
  const uptimeBasis = metrics.uptime_percent_today ?? metrics.uptime_percent_30d;
  const latencySamples = metrics.latency_samples_ms || [];
  const latencyStats = computeLatencyStats(latencySamples);
  const effectiveLatencyStats = computeEffectiveLatencyStats(latencySamples);
  const rawLatencyCv = metrics.latency_cv ?? latencyStats.cv;
  const effectiveLatencyCv = effectiveLatencyStats.cv ?? rawLatencyCv;
  const uptimeScore = computeUptimeScore(uptimeBasis);
  const stabilityScore = computeStabilityScore(effectiveLatencyCv);
  const streakBasisDays = metrics.healthy_days_streak ?? metrics.stable_days_streak;
  const streakScore = computeStreakScore(streakBasisDays);

  const latencyScore = normalizeLinear(
    metrics.median_latency_ms,
    THRESHOLDS.latency_ms.good,
    THRESHOLDS.latency_ms.bad,
    THRESHOLDS.latency_ms.higherIsBetter,
  );
  const speedScore = normalizeLinear(
    metrics.median_download_mbps,
    THRESHOLDS.download_mbps.good,
    THRESHOLDS.download_mbps.bad,
    THRESHOLDS.download_mbps.higherIsBetter,
  );
  const lossScore = normalizeLinear(
    metrics.packet_loss_percent,
    THRESHOLDS.packet_loss_percent.good,
    THRESHOLDS.packet_loss_percent.bad,
    THRESHOLDS.packet_loss_percent.higherIsBetter,
  );

  const priceScore = normalizeLinear(
    airport.plan_price_month,
    THRESHOLDS.price_month.good,
    THRESHOLDS.price_month.bad,
    THRESHOLDS.price_month.higherIsBetter,
  );
  const trialScore = airport.has_trial ? 100 : 0;
  const valueRatio = metrics.median_download_mbps / Math.max(airport.plan_price_month, 1);
  const valueScore = normalizeLinear(
    valueRatio,
    THRESHOLDS.value_ratio.good,
    THRESHOLDS.value_ratio.bad,
    THRESHOLDS.value_ratio.higherIsBetter,
  );

  const domainPenalty = calcDomainPenalty(metrics.domain_ok);
  const sslPenalty = calcSslPenalty(metrics.ssl_days_left);
  const complaintPenalty = calcComplaintPenalty(metrics.recent_complaints_count);
  const historyPenalty = calcHistoryPenalty(metrics.history_incidents);
  const riskPenalty = round2(domainPenalty + sslPenalty + complaintPenalty + historyPenalty);

  const s = computeSScore(uptimeScore, stabilityScore, streakScore);

  const p =
    latencyScore * SCORE_WEIGHTS.performance.latency +
    speedScore * SCORE_WEIGHTS.performance.speed +
    lossScore * SCORE_WEIGHTS.performance.loss;

  const c =
    priceScore * SCORE_WEIGHTS.cost.price +
    trialScore * SCORE_WEIGHTS.cost.trial +
    valueScore * SCORE_WEIGHTS.cost.value;

  const r = round2(clamp(100 - riskPenalty, 0, 100));

  const score =
    s * SCORE_WEIGHTS.final.s +
    p * SCORE_WEIGHTS.final.p +
    c * SCORE_WEIGHTS.final.c +
    r * SCORE_WEIGHTS.final.r;

  const recentScore = score;
  const finalScore =
    recentScore * SCORE_WEIGHTS.decay.recent +
    historicalScore * SCORE_WEIGHTS.decay.historical;

  return {
    s: round2(s),
    p: round2(p),
    c: round2(c),
    r: round2(r),
    risk_penalty: round2(riskPenalty),
    score: round2(score),
    recent_score: round2(recentScore),
    historical_score: round2(historicalScore),
    final_score: round2(finalScore),
    details: {
      uptime_score: round2(uptimeScore),
      stability_score: round2(stabilityScore),
      streak_score: round2(streakScore),
      latency_score: round2(latencyScore),
      speed_score: round2(speedScore),
      loss_score: round2(lossScore),
      price_score: round2(priceScore),
      trial_score: round2(trialScore),
      value_score: round2(valueScore),
      value_ratio: round2(valueRatio),
      domain_penalty: round2(domainPenalty),
      ssl_penalty: round2(sslPenalty),
      complaint_penalty: round2(complaintPenalty),
      history_penalty: round2(historyPenalty),
      total_penalty: round2(riskPenalty),
      risk_level: riskLevelFromScore(r),
      uptime_percent_basis: round2(uptimeBasis),
      streak_basis_days: round2(streakBasisDays),
      latency_cv: effectiveLatencyCv === null ? null : round4(effectiveLatencyCv),
      latency_cv_raw: rawLatencyCv === null ? null : round4(rawLatencyCv),
      effective_latency_cv: effectiveLatencyCv === null ? null : round4(effectiveLatencyCv),
      stability_tier: metrics.stability_tier ?? null,
      stability_rule_version: STABILITY_RULES.ruleVersion,
    },
  };
}

export function timeDecayWeight(daysDiff: number, decayLambda: number = TIME_DECAY_LAMBDA): number {
  if (!Number.isFinite(daysDiff) || daysDiff < 0) {
    return 0;
  }
  return Math.exp(-decayLambda * daysDiff);
}

export function computeWeightedScore(
  timeSeries: TimeSeriesScorePoint[],
  referenceDate: string,
  decayLambda: number = TIME_DECAY_LAMBDA,
): number {
  if (timeSeries.length === 0) {
    return 0;
  }

  const referenceTime = parseDateOnlyUtc(referenceDate);
  let totalWeight = 0;
  let weightedSum = 0;

  for (const item of timeSeries) {
    const itemTime = parseDateOnlyUtc(item.date);
    if (Number.isNaN(itemTime) || Number.isNaN(item.score)) {
      continue;
    }

    const daysDiff = Math.max(0, Math.floor((referenceTime - itemTime) / DAY_MS));
    const weight = timeDecayWeight(daysDiff, decayLambda);
    weightedSum += item.score * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return 0;
  }

  return round2(weightedSum / totalWeight);
}

export interface FinalEngineScoreInput {
  sSeries: TimeSeriesScorePoint[];
  pSeries: TimeSeriesScorePoint[];
  rSeries: TimeSeriesScorePoint[];
  pricePer100gb: number;
  referenceDate: string;
}

export interface FinalEngineScoreResult {
  s: number;
  p: number;
  r: number;
  c: number;
  final_score: number;
  data_days: number;
  cold_start_factor: number;
}

export function calcPriceScore(pricePer100gb: number): number {
  return round2(clamp(100 - pricePer100gb, 0, 100));
}

export function coldStartFactor(days: number): number {
  return round2(clamp(days / 7, 0, 1));
}

export function computeFinalEngineScore(input: FinalEngineScoreInput): FinalEngineScoreResult {
  const s = computeWeightedScore(input.sSeries, input.referenceDate);
  const p = computeWeightedScore(input.pSeries, input.referenceDate);
  const r = computeWeightedScore(input.rSeries, input.referenceDate);
  const c = calcPriceScore(input.pricePer100gb);
  const dataDays = Math.min(input.sSeries.length, input.pSeries.length);
  const factor = coldStartFactor(dataDays);
  const total =
    (
      FINAL_ENGINE_WEIGHTS.s * s +
      FINAL_ENGINE_WEIGHTS.p * p +
      FINAL_ENGINE_WEIGHTS.r * r +
      FINAL_ENGINE_WEIGHTS.c * c
    ) * factor;

  return {
    s,
    p,
    r,
    c,
    final_score: round2(total),
    data_days: dataDays,
    cold_start_factor: factor,
  };
}

export function calcDomainPenalty(domainOk: boolean): number {
  return domainOk ? 0 : 30;
}

export function calcSslPenalty(sslDaysLeft: number | null | undefined): number {
  if (sslDaysLeft === null || sslDaysLeft === undefined) {
    return 5;
  }
  if (sslDaysLeft < 0) {
    return 30;
  }
  if (sslDaysLeft < 7) {
    return 20;
  }
  if (sslDaysLeft < 15) {
    return 10;
  }
  if (sslDaysLeft < 30) {
    return 5;
  }
  return 0;
}

export function calcComplaintPenalty(recentComplaintsCount: number): number {
  return Math.min(Math.max(recentComplaintsCount, 0) * 3, 15);
}

export function calcHistoryPenalty(historyIncidents: number): number {
  return Math.min(Math.max(historyIncidents, 0) * 10, 30);
}

export function riskLevelFromScore(rScore: number): string {
  if (rScore >= 85) {
    return 'low';
  }
  if (rScore >= 70) {
    return 'medium_low';
  }
  if (rScore >= 55) {
    return 'medium';
  }
  return 'high';
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

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDateOnlyUtc(value: string): number {
  return Date.parse(`${value}T00:00:00.000Z`);
}
