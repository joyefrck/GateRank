import { RANKING_TYPES } from '../config/scoring';
import type { Airport, AirportScoreDaily, DailyMetrics, ScoreBreakdown } from '../types/domain';
import { computeFinalEngineScore, computeScore, computeWeightedScore } from './scoringEngine';
import { buildRankings } from './rankingService';
import type { RankedAirportInput } from './rankingService';
import { computeMedian, generateAirportTags } from './taggingService';

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
  };
  rankingRepository: {
    replaceForDate(
      date: string,
      listType: (typeof RANKING_TYPES)[number],
      rows: Array<{ airport_id: number; rank: number; score: number; details: Record<string, unknown> }>,
    ): Promise<void>;
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
    const noMetricsAirportIds: number[] = [];
    const scoredRows: Array<{ airport: Airport; metrics: DailyMetrics; score: ScoreBreakdown }> = [];

    for (const airport of airports) {
      if (airport.status === 'down') {
        continue;
      }
      const m = metricsMap.get(airport.id);
      if (!m) {
        noMetricsAirportIds.push(airport.id);
        continue;
      }

      const timeSeries = await this.deps.scoreRepository.getTimeSeriesBeforeDate(airport.id, date);
      const historicalScore = computeWeightedScore(timeSeries, date);
      const score = computeScore(airport, m, historicalScore);
      const finalScore = computeWeightedScore([...timeSeries, { date, score: score.score }], date);

      score.historical_score = historicalScore;
      score.final_score = finalScore;

      await this.deps.scoreRepository.upsertDaily(airport.id, date, score);
      const scoreTrend = await this.deps.scoreRepository.getTrend(airport.id, airport.created_at, date);
      const totalScore = computeFinalEngineScore({
        sSeries: scoreTrend.map((row) => ({ date: row.date, score: row.s })),
        pSeries: scoreTrend.map((row) => ({ date: row.date, score: row.p })),
        rSeries: scoreTrend.map((row) => ({ date: row.date, score: row.r })),
        pricePer100gb: airport.plan_price_month,
        referenceDate: date,
      }).final_score;
      score.details.total_score = totalScore;
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

    const rankings = buildRankings(date, scoredRows);
    for (const rankingType of RANKING_TYPES) {
      await this.deps.rankingRepository.replaceForDate(date, rankingType, rankings[rankingType]);
    }

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

    if (airport.status === 'down') {
      await this.rebuildRankingsForDate(date);
      return { recomputed: 0 };
    }

    if (!metrics) {
      await this.deps.airportRepository.setAutoTags(airportId, ['不推荐']);
      await this.rebuildRankingsForDate(date);
      return { recomputed: 0 };
    }

    const score = await this.computeAirportScore(airport, metrics, date);
    const scoredAirportIds = new Set(allMetrics.map((row) => row.airport_id));
    const priceMedian = computeMedian(
      allAirports
        .filter((item) => scoredAirportIds.has(item.id))
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
    const [airports, metrics, scores] = await Promise.all([
      this.deps.airportRepository.listAll(),
      this.deps.metricsRepository.getByDate(date),
      this.deps.scoreRepository.getByDate(date),
    ]);
    const metricsMap = new Map(metrics.map((item) => [item.airport_id, item]));
    const scoreMap = new Map(scores.map((item) => [item.airport_id, item]));
    const rows: RankedAirportInput[] = [];
    for (const airport of airports) {
      if (airport.status === 'down') {
        continue;
      }
      const metricsRow = metricsMap.get(airport.id);
      const scoreRow = scoreMap.get(airport.id);
      if (!metricsRow || !scoreRow) {
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
      await this.deps.rankingRepository.replaceForDate(date, rankingType, rankings[rankingType]);
    }
  }

  private async computeAirportScore(airport: Airport, metrics: DailyMetrics, date: string): Promise<ScoreBreakdown> {
    const timeSeries = await this.deps.scoreRepository.getTimeSeriesBeforeDate(airport.id, date);
    const historicalScore = computeWeightedScore(timeSeries, date);
    const score = computeScore(airport, metrics, historicalScore);
    const finalScore = computeWeightedScore([...timeSeries, { date, score: score.score }], date);

    score.historical_score = historicalScore;
    score.final_score = finalScore;

    await this.deps.scoreRepository.upsertDaily(airport.id, date, score);
    const scoreTrend = await this.deps.scoreRepository.getTrend(airport.id, airport.created_at, date);
    const totalScore = computeFinalEngineScore({
      sSeries: scoreTrend.map((row) => ({ date: row.date, score: row.s })),
      pSeries: scoreTrend.map((row) => ({ date: row.date, score: row.p })),
      rSeries: scoreTrend.map((row) => ({ date: row.date, score: row.r })),
      pricePer100gb: airport.plan_price_month,
      referenceDate: date,
    }).final_score;
    score.details.total_score = totalScore;
    await this.deps.scoreRepository.upsertDaily(airport.id, date, score);
    return score;
  }
}
