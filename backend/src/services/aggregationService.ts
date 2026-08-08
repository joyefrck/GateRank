import type {
  AirportPerformanceProbeSettingsView,
  DailyMetrics,
  PerformanceAggregate,
  PerformanceProbeId,
  PerformanceReviewStatus,
  PerformanceRun,
  ProbeSample,
  StabilityTier,
} from '../types/domain';
import { dateDaysAgo } from '../utils/time';
import { computeLatencyStats, getStabilityTier, isStableDay } from '../utils/stability';
import { aggregatePerformanceRegions, scorePerformanceRegion } from './performanceRegionScoring';

interface AggregationDeps {
  airportRepository: {
    listAll(): Promise<Array<{ id: number; status?: string; is_listed?: boolean }>>;
  };
  probeSampleRepository: {
    getProbeSamplesInRange(airportId: number, startDate: string, endDate: string): Promise<ProbeSample[]>;
    getPacketLossSamplesByDate(
      airportId: number,
      date: string,
      probeScope?: ProbeSample['probe_scope'],
    ): Promise<number[]>;
  };
  metricsRepository: {
    getLatestByAirportBeforeDate(airportId: number, date: string): Promise<DailyMetrics | null>;
    upsertDaily(input: DailyMetrics): Promise<void>;
  };
  performanceRunRepository?: {
    getLatestByAirportAndDate(airportId: number, date: string): Promise<PerformanceRun | null>;
    listByAirportAndDate?(airportId: number, date: string): Promise<PerformanceRun[]>;
  };
  performanceProbeSettingRepository?: {
    getByAirport(airportId: number): Promise<AirportPerformanceProbeSettingsView>;
  };
}

export interface AirportAggregationResult {
  aggregated: number;
  pending_probe_ids: PerformanceProbeId[];
}

export class AggregationService {
  constructor(private readonly deps: AggregationDeps) {}

  async aggregateForDate(date: string): Promise<{ aggregated: number }> {
    const airports = await this.deps.airportRepository.listAll();
    let aggregated = 0;

    for (const airport of airports) {
      if (!isRunnableAirport(airport)) {
        continue;
      }
      const result = await this.aggregateAirport(airport.id, date);
      aggregated += result.aggregated;
    }

    return { aggregated };
  }

  async aggregateAirportForDate(airportId: number, date: string): Promise<AirportAggregationResult> {
    return this.aggregateAirport(airportId, date);
  }

