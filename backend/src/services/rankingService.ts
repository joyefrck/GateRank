import { LIST_LIMIT, NEW_AIRPORT_DAYS } from '../config/scoring';
import { dateDaysAgo } from '../utils/time';
import type { Airport, DailyMetrics, RankingType, ScoreBreakdown } from '../types/domain';

export interface RankedAirportInput {
  airport: Airport;
  metrics: DailyMetrics;
  score: ScoreBreakdown;
}

const TODAY_PICK_RANKING_LIMIT = 3;

export function buildRankings(
  date: string,
  rows: RankedAirportInput[],
): Record<RankingType, Array<{ airport_id: number; rank: number; score: number; details: Record<string, unknown> }>> {
  const activeRows = rows.filter((row) => row.airport.status !== 'down');

  const today = buildTodayPickRows(date, activeRows, TODAY_PICK_RANKING_LIMIT);

  const stable = activeRows
    .slice()
    .sort((a, b) => b.score.s - a.score.s)
    .slice(0, LIST_LIMIT);

  const value = activeRows
    .slice()
    .sort((a, b) => b.score.c - a.score.c)
    .slice(0, LIST_LIMIT);

  const newSince = dateDaysAgo(date, NEW_AIRPORT_DAYS);
  const newest = activeRows
    .filter((row) => row.airport.created_at >= newSince)
    .sort((a, b) => rankingScoreOf(b) - rankingScoreOf(a))
    .slice(0, LIST_LIMIT);

  const risk = activeRows
    .filter((row) => row.airport.status === 'risk')
    .slice()
    .sort((a, b) => b.score.risk_penalty - a.score.risk_penalty)
    .slice(0, LIST_LIMIT);

  return {
    today: toRows(today, 'ranking_score'),
    stable: toRows(stable, 's'),
    value: toRows(value, 'c'),
    new: toRows(newest, 'ranking_score'),
    risk: toRows(risk, 'risk_penalty'),
  };
}

export function buildTodayPickRows(
  date: string,
  rows: RankedAirportInput[],
  limit: number,
): RankedAirportInput[] {
  void date;
  const safeLimit = Math.max(0, Math.floor(limit));
  if (safeLimit === 0) {
    return [];
  }

  const eligibleRows = rows
    .filter(isTodayPickEligible)
    .slice()
    .sort(compareByTodayPickScore);

  return eligibleRows.slice(0, safeLimit);
}

export function compareByTodayPickScore(left: RankedAirportInput, right: RankedAirportInput): number {
  return (
    rankingScoreOf(right) - rankingScoreOf(left) ||
    Number(right.metrics.healthy_days_streak ?? right.metrics.stable_days_streak ?? 0) -
      Number(left.metrics.healthy_days_streak ?? left.metrics.stable_days_streak ?? 0) ||
    right.score.s - left.score.s ||
    left.airport.id - right.airport.id
  );
}

export function isTodayPickEligible(row: RankedAirportInput): boolean {
  return (
    row.airport.status !== 'down' &&
    row.airport.is_listed &&
    !row.airport.tags.includes('风险观察')
  );
}

function toRows(
  rows: RankedAirportInput[],
  scoreKey: 'ranking_score' | 's' | 'c' | 'risk_penalty',
): Array<{ airport_id: number; rank: number; score: number; details: Record<string, unknown> }> {
  return rows.map((row, index) => ({
    airport_id: row.airport.id,
    rank: index + 1,
    score:
      scoreKey === 'ranking_score'
        ? rankingScoreOf(row)
        : row.score[scoreKey],
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
      total_score: rankingScoreOf(row),
      final_score: row.score.final_score,
      risk_penalty: row.score.risk_penalty,
    },
  }));
}

function rankingScoreOf(row: RankedAirportInput): number {
  const score = Number(row.score.details.total_score ?? row.score.final_score);
  return Number.isFinite(score) ? score : row.score.final_score;
}
