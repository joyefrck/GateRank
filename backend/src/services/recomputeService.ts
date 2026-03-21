import { RANKING_TYPES } from '../config/scoring';
import type { Airport, DailyMetrics, ScoreBreakdown } from '../types/domain';
import { computeScore } from './scoringEngine';
import { buildRankings } from './rankingService';

export interface RecomputeDependencies {
  airportRepository: { listAll(): Promise<Airport[]> };
  metricsRepository: { getByDate(date: string): Promise<DailyMetrics[]> };
  scoreRepository: {
    getLatestHistoricalScore(airportId: number, beforeDate: string): Promise<number | null>;
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
    const scoredRows: Array<{ airport: Airport; metrics: DailyMetrics; score: ScoreBreakdown }> = [];

    for (const airport of airports) {
      const m = metricsMap.get(airport.id);
      if (!m) {
        continue;
      }

      const historicalAvg = await this.deps.scoreRepository.getLatestHistoricalScore(airport.id, date);
      const historical = historicalAvg === null ? 0 : historicalAvg;
      const score = computeScore(airport, m, historical === 0 ? 0 : historical);

      const normalizedHistorical = historical === 0 ? score.score : historical;
      const finalScore = score.recent_score * 0.7 + normalizedHistorical * 0.3;
      score.historical_score = Number(normalizedHistorical.toFixed(2));
      score.final_score = Number(finalScore.toFixed(2));

      await this.deps.scoreRepository.upsertDaily(airport.id, date, score);
      scoredRows.push({ airport, metrics: m, score });
    }

    const rankings = buildRankings(date, scoredRows);
    for (const rankingType of RANKING_TYPES) {
      await this.deps.rankingRepository.replaceForDate(date, rankingType, rankings[rankingType]);
    }

    return { recomputed: scoredRows.length };
  }
}