  private async aggregateAirport(airportId: number, date: string): Promise<AirportAggregationResult> {
    const performanceSelection = await this.resolvePerformanceSelection(airportId, date);
    if (performanceSelection.pendingProbeIds.length > 0) {
      return { aggregated: 0, pending_probe_ids: performanceSelection.pendingProbeIds };
    }
    const rangeStart = dateDaysAgo(date, 29);
    const samples = await this.deps.probeSampleRepository.getProbeSamplesInRange(
      airportId,
      rangeStart,
      date,
    );
    if (samples.length === 0) {
      return { aggregated: 0, pending_probe_ids: [] };
    }

    const daySamples = samples.filter((s) => s.sampled_at.slice(0, 10) === date);
    const availByDay = buildAvailabilityMap(samples);
    const dayAvail = availByDay.get(date) || [];
    const stabilityLatencies = getLatestStabilityLatencyBatch(daySamples);
    const performanceLatencies = daySamples
      .filter(
        (s) =>
          s.sample_type === 'latency' &&
          s.probe_scope === 'performance' &&
          typeof s.latency_ms === 'number',
      )
      .map((s) => round2(Number(s.latency_ms)));
    const downloads = daySamples
      .filter(
        (s) =>
          s.sample_type === 'download' &&
          s.probe_scope === 'performance' &&
          typeof s.download_mbps === 'number',
      )
      .map((s) => round2(Number(s.download_mbps)));
    const uptimePercentToday = dayAvail.length ? round2(average(dayAvail) * 100) : 0;
    const latencyStats = computeLatencyStats(stabilityLatencies);

    const packetLossSamples = await this.deps.probeSampleRepository.getPacketLossSamplesByDate(
      airportId,
      date,
      'performance',
    );

    const base = await this.deps.metricsRepository.getLatestByAirportBeforeDate(airportId, date);
    const performanceRun = performanceSelection.legacyRun;
    const performanceRuns = performanceSelection.regionalRuns.length
      ? performanceSelection.regionalRuns
      : performanceRun ? [performanceRun] : [];
    const performanceRunDownloads = performanceRuns.flatMap((run) => run.tested_nodes)
      .map((node) => node.download_mbps)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
      .map((value) => round2(value));
    const effectiveDownloads = performanceRunDownloads.length ? performanceRunDownloads : downloads;
    const regionalAggregate = performanceSelection.aggregate;
    const medianLatency = regionalAggregate?.median_latency_ms ?? performanceRun?.median_latency_ms ?? (performanceLatencies.length
      ? median(performanceLatencies)
      : base?.median_latency_ms ?? 999);
    const medianDownload = regionalAggregate?.median_download_mbps ?? performanceRun?.median_download_mbps ?? (effectiveDownloads.length
      ? median(effectiveDownloads)
      : base?.median_download_mbps ?? 0);
    const packetLoss = regionalAggregate?.packet_loss_percent ?? performanceRun?.packet_loss_percent ?? (packetLossSamples.length
      ? median(packetLossSamples)
      : base?.packet_loss_percent ?? 100);
    const packetLossMeasurement = regionalAggregate
      ? 'multi_region_equal_weight_v1'
      : performanceRun
      ? typeof performanceRun.diagnostics.packet_loss_measurement === 'string'
        ? performanceRun.diagnostics.packet_loss_measurement
        : null
      : base?.packet_loss_measurement ?? null;
    const hasCurrentDayRiskSnapshot = base?.date === date;
    const domainOk = hasCurrentDayRiskSnapshot
      ? base.domain_ok
      : dayAvail.length
        ? average(dayAvail) >= 0.95
        : base?.domain_ok ?? false;

    const uptimePercent30d = calcUptimePercent(availByDay);
    const latenciesByDay = buildLatencyMap(samples, 'stability');
    const stabilityTier = getStabilityTier(uptimePercentToday, stabilityLatencies);
    const stableDaysStreak = calcStreakByTier(availByDay, latenciesByDay, date, ['stable']);
    const healthyDaysStreak = calcStreakByTier(
      availByDay,
      latenciesByDay,
      date,
      ['stable', 'minor_fluctuation'],
    );
    const stableDay = stabilityTier === 'stable';

    await this.deps.metricsRepository.upsertDaily({
      airport_id: airportId,
      date,
      uptime_percent_30d: uptimePercent30d,
      uptime_percent_today: uptimePercentToday,
      latency_samples_ms: stabilityLatencies,
      latency_mean_ms: latencyStats.meanMs,
      latency_std_ms: latencyStats.stdMs,
      latency_cv: latencyStats.cv,
      download_samples_mbps: effectiveDownloads,
      median_latency_ms: medianLatency,
      median_download_mbps: medianDownload,
      packet_loss_percent: packetLoss,
      packet_loss_measurement: packetLossMeasurement,
      performance_latency_score: regionalAggregate?.latency_score ?? null,
      performance_speed_score: regionalAggregate?.speed_score ?? null,
      performance_loss_score: regionalAggregate?.loss_score ?? null,
      performance_score: regionalAggregate?.p ?? null,
      performance_rule_summary: regionalAggregate?.rule_summary ?? (performanceRun ? 'legacy_v1' : null),
      performance_included_probe_ids: regionalAggregate?.included_probe_ids
        ?? (performanceRun ? ['legacy-control'] : []),
      performance_review_status: performanceSelection.reviewStatus,
      performance_pending_probe_ids: [],
      available_nodes_count: aggregateNullableCount(performanceRuns, 'available_nodes_count')
        ?? base?.available_nodes_count ?? null,
      unavailable_nodes_count: aggregateNullableCount(performanceRuns, 'unavailable_nodes_count')
        ?? base?.unavailable_nodes_count ?? null,
      node_availability_percent:
        medianNullable(performanceRuns.map((run) => run.node_availability_percent))
        ?? base?.node_availability_percent ?? null,
      node_unavailability_percent:
        medianNullable(performanceRuns.map((run) => run.node_unavailability_percent))
        ?? base?.node_unavailability_percent ?? null,
      stable_days_streak: stableDaysStreak,
      healthy_days_streak: healthyDaysStreak,
      is_stable_day: stableDay,
      stability_tier: stabilityTier,
      domain_ok: domainOk,
      ssl_days_left: base?.ssl_days_left ?? null,
      recent_complaints_count: base?.recent_complaints_count ?? 0,
      history_incidents: base?.history_incidents ?? 0,
    });
    return { aggregated: 1, pending_probe_ids: [] };
  }

