import type { RankingWriter } from '../repositories/rankingRepository';
import { SCORE_COMPONENT_KEYS } from '../../../shared/gateRankScore';
import { storeComponentCalculation } from './scoreComponents';
import { RANKING_TYPES } from '../config/scoring';
import type { Airport, AirportScoreDaily, DailyMetrics, NetworkCoverageRun, ScoreBreakdown } from '../types/domain';
import { computeFinalEngineScore, computeScore, computeWeightedScore } from './scoringEngine';
import { buildRankings } from './rankingService';
import type { RankedAirportInput } from './rankingService';
import { computeMedian, generateAirportTags } from './taggingService';
import { SCORE_RULE_V1, SCORE_RULE_V2, type GateRankScoreRuleVersion } from './networkCoverageScoring';

export interface RecomputeDependencies {
  airportRepository: {
    listAll(): Promise<Airport[]>;
    getById(id: number): Promise<Airport | null>;
    setAutoTags(airportId: number, tags: string[]): Promise<void>;
  };
  metricsRepository: {
    getByDate(date: string): Promise<DailyMetrics[]>;
    getByAirportAndDate(airportId: number, date: string): Promise<DailyMetrics | null>;
  };
  scoreRepository: {
    getTimeSeriesBeforeDate(
      airportId: number,
      beforeDate: string,
    ): Promise<Array<{ date: string; score: number }>>;
    getTrend(airportId: number, startDate: string, endDate: string): Promise<AirportScoreDaily[]>;
    getByDate(date: string): Promise<AirportScoreDaily[]>;
    upsertDaily(airportId: number, date: string, score: ScoreBreakdown): Promise<void>;
    deleteDaily(airportId: number, date: string): Promise<void>;
  };
  rankingRepository: {
    withSnapshotLock?(date: string, work: (writer: RankingWriter) => Promise<void>): Promise<void>;
    replaceForDate(
      date: string,
      listType: (typeof RANKING_TYPES)[number],
      rows: Array<{ airport_id: number; rank: number; score: number; details: Record<string, unknown> }>,
    ): Promise<void>;
  };
  networkCoverageRunRepository?: {
    getSuccessfulByAirportIdsAndDate(airportIds: number[], date: string): Promise<Map<number, NetworkCoverageRun>>;
    getLatestSuccessfulByAirportAndDate(airportId: number, date: string): Promise<NetworkCoverageRun | null>;
  };
  scoreRuleService?: {
    resolveRuleVersion(date: string): Promise<GateRankScoreRuleVersion>;
  };
}

export class RecomputeService {
  constructor(private readonly deps: RecomputeDependencies) {}

  async recomputeForDate(date: string): Promise<{ recomputed: number }> {
    const [airports, metrics] = await Promise.all([
      this.deps.airportRepository.listAll(),
      this.deps.metricsRepository.getByDate(date),
    ]);

    const metricsMap = new Map(metrics.map((m) => [m.airport_id, m]));
    const ruleVersion = await this.resolveRuleVersion(date);
    const runnableAirportIds = airports.filter(isRunnableAirport).map((airport) => airport.id);
    const coverageMap = ruleVersion === SCORE_RULE_V2 && this.deps.networkCoverageRunRepository
      ? await this.deps.networkCoverageRunRepository.getSuccessfulByAirportIdsAndDate(runnableAirportIds, date)
      : new Map<number, NetworkCoverageRun>();
    const noMetricsAirportIds: number[] = [];
    const scoredRows: Array<{ airport: Airport; metrics: DailyMetrics; score: ScoreBreakdown }> = [];

    for (const airport of airports) {
      if (!isRunnableAirport(airport)) {
        continue;
      }
      const m = metricsMap.get(airport.id);
      if (!m) {
        noMetricsAirportIds.push(airport.id);
        continue;
      }
      if (isPerformancePending(m)) {
        await this.deps.scoreRepository.deleteDaily(airport.id, date);
        continue;
      }
      const coverage = coverageMap.get(airport.id) || null;
      if (ruleVersion === SCORE_RULE_V2 && !coverage) {
        await this.deps.scoreRepository.deleteDaily(airport.id, date);
        continue;
      }

      const timeSeries = await this.deps.scoreRepository.getTimeSeriesBeforeDate(airport.id, date);
      const historicalScore = computeWeightedScore(timeSeries, date);
      const score = computeScore(airport, m, historicalScore, {
        ruleVersion,
        networkCoverageScore: coverage?.score_n ?? null,
      });
      attachCoverageDetails(score, coverage);
      const finalScore = computeWeightedScore([...timeSeries, { date, score: score.score }], date);

      score.historical_score = historicalScore;
      score.final_score = finalScore;

      const scoreTrend = await this.deps.scoreRepository.getTrend(airport.id, airport.created_at, date);
      preserveManualOverrides(score, scoreTrend, date);
      const calculationTrend = [...scoreTrend.filter((row) => row.date !== date), { ...score, date }];
      const automatic = computeFinalEngineScore({
        sSeries: calculationTrend.map((row) => ({ date: row.date, score: row.s })),
        pSeries: calculationTrend.map((row) => ({ date: row.date, score: row.p })),
        rSeries: calculationTrend.map((row) => ({ date: row.date, score: row.r })),
        pricePer100gb: airport.plan_price_month,
        referenceDate: date,
        ruleVersion,
        networkCoverageScore: coverage?.score_n ?? null,
      });
      storeComponentCalculation(score, automatic);
      await this.deps.scoreRepository.upsertDaily(airport.id, date, score);
      scoredRows.push({ airport, metrics: m, score });
    }

    const priceMedian = computeMedian(scoredRows.map((row) => row.airport.plan_price_month));
    for (const row of scoredRows) {
      const tags = generateAirportTags({
        date,
        airport: row.airport,
        metrics: row.metrics,
        score: row.score,
        priceMedian,
      });
      await this.deps.airportRepository.setAutoTags(row.airport.id, tags);
    }
    for (const airportId of noMetricsAirportIds) {
      await this.deps.airportRepository.setAutoTags(airportId, ['不推荐']);
    }

    await this.rebuildRankingsForDate(date);

    return { recomputed: scoredRows.length };
  }

