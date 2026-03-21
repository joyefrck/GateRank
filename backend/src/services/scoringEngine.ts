import { SCORE_WEIGHTS, THRESHOLDS } from '../config/scoring';
import type { Airport, DailyMetrics, ScoreBreakdown } from '../types/domain';

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
  const uptimeScore = normalizeLinear(
    metrics.uptime_percent_30d,
    THRESHOLDS.uptime_percent_30d.good,
    THRESHOLDS.uptime_percent_30d.bad,
    THRESHOLDS.uptime_percent_30d.higherIsBetter,
  );
  const stabilityScore = normalizeLinear(
    metrics.stable_days_streak,
    THRESHOLDS.stability_days_streak.good,
    THRESHOLDS.stability_days_streak.bad,
    THRESHOLDS.stability_days_streak.higherIsBetter,
  );
  const streakScore = stabilityScore;

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

  const domainPenalty = metrics.domain_ok ? 0 : 30;
  const sslPenalty = clamp(
    normalizeLinear(
      metrics.ssl_days_left,
      THRESHOLDS.ssl_days_left.good,
      THRESHOLDS.ssl_days_left.bad,
      THRESHOLDS.ssl_days_left.higherIsBetter,
    ),
    0,
    100,
  );
  const complaintsPenalty = clamp(metrics.recent_complaints_count * 2, 0, 25);
  const incidentsPenalty = clamp(metrics.history_incidents * 8, 0, 40);
  const sslRiskPenalty = 100 - sslPenalty;
  const riskPenalty = clamp(domainPenalty + sslRiskPenalty * 0.25 + complaintsPenalty + incidentsPenalty, 0, 100);

  const s =
    uptimeScore * SCORE_WEIGHTS.stability.uptime +
    stabilityScore * SCORE_WEIGHTS.stability.stability +
    streakScore * SCORE_WEIGHTS.stability.streak;

  const p =
    latencyScore * SCORE_WEIGHTS.performance.latency +
    speedScore * SCORE_WEIGHTS.performance.speed +
    lossScore * SCORE_WEIGHTS.performance.loss;

  const c =
    priceScore * SCORE_WEIGHTS.cost.price +
    trialScore * SCORE_WEIGHTS.cost.trial +
    valueScore * SCORE_WEIGHTS.cost.value;

  const r = 100 - riskPenalty;

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
      ssl_penalty: round2(sslRiskPenalty),
      complaints_penalty: round2(complaintsPenalty),
      incidents_penalty: round2(incidentsPenalty),
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