  private async resolvePerformanceSelection(
    airportId: number,
    date: string,
  ): Promise<{
    aggregate: PerformanceAggregate | null;
    legacyRun: PerformanceRun | null;
    regionalRuns: PerformanceRun[];
    pendingProbeIds: PerformanceProbeId[];
    reviewStatus: PerformanceReviewStatus | null;
  }> {
    const runRepository = this.deps.performanceRunRepository;
    const settingRepository = this.deps.performanceProbeSettingRepository;
    if (!runRepository) return emptyPerformanceSelection();
    if (!settingRepository || !runRepository.listByAirportAndDate) {
      return {
        ...emptyPerformanceSelection(),
        legacyRun: await runRepository.getLatestByAirportAndDate(airportId, date),
      };
    }

    const [settings, runs] = await Promise.all([
      settingRepository.getByAirport(airportId),
      runRepository.listByAirportAndDate(airportId, date),
    ]);
    const requiredProbeIds = settings.settings
      .filter((setting) => setting.test_enabled && setting.include_in_result)
      .map((setting) => setting.probe_id)
      .sort();
    const selectedRuns = new Map<PerformanceProbeId, PerformanceRun>();
    const pendingProbeIds: PerformanceProbeId[] = [];
    for (const probeId of requiredProbeIds) {
      const run = runs.find((candidate) => isValidOfficialRun(candidate, probeId, settings.config_version));
      if (run) selectedRuns.set(probeId, run);
      else pendingProbeIds.push(probeId);
    }
    if (pendingProbeIds.length > 0) {
      return { ...emptyPerformanceSelection(), pendingProbeIds };
    }

    const officialRuns = requiredProbeIds.map((probeId) => selectedRuns.get(probeId)!);
    if (officialRuns.length === 1 && officialRuns[0].probe_id === 'legacy-control') {
      return {
        ...emptyPerformanceSelection(),
        legacyRun: officialRuns[0],
        reviewStatus: officialRuns[0].review_status ?? 'normal',
      };
    }
    const scored = officialRuns.map((run) => scorePerformanceRegion({
      probe_id: run.probe_id || 'legacy-control',
      scoring_rule_version: run.scoring_rule_version || 'legacy_v1',
      median_latency_ms: Number(run.median_latency_ms),
      median_download_mbps: Number(run.median_download_mbps),
      packet_loss_percent: Number(run.packet_loss_percent),
    }));
    return {
      aggregate: aggregatePerformanceRegions(scored),
      legacyRun: null,
      regionalRuns: officialRuns,
      pendingProbeIds: [],
      reviewStatus: aggregateReviewStatus(officialRuns),
    };
  }
}

function emptyPerformanceSelection() {
  return {
    aggregate: null,
    legacyRun: null,
    regionalRuns: [] as PerformanceRun[],
    pendingProbeIds: [] as PerformanceProbeId[],
    reviewStatus: null as PerformanceReviewStatus | null,
  };
}

