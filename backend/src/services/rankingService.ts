import { LIST_LIMIT, NEW_AIRPORT_DAYS, TODAY_MAX_RISK_PENALTY } from '../config/scoring';
import { dateDaysAgo } from '../utils/time';
import type { Airport, DailyMetrics, RankingType, ScoreBreakdown } from '../types/domain';

export interface RankedAirportInput {
  airport: Airport;
  metrics: DailyMetrics;
  score: ScoreBreakdown;
}

export function buildRankings(
  date: string,
  rows: RankedAirportInput[],
): Record<RankingType, Array<{ airport_id: number; rank: number; score: number; details: Record<string, unknown> }>> {
  const today = rows
    .filter((row) => row.airport.status !== 'down')
    .filter((row) => row.score.risk_penalty <= TODAY_MAX_RISK_PENALTY)
    .sort((a, b) => b.score.final_score - a.score.final_score)
    .slice(0, LIST_LIMIT);

  const stable = rows
    .slice()
    .sort((a, b) => b.score.s - a.score.s)
    .slice(0, LIST_LIMIT);

  const value = rows
    .slice()
    .sort((a, b) => b.score.c - a.score.c)
    .slice(0, LIST_LIMIT);

  const newSince = dateDaysAgo(date, NEW_AIRPORT_DAYS);
  const newest = rows
    .filter((row) => row.airport.created_at >= newSince)
    .sort((a, b) => b.score.final_score - a.score.final_score)
    .slice(0, LIST_LIMIT);

  const risk = rows
    .slice()
    .sort((a, b) => b.score.risk_penalty - a.score.risk_penalty)
    .slice(0, LIST_LIMIT);

  return {
    today: toRows(today, 'final_score'),
    stable: toRows(stable, 's'),
    value: toRows(value, 'c'),
    new: toRows(newest, 'final_score'),
    risk: toRows(risk, 'risk_penalty'),
  };
}

function toRows(
  rows: RankedAirportInput[],
  scoreKey: 'final_score' | 's' | 'c' | 'risk_penalty',
): Array<{ airport_id: number; rank: number; score: number; details: Record<string, unknown> }> {
  return rows.map((row, index) => ({
    airport_id: row.airport.id,
    rank: index + 1,
    score: row.score[scoreKey],
    details: {
      airport_name: row.airport.name,
      status: row.airport.status,
      uptime_percent_30d: row.metrics.uptime_percent_30d,
      median_latency_ms: row.metrics.median_latency_ms,
      median_download_mbps: row.metrics.median_download_mbps,
      packet_loss_percent: row.metrics.packet_loss_percent,
      s: row.score.s,
      p: row.score.p,
      c: row.score.c,
      r: row.score.r,
      final_score: row.score.final_score,
      risk_penalty: row.score.risk_penalty,
    },
  }));
}
