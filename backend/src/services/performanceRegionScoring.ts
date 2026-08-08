import { SCORE_WEIGHTS, THRESHOLDS } from '../config/scoring';
import { getPerformanceScoringRule } from '../config/performanceProbes';
import type {
  PerformanceAggregate,
  PerformanceRegionMeasurement,
  PerformanceRegionScore,
} from '../types/domain';
import { normalizeLinear } from './scoringEngine';

export function scorePerformanceRegion(
  measurement: PerformanceRegionMeasurement,
): PerformanceRegionScore {
  assertFiniteMeasurement(measurement);
  const speedRule = getPerformanceScoringRule(measurement.scoring_rule_version);
  const latencyScore = normalizeLinear(
    measurement.median_latency_ms,
    THRESHOLDS.latency_ms.good,
    THRESHOLDS.latency_ms.bad,
    THRESHOLDS.latency_ms.higherIsBetter,
  );
  const speedScore = normalizeLinear(
    measurement.median_download_mbps,
    speedRule.speedGoodMbps,
    speedRule.speedBadMbps,
    true,
  );
  const lossScore = normalizeLinear(
    measurement.packet_loss_percent,
    THRESHOLDS.packet_loss_percent.good,
    THRESHOLDS.packet_loss_percent.bad,
    THRESHOLDS.packet_loss_percent.higherIsBetter,
  );
  const p =
    latencyScore * SCORE_WEIGHTS.performance.latency
    + speedScore * SCORE_WEIGHTS.performance.speed
    + lossScore * SCORE_WEIGHTS.performance.loss;

  return {
    ...measurement,
    latency_score: round2(latencyScore),
    speed_score: round2(speedScore),
    loss_score: round2(lossScore),
    p: round2(p),
    probe_ceiling:
      speedRule.ceilingMbps !== null
      && measurement.median_download_mbps >= speedRule.ceilingMbps,
  };
}

export function aggregatePerformanceRegions(
  regions: readonly PerformanceRegionScore[],
): PerformanceAggregate {
  if (regions.length === 0) {
    throw new Error('at least one performance region is required');
  }

  const versions = [...new Set(regions.map((region) => region.scoring_rule_version))].sort();
  return {
    median_latency_ms: median(regions.map((region) => region.median_latency_ms)),
    median_download_mbps: median(regions.map((region) => region.median_download_mbps)),
    packet_loss_percent: median(regions.map((region) => region.packet_loss_percent)),
    latency_score: average(regions.map((region) => region.latency_score)),
    speed_score: average(regions.map((region) => region.speed_score)),
    loss_score: average(regions.map((region) => region.loss_score)),
    p: average(regions.map((region) => region.p)),
    included_probe_ids: regions.map((region) => region.probe_id).sort(),
    rule_summary: versions.join('+'),
  };
}

function assertFiniteMeasurement(measurement: PerformanceRegionMeasurement): void {
  for (const [field, value] of Object.entries({
    median_latency_ms: measurement.median_latency_ms,
    median_download_mbps: measurement.median_download_mbps,
    packet_loss_percent: measurement.packet_loss_percent,
  })) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`${field} must be a non-negative finite number`);
    }
  }
}

function average(values: readonly number[]): number {
  return round2(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return round2((sorted[middle - 1] + sorted[middle]) / 2);
  }
  return round2(sorted[middle]);
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
