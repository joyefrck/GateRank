import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { AirportScoreDaily, ScoreBreakdown } from '../types/domain';

interface ScoreRow extends RowDataPacket {
  airport_id: number;
  date: string;
  score_s: number;
  score_p: number;
  score_c: number;
  score_r: number;
  risk_penalty: number;
  score: number;
  recent_score: number;
  historical_score: number;
  final_score: number;
  details_json: string;
}

export class ScoreRepository {
  constructor(private readonly pool: Pool) {}

  async getLatestHistoricalScore(airportId: number, beforeDate: string): Promise<number | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT AVG(score) AS historical_score
         FROM airport_scores_daily
        WHERE airport_id = ? AND date < ?`,
      [airportId, beforeDate],
    );

    if (rows.length === 0 || rows[0].historical_score === null) {
      return null;
    }

    return Number(rows[0].historical_score);
  }

  async upsertDaily(airportId: number, date: string, score: ScoreBreakdown): Promise<void> {
    await this.pool.execute<ResultSetHeader>(
      `INSERT INTO airport_scores_daily (
        airport_id, date, score_s, score_p, score_c, score_r,
        risk_penalty, score, recent_score, historical_score, final_score, details_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        score_s = VALUES(score_s),
        score_p = VALUES(score_p),
        score_c = VALUES(score_c),
        score_r = VALUES(score_r),
        risk_penalty = VALUES(risk_penalty),
        score = VALUES(score),
        recent_score = VALUES(recent_score),
        historical_score = VALUES(historical_score),
        final_score = VALUES(final_score),
        details_json = VALUES(details_json)`,
      [
        airportId,
        date,
        score.s,
        score.p,
        score.c,
        score.r,
        score.risk_penalty,
        score.score,
        score.recent_score,
        score.historical_score,
        score.final_score,
        JSON.stringify(score.details),
      ],
    );
  }

  async getByAirportAndDate(airportId: number, date: string): Promise<AirportScoreDaily | null> {
    const [rows] = await this.pool.query<ScoreRow[]>(
      `SELECT airport_id, date, score_s, score_p, score_c, score_r,
              risk_penalty, score, recent_score, historical_score, final_score, details_json
         FROM airport_scores_daily
        WHERE airport_id = ? AND date = ?
        LIMIT 1`,
      [airportId, date],
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      airport_id: row.airport_id,
      date: row.date,
      s: Number(row.score_s),
      p: Number(row.score_p),
      c: Number(row.score_c),
      r: Number(row.score_r),
      risk_penalty: Number(row.risk_penalty),
      score: Number(row.score),
      recent_score: Number(row.recent_score),
      historical_score: Number(row.historical_score),
      final_score: Number(row.final_score),
      details: safeJsonObject(row.details_json),
    };
  }

  async getTrend(airportId: number, startDate: string, endDate: string): Promise<AirportScoreDaily[]> {
    const [rows] = await this.pool.query<ScoreRow[]>(
      `SELECT airport_id, date, score_s, score_p, score_c, score_r,
              risk_penalty, score, recent_score, historical_score, final_score, details_json
         FROM airport_scores_daily
        WHERE airport_id = ? AND date >= ? AND date <= ?
        ORDER BY date ASC`,
      [airportId, startDate, endDate],
    );

    return rows.map((row) => ({
      airport_id: row.airport_id,
      date: row.date,
      s: Number(row.score_s),
      p: Number(row.score_p),
      c: Number(row.score_c),
      r: Number(row.score_r),
      risk_penalty: Number(row.risk_penalty),
      score: Number(row.score),
      recent_score: Number(row.recent_score),
      historical_score: Number(row.historical_score),
      final_score: Number(row.final_score),
      details: safeJsonObject(row.details_json),
    }));
  }
}

function safeJsonObject(value: string): Record<string, number> {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed).map(([key, val]) => [key, Number(val)]),
    );
  } catch {
    return {};
  }
}
