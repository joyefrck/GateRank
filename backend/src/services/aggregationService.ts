import type { DailyMetrics, ProbeSample, StabilityTier } from '../types/domain';
import { dateDaysAgo } from '../utils/time';
import { computeLatencyStats, getStabilityTier, isStableDay } from '../utils/stability';

interface AggregationDeps {
  airportRepository: {
    listAll(): Promise<Array<{ id: number }>>;
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
}

export class AggregationService {
  constructor(private readonly deps: AggregationDeps) {}

  async aggregateForDate(date: string): Promise<{ aggregated: number }> {
    const airports = await this.deps.airportRepository.listAll();
    let aggregated = 0;

    for (const airport of airports) {
      aggregated += await this.aggregateAirport(airport.id, date);
    }

    return { aggregated };
  }

  async aggregateAirportForDate(airportId: number, date: string): Promise<{ aggregated: number }> {
    const aggregated = await this.aggregateAirport(airportId, date);
    return { aggregated };
  }

  private async aggregateAirport(airportId: number, date: string): Promise<number> {
    const rangeStart = dateDaysAgo(date, 29);
    const samples = await this.deps.probeSampleRepository.getProbeSamplesInRange(
      airportId,
      rangeStart,
      date,
    );
    if (samples.length === 0) {
      return 0;
    }

    const daySamples = samples.filter((s) => s.sampled_at.slice(0, 10) === date);
    const stabilityLatencies = daySamples
      .filter(
        (s) =>
          s.sample_type === 'latency' &&
          s.probe_scope === 'stability' &&
          typeof s.latency_ms === 'number',
      )
      .map((s) => round2(Number(s.latency_ms)));
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
    const dayAvail = daySamples
      .filter(
        (s) =>
          s.sample_type === 'availability' &&
          s.probe_scope === 'stability' &&
          s.availability !== null,
      )
      .map((s) => (s.availability ? 1 : 0));
    const uptimePercentToday = dayAvail.length ? round2(average(dayAvail) * 100) : 0;
    const latencyStats = computeLatencyStats(stabilityLatencies);

    const packetLossSamples = await this.deps.probeSampleRepository.getPacketLossSamplesByDate(
      airportId,
      date,
      'performance',
    );

    const base = await this.deps.metricsRepository.getLatestByAirportBeforeDate(airportId, date);
    const medianLatency = performanceLatencies.length
      ? median(performanceLatencies)
      : base?.median_latency_ms ?? 999;
    const medianDownload = downloads.length ? median(downloads) : base?.median_download_mbps ?? 0;
    const packetLoss = packetLossSamples.length
      ? median(packetLossSamples)
      : base?.packet_loss_percent ?? 100;
    const hasCurrentDayRiskSnapshot = base?.date === date;
    const domainOk = hasCurrentDayRiskSnapshot
      ? base.domain_ok
      : dayAvail.length
        ? average(dayAvail) >= 0.95
        : base?.domain_ok ?? false;

    const availByDay = new Map<string, number[]>();
    for (const sample of samples) {
      if (sample.sample_type !== 'availability' || sample.availability === null) {
        continue;
      }
      const key = sample.sampled_at.slice(0, 10);
      const list = availByDay.get(key) || [];
      list.push(sample.availability ? 1 : 0);
      availByDay.set(key, list);
    }
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
      download_samples_mbps: downloads,
      median_latency_ms: medianLatency,
      median_download_mbps: medianDownload,
      packet_loss_percent: packetLoss,
      stable_days_streak: stableDaysStreak,
      healthy_days_streak: healthyDaysStreak,
      is_stable_day: stableDay,
      stability_tier: stabilityTier,
      domain_ok: domainOk,
      ssl_days_left: base?.ssl_days_left ?? null,
      recent_complaints_count: base?.recent_complaints_count ?? 0,
      history_incidents: base?.history_incidents ?? 0,
    });
    return 1;
  }
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

function buildLatencyMap(samples: ProbeSample[], probeScope: ProbeSample['probe_scope']): Map<string, number[]> {
  const latenciesByDay = new Map<string, number[]>();
  for (const sample of samples) {
    if (
      sample.sample_type !== 'latency' ||
      sample.probe_scope !== probeScope ||
      typeof sample.latency_ms !== 'number'
    ) {
      continue;
    }
    const key = sample.sampled_at.slice(0, 10);
    const list = latenciesByDay.get(key) || [];
    list.push(round2(Number(sample.latency_ms)));
    latenciesByDay.set(key, list);
  }
  return latenciesByDay;
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