function isValidOfficialRun(
  run: PerformanceRun,
  probeId: PerformanceProbeId,
  configVersion: number,
): boolean {
  if (run.probe_id !== probeId || run.run_mode !== 'official' || run.status !== 'success') return false;
  if (probeId !== 'legacy-control' && (run.config_version !== configVersion || run.calibration_status === 'failed')) {
    return false;
  }
  return [run.median_latency_ms, run.median_download_mbps, run.packet_loss_percent]
    .every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

function aggregateReviewStatus(runs: PerformanceRun[]): PerformanceReviewStatus | null {
  if (runs.some((run) => run.review_status === 'suspicious')) return 'suspicious';
  if (runs.some((run) => run.review_status === 'needs_review')) return 'needs_review';
  return runs.length ? 'normal' : null;
}

function aggregateNullableCount(
  runs: PerformanceRun[],
  key: 'available_nodes_count' | 'unavailable_nodes_count',
): number | null {
  const values = runs.map((run) => run[key]).filter((value): value is number => typeof value === 'number');
  return values.length ? Math.round(average(values)) : null;
}

function medianNullable(values: Array<number | null>): number | null {
  const finite = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return finite.length ? median(finite) : null;
}

function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return round2((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return round2(sorted[mid]);
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function calcUptimePercent(availByDay: Map<string, number[]>): number {
  const merged: number[] = [];
  for (const values of availByDay.values()) {
    merged.push(...values);
  }
  if (merged.length === 0) {
    return 0;
  }
  return round2(average(merged) * 100);
}

function buildAvailabilityMap(samples: ProbeSample[]): Map<string, number[]> {
  const samplesByDay = new Map<string, ProbeSample[]>();
  for (const sample of samples) {
    if (
      sample.sample_type !== 'availability' ||
      sample.probe_scope !== 'stability' ||
      sample.availability === null
    ) {
      continue;
    }
    const key = sample.sampled_at.slice(0, 10);
    const list = samplesByDay.get(key) || [];
    list.push(sample);
    samplesByDay.set(key, list);
  }

  const availByDay = new Map<string, number[]>();
  for (const [day, daySamples] of samplesByDay.entries()) {
    availByDay.set(day, getEffectiveAvailabilityBatch(daySamples));
  }
  return availByDay;
}

function getEffectiveAvailabilityBatch(samples: ProbeSample[]): number[] {
  const availabilitySamples = samples
    .filter(
      (sample) =>
        sample.sample_type === 'availability' &&
        sample.probe_scope === 'stability' &&
        sample.availability !== null,
    )
    .slice()
    .sort((left, right) => sampleTimeMs(left) - sampleTimeMs(right));
  let latestRecheckIndex = -1;
  for (let index = 0; index < availabilitySamples.length; index += 1) {
    if (isAvailabilityRecheckSource(availabilitySamples[index].source)) {
      latestRecheckIndex = index;
    }
  }
  const effectiveSamples = latestRecheckIndex >= 0
    ? availabilitySamples.slice(latestRecheckIndex)
    : availabilitySamples;
  return effectiveSamples.map((sample) => (sample.availability ? 1 : 0));
}

function isAvailabilityRecheckSource(source: string): boolean {
  return source === 'manual-stability' || source === 'scheduler-stability-resample';
}

function buildLatencyMap(samples: ProbeSample[], probeScope: ProbeSample['probe_scope']): Map<string, number[]> {
  const samplesByDay = new Map<string, ProbeSample[]>();
  for (const sample of samples) {
    if (sample.probe_scope !== probeScope) {
      continue;
    }
    const key = sample.sampled_at.slice(0, 10);
    const list = samplesByDay.get(key) || [];
    list.push(sample);
    samplesByDay.set(key, list);
  }

  const latenciesByDay = new Map<string, number[]>();
  for (const [day, daySamples] of samplesByDay.entries()) {
    latenciesByDay.set(day, getLatestLatencyBatch(daySamples, probeScope));
  }
  return latenciesByDay;
}

function getLatestStabilityLatencyBatch(samples: ProbeSample[]): number[] {
  return getLatestLatencyBatch(samples, 'stability');
}

function getLatestLatencyBatch(samples: ProbeSample[], probeScope: ProbeSample['probe_scope']): number[] {
  const scopedSamples = samples
    .filter((sample) => sample.probe_scope === probeScope)
    .slice()
    .sort((left, right) => sampleTimeMs(left) - sampleTimeMs(right));
  const latestRunMarker = latestAvailabilitySample(scopedSamples);
  const latencySamples = scopedSamples.filter(
    (sample) => sample.sample_type === 'latency' && typeof sample.latency_ms === 'number',
  );

  if (!latestRunMarker) {
    return latencySamples.map((sample) => round2(Number(sample.latency_ms)));
  }

  const latestRunTime = sampleTimeMs(latestRunMarker);
  const samplesAfterMarker = latencySamples.filter((sample) => sampleTimeMs(sample) >= latestRunTime);
  if (samplesAfterMarker.length > 0 || isStabilityScriptSource(latestRunMarker.source)) {
    return samplesAfterMarker.map((sample) => round2(Number(sample.latency_ms)));
  }

  const previousRunMarkerTime = latestPreviousAvailabilitySampleTime(scopedSamples, latestRunTime);
  return latencySamples
    .filter((sample) => {
      const sampledAt = sampleTimeMs(sample);
      return sampledAt <= latestRunTime && (previousRunMarkerTime === null || sampledAt > previousRunMarkerTime);
    })
    .map((sample) => round2(Number(sample.latency_ms)));
}

function latestAvailabilitySample(samples: ProbeSample[]): ProbeSample | null {
  let latestSample: ProbeSample | null = null;
  for (const sample of samples) {
    if (sample.sample_type !== 'availability' || sample.availability === null) {
      continue;
    }
    const sampledAt = sampleTimeMs(sample);
    if (!latestSample || sampledAt > sampleTimeMs(latestSample)) {
      latestSample = sample;
    }
  }
  return latestSample;
}

function latestPreviousAvailabilitySampleTime(samples: ProbeSample[], beforeTimeMs: number): number | null {
  let latestTime: number | null = null;
  for (const sample of samples) {
    if (sample.sample_type !== 'availability' || sample.availability === null) {
      continue;
    }
    const sampledAt = sampleTimeMs(sample);
    if (sampledAt >= beforeTimeMs) {
      continue;
    }
    if (latestTime === null || sampledAt > latestTime) {
      latestTime = sampledAt;
    }
  }
  return latestTime;
}

function isStabilityScriptSource(source: string): boolean {
  return source === 'manual-stability'
    || source === 'cron-stability'
    || source === 'scheduler-stability'
    || source === 'scheduler-stability-resample';
}

function sampleTimeMs(sample: ProbeSample): number {
  const parsed = Date.parse(sample.sampled_at);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calcStreakByTier(
  availByDay: Map<string, number[]>,
  latenciesByDay: Map<string, number[]>,
  date: string,
  acceptedTiers: StabilityTier[],
): number {
  let streak = 0;
  for (let i = 0; i < 365; i += 1) {
    const day = dateDaysAgo(date, i);
    const availabilities = availByDay.get(day);
    const latencies = latenciesByDay.get(day) || [];
    if (!availabilities || availabilities.length === 0) {
      break;
    }
    const uptimePercent = average(availabilities) * 100;
    const stabilityTier = getStabilityTier(uptimePercent, latencies);
    if (acceptedTiers.includes(stabilityTier)) {
      streak += 1;
      continue;
    }
    break;
  }
  return streak;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function isRunnableAirport(airport: { status?: string; is_listed?: boolean }): boolean {
  return airport.status !== 'down' && airport.is_listed !== false;
}