  async recomputeAirportForDate(date: string, airportId: number): Promise<{ recomputed: number }> {
    const [airport, metrics, allAirports, allMetrics] = await Promise.all([
      this.deps.airportRepository.getById(airportId),
      this.deps.metricsRepository.getByAirportAndDate(airportId, date),
      this.deps.airportRepository.listAll(),
      this.deps.metricsRepository.getByDate(date),
    ]);

    if (!airport) {
      throw new Error(`airport ${airportId} not found`);
    }

    if (!isRunnableAirport(airport)) {
      await this.rebuildRankingsForDate(date);
      return { recomputed: 0 };
    }

    if (!metrics) {
      await this.deps.airportRepository.setAutoTags(airportId, ['不推荐']);
      await this.rebuildRankingsForDate(date);
      return { recomputed: 0 };
    }
    if (isPerformancePending(metrics)) {
      await this.deps.scoreRepository.deleteDaily(airportId, date);
      await this.rebuildRankingsForDate(date);
      return { recomputed: 0 };
    }

    const score = await this.computeAirportScore(airport, metrics, date);
    const scoredAirportIds = new Set(allMetrics.map((row) => row.airport_id));
    const priceMedian = computeMedian(
      allAirports
        .filter((item) => isRunnableAirport(item) && scoredAirportIds.has(item.id))
        .map((item) => item.plan_price_month),
    );
    const tags = generateAirportTags({
      date,
      airport,
      metrics,
      score,
      priceMedian,
    });
    await this.deps.airportRepository.setAutoTags(airport.id, tags);
    await this.rebuildRankingsForDate(date);
    return { recomputed: 1 };
  }

  async rebuildRankingsForDate(date: string): Promise<void> {
    if (this.deps.rankingRepository.withSnapshotLock) {
      await this.deps.rankingRepository.withSnapshotLock(date, (writer) => this.writeRankingsForDate(date, writer));
    } else {
      await this.writeRankingsForDate(date, this.deps.rankingRepository);
    }
  }

  private async writeRankingsForDate(date: string, writer: RankingWriter): Promise<void> {
    const [airports, metrics, scores] = await Promise.all([
      this.deps.airportRepository.listAll(),
      this.deps.metricsRepository.getByDate(date),
      this.deps.scoreRepository.getByDate(date),
    ]);
    const metricsMap = new Map(metrics.map((item) => [item.airport_id, item]));
    const scoreMap = new Map(scores.map((item) => [item.airport_id, item]));
    const rows: RankedAirportInput[] = [];
    const ruleVersion = await this.resolveRuleVersion(date);
    for (const airport of airports) {
      if (!isRunnableAirport(airport)) {
        continue;
      }
      const metricsRow = metricsMap.get(airport.id);
      const scoreRow = scoreMap.get(airport.id);
      if (!metricsRow || !scoreRow) {
        continue;
      }
      if ((scoreRow.details.score_rule_version || SCORE_RULE_V1) !== ruleVersion) {
        continue;
      }
      rows.push({
        airport,
        metrics: metricsRow,
        score: scoreRow,
      });
    }

    const rankings = buildRankings(date, rows);
    for (const rankingType of RANKING_TYPES) {
      await writer.replaceForDate(date, rankingType, rankings[rankingType]);
    }
  }

  private async computeAirportScore(airport: Airport, metrics: DailyMetrics, date: string): Promise<ScoreBreakdown> {
    const ruleVersion = await this.resolveRuleVersion(date);
    const coverage = ruleVersion === SCORE_RULE_V2 && this.deps.networkCoverageRunRepository
      ? await this.deps.networkCoverageRunRepository.getLatestSuccessfulByAirportAndDate(airport.id, date)
      : null;
    if (ruleVersion === SCORE_RULE_V2 && !coverage) {
      await this.deps.scoreRepository.deleteDaily(airport.id, date);
      throw new MissingNetworkCoverageError(airport.id, date);
    }
    const timeSeries = await this.deps.scoreRepository.getTimeSeriesBeforeDate(airport.id, date);
    const historicalScore = computeWeightedScore(timeSeries, date);
    const score = computeScore(airport, metrics, historicalScore, {
      ruleVersion,
      networkCoverageScore: coverage?.score_n ?? null,
    });
    attachCoverageDetails(score, coverage);
    const finalScore = computeWeightedScore([...timeSeries, { date, score: score.score }], date);

    score.historical_score = historicalScore;
    score.final_score = finalScore;

    const scoreTrend = await this.deps.scoreRepository.getTrend(airport.id, airport.created_at, date);
    preserveManualOverrides(score, scoreTrend, date);
    const calculationTrend = [...scoreTrend.filter((row) => row.date !== date), { ...score, date }];
    const automatic = computeFinalEngineScore({
      sSeries: calculationTrend.map((row) => ({ date: row.date, score: row.s })),
      pSeries: calculationTrend.map((row) => ({ date: row.date, score: row.p })),
      rSeries: calculationTrend.map((row) => ({ date: row.date, score: row.r })),
      pricePer100gb: airport.plan_price_month,
      referenceDate: date,
      ruleVersion,
      networkCoverageScore: coverage?.score_n ?? null,
    });
    storeComponentCalculation(score, automatic);
    await this.deps.scoreRepository.upsertDaily(airport.id, date, score);
    return score;
  }

  private async resolveRuleVersion(date: string): Promise<GateRankScoreRuleVersion> {
    return this.deps.scoreRuleService?.resolveRuleVersion(date) ?? SCORE_RULE_V1;
  }
}

export class MissingNetworkCoverageError extends Error {
  constructor(airportId: number, date: string) {
    super(`network coverage is required for airport ${airportId} on ${date}`);
    this.name = 'MissingNetworkCoverageError';
  }
}

function attachCoverageDetails(score: ScoreBreakdown, coverage: NetworkCoverageRun | null): void {
  if (!coverage) return;
  score.details.network_coverage_run_id = coverage.id;
  score.details.network_coverage_rule_version = coverage.rule_version;
  score.details.detected_nodes_count = coverage.detected_nodes_count;
  score.details.healthy_nodes_count = coverage.healthy_nodes_count;
  score.details.unsupported_nodes_count = coverage.unsupported_nodes_count;
  score.details.unknown_healthy_nodes_count = coverage.unknown_healthy_nodes_count;
  score.details.healthy_node_rate = coverage.healthy_node_rate;
  score.details.core_regions_count = coverage.core_regions.length;
  score.details.extended_regions_count = coverage.extended_regions.length;
  score.details.max_region_share = coverage.max_region_share;
  score.details.network_node_count_score = coverage.node_count_score;
  score.details.network_region_score = coverage.region_score;
  score.details.network_health_rate_score = coverage.health_rate_score;
  score.details.network_balance_score = coverage.balance_score;
}

function preserveManualOverrides(score: ScoreBreakdown, scoreTrend: AirportScoreDaily[], date: string): void {
  const currentScore = scoreTrend.find((row) => row.date === date);
  for (const key of ['manual_total_score', ...SCORE_COMPONENT_KEYS.map((key) => `manual_score_${key}`)]) {
    const value = currentScore?.details[key];
    delete score.details[key];
    if (typeof value === 'number' && Number.isFinite(value)) score.details[key] = value;
  }
}

function isRunnableAirport(airport: Pick<Airport, 'status' | 'is_listed'>): boolean {
  return airport.status !== 'down' && airport.is_listed !== false;
}

function isPerformancePending(metrics: DailyMetrics): boolean {
  return Boolean(metrics.performance_pending_probe_ids?.length)
    && !metrics.performance_included_probe_ids?.length
    && !(typeof metrics.performance_score === 'number' && Number.isFinite(metrics.performance_score));
}
