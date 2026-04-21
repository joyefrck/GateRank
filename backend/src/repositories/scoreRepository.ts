import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type {
  AirportScoreDaily,
  AirportStatus,
  FullRankingItem,
  RiskMonitorItem,
  ScoreBreakdown,
  ScoreDetailValue,
  TimeSeriesScorePoint,
} from '../types/domain';
import { buildRiskReasonSummary, deriveRiskReasonCodes } from '../utils/risk';
import { formatDateOnly } from '../utils/time';

interface ScoreRow extends RowDataPacket {
  airport_id: number;
  date: unknown;
  score_s: number;
  score_p: number;
  score_c: number;
  score_r: number;
  risk_penalty: number;
  score: number;
  recent_score: number;
  historical_score: number;
  final_score: number;
  details_json: unknown;
}

interface HistoricalScoreRow extends RowDataPacket {
  date: unknown;
  score: number;
}

interface LatestDateRow extends RowDataPacket {
  latest_date: unknown;
}

interface PublicFullRankingRow extends RowDataPacket {
  airport_id: number;
  name: string;
  website: string;
  status: AirportStatus;
  tags_json: unknown;
  founded_on: unknown;
  plan_price_month: number;
  has_trial: number;
  airport_intro: string | null;
  created_at: unknown;
  score_date: unknown;
  display_score: number | null;
}

interface PublicDisplayScoreRow extends RowDataPacket {
  airport_id: number;
  display_score: number | null;
}

interface PublicRiskMonitorRow extends RowDataPacket {
  airport_id: number;
  name: string;
  website: string;
  status: AirportStatus;
  tags_json: unknown;
  founded_on: unknown;
  plan_price_month: number;
  has_trial: number;
  airport_intro: string | null;
  created_at: unknown;
  score_date: unknown;
  display_score: number | null;
  risk_penalty: number | null;
  details_json: unknown;
  domain_ok: number | null;
  ssl_days_left: number | null;
  recent_complaints_count: number | null;
  history_incidents: number | null;
  score_r: number | null;
}

export class ScoreRepository {
  constructor(private readonly pool: Pool) {}

  async getLatestAvailableDate(onOrBefore: string): Promise<string | null> {
    const [rows] = await this.pool.query<LatestDateRow[]>(
      `SELECT MAX(date) AS latest_date
         FROM airport_scores_daily
        WHERE date <= ?`,
      [onOrBefore],
    );

    const latestDate = rows[0]?.latest_date;
    return latestDate ? formatDateOnly(latestDate) : null;
  }

  async getTimeSeriesBeforeDate(airportId: number, beforeDate: string): Promise<TimeSeriesScorePoint[]> {
    const [rows] = await this.pool.query<HistoricalScoreRow[]>(
      `SELECT date, score
         FROM airport_scores_daily
        WHERE airport_id = ? AND date < ?`,
      [airportId, beforeDate],
    );

    return rows.map((row) => ({
      date: formatDateOnly(row.date),
      score: Number(row.score),
    }));
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
      date: formatDateOnly(row.date),
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

  async getByDate(date: string): Promise<AirportScoreDaily[]> {
    const [rows] = await this.pool.query<ScoreRow[]>(
      `SELECT airport_id, date, score_s, score_p, score_c, score_r,
              risk_penalty, score, recent_score, historical_score, final_score, details_json
         FROM airport_scores_daily
        WHERE date = ?`,
      [date],
    );

    return rows.map((row) => ({
      airport_id: row.airport_id,
      date: formatDateOnly(row.date),
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
      date: formatDateOnly(row.date),
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

  async getPublicDisplayScoreByAirportAndDate(airportId: number, date: string): Promise<number | null> {
    const [rows] = await this.pool.query<PublicDisplayScoreRow[]>(
      `SELECT
         airport_id,
         COALESCE(
           CAST(JSON_UNQUOTE(JSON_EXTRACT(details_json, '$.total_score')) AS DECIMAL(10,2)),
           final_score
         ) AS display_score
       FROM airport_scores_daily
       WHERE airport_id = ? AND date = ?
       LIMIT 1`,
      [airportId, date],
    );

    const displayScore = rows[0]?.display_score;
    return displayScore === null || displayScore === undefined ? null : Number(displayScore);
  }

  async getPublicDisplayScoresByDate(
    airportIds: number[],
    date: string,
  ): Promise<Map<number, number>> {
    if (airportIds.length === 0) {
      return new Map();
    }

    const placeholders = airportIds.map(() => '?').join(', ');
    const [rows] = await this.pool.query<PublicDisplayScoreRow[]>(
      `SELECT
         airport_id,
         COALESCE(
           CAST(JSON_UNQUOTE(JSON_EXTRACT(details_json, '$.total_score')) AS DECIMAL(10,2)),
           final_score
         ) AS display_score
       FROM airport_scores_daily
       WHERE date = ?
         AND airport_id IN (${placeholders})`,
      [date, ...airportIds],
    );

    return new Map(
      rows
        .filter((row) => row.display_score !== null && row.display_score !== undefined)
        .map((row) => [Number(row.airport_id), Number(row.display_score)]),
    );
  }

  async getPublicFullRankingByDate(
    date: string,
    page: number,
    pageSize: number,
  ): Promise<{ total: number; items: FullRankingItem[] }> {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));
    const offset = (safePage - 1) * safePageSize;

    const [totalRows] = await this.pool.query<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) AS total
         FROM airports a
        WHERE a.is_listed = 1
          AND a.status IN ('normal', 'risk')`,
      [],
    );

    const [rows] = await this.pool.query<PublicFullRankingRow[]>(
      `SELECT
         a.id AS airport_id,
         a.name,
         a.website,
         a.status,
         a.tags_json,
         a.founded_on,
         a.plan_price_month,
         a.has_trial,
         a.airport_intro,
         a.created_at,
         s.date AS score_date,
         COALESCE(
           CAST(JSON_UNQUOTE(JSON_EXTRACT(s.details_json, '$.total_score')) AS DECIMAL(10,2)),
           s.final_score
         ) AS display_score
       FROM airports a
       LEFT JOIN airport_scores_daily s
         ON s.airport_id = a.id
        AND s.date = (
          SELECT MAX(s2.date)
            FROM airport_scores_daily s2
           WHERE s2.airport_id = a.id
             AND s2.date <= ?
        )
      WHERE a.is_listed = 1
        AND a.status IN ('normal', 'risk')
      ORDER BY
        CASE WHEN s.date IS NULL THEN 1 ELSE 0 END ASC,
        display_score DESC,
        a.created_at DESC,
        a.id ASC
      LIMIT ? OFFSET ?`,
      [date, safePageSize, offset],
    );

    const yesterdayDate = shiftDateByDays(date, -1);
    const yesterdayDisplayScores = await this.getPublicDisplayScoresByDate(
      rows.map((row) => Number(row.airport_id)),
      yesterdayDate,
    );

    return {
      total: Number(totalRows[0]?.total || 0),
      items: rows.map((row, index) => {
        const currentScore = row.display_score === null ? null : Number(row.display_score);
        const yesterdayScore = yesterdayDisplayScores.get(Number(row.airport_id));

        return {
          airport_id: row.airport_id,
          rank: offset + index + 1,
          name: row.name,
          website: row.website,
          status: row.status,
          tags: safeJsonArray(row.tags_json),
          founded_on: row.founded_on ? formatDateOnly(row.founded_on) : null,
          plan_price_month: Number(row.plan_price_month),
          has_trial: !!row.has_trial,
          airport_intro: row.airport_intro,
          created_at: formatDateOnly(row.created_at),
          score: currentScore,
          score_delta_vs_yesterday: {
            label: '对比昨天',
            value:
              currentScore === null || yesterdayScore === undefined
                ? null
                : round2(currentScore - yesterdayScore),
          },
          score_date: row.score_date ? formatDateOnly(row.score_date) : null,
          report_url: row.score_date ? `/reports/${row.airport_id}?date=${formatDateOnly(row.score_date)}` : null,
        };
      }),
    };
  }

  async getPublicRiskMonitorByDate(
    date: string,
    page: number,
    pageSize: number,
  ): Promise<{ total: number; items: RiskMonitorItem[] }> {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));
    const offset = (safePage - 1) * safePageSize;

    const [totalRows] = await this.pool.query<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) AS total
         FROM airports a
        WHERE a.is_listed = 1
          AND (
            a.status = 'down'
            OR JSON_SEARCH(a.tags_json, 'one', '风险观察') IS NOT NULL
          )`,
      [],
    );

    const [rows] = await this.pool.query<PublicRiskMonitorRow[]>(
      `SELECT
         a.id AS airport_id,
         a.name,
         a.website,
         a.status,
         a.tags_json,
         a.founded_on,
         a.plan_price_month,
         a.has_trial,
         a.airport_intro,
         a.created_at,
         s.date AS score_date,
         s.score_r,
         COALESCE(
           CAST(JSON_UNQUOTE(JSON_EXTRACT(s.details_json, '$.total_score')) AS DECIMAL(10,2)),
           s.final_score
         ) AS display_score,
         s.risk_penalty,
         s.details_json,
         m.domain_ok,
         m.ssl_days_left,
         m.recent_complaints_count,
         m.history_incidents
       FROM airports a
       LEFT JOIN airport_scores_daily s
         ON s.airport_id = a.id
        AND s.date = (
          SELECT MAX(s2.date)
           FROM airport_scores_daily s2
          WHERE s2.airport_id = a.id
             AND s2.date <= ?
        )
       LEFT JOIN airport_metrics_daily m
         ON m.airport_id = a.id
        AND m.date = s.date
      WHERE a.is_listed = 1
        AND (
          a.status = 'down'
          OR JSON_SEARCH(a.tags_json, 'one', '风险观察') IS NOT NULL
        )
      ORDER BY
        CASE WHEN a.status = 'down' THEN 0 ELSE 1 END ASC,
        CASE WHEN s.date IS NULL THEN 1 ELSE 0 END ASC,
        COALESCE(s.risk_penalty, -1) DESC,
        display_score DESC,
        a.created_at DESC,
        a.id ASC
      LIMIT ? OFFSET ?`,
      [date, safePageSize, offset],
    );

    const yesterdayDate = shiftDateByDays(date, -1);
    const yesterdayDisplayScores = await this.getPublicDisplayScoresByDate(
      rows.map((row) => Number(row.airport_id)),
      yesterdayDate,
    );

    return {
      total: Number(totalRows[0]?.total || 0),
      items: rows.map((row, index) => {
        const currentScore = row.display_score === null ? null : Number(row.display_score);
        const yesterdayScore = yesterdayDisplayScores.get(Number(row.airport_id));
        const details = safeJsonObject(row.details_json);
        const metrics = {
          domain_ok: row.domain_ok === null ? undefined : Boolean(row.domain_ok),
          ssl_days_left: row.ssl_days_left === null ? null : Number(row.ssl_days_left),
          recent_complaints_count: row.recent_complaints_count === null ? 0 : Number(row.recent_complaints_count),
          history_incidents: row.history_incidents === null ? 0 : Number(row.history_incidents),
        };
        const riskReasons = row.status === 'down'
          ? []
          : deriveRiskReasonCodes({
              metrics,
              score: {
                r: row.score_r === null ? undefined : Number(row.score_r),
                details,
              },
            });
        const scoreDate = row.score_date ? formatDateOnly(row.score_date) : null;

        return {
          airport_id: row.airport_id,
          rank: offset + index + 1,
          name: row.name,
          website: row.website,
          status: row.status,
          tags: safeJsonArray(row.tags_json),
          founded_on: row.founded_on ? formatDateOnly(row.founded_on) : null,
          plan_price_month: Number(row.plan_price_month),
          has_trial: !!row.has_trial,
          airport_intro: row.airport_intro,
          created_at: formatDateOnly(row.created_at),
          score: currentScore,
          score_delta_vs_yesterday: {
            label: '对比昨天',
            value:
              currentScore === null || yesterdayScore === undefined
                ? null
                : round2(currentScore - yesterdayScore),
          },
          score_date: scoreDate,
          report_url: scoreDate ? `/reports/${row.airport_id}?date=${scoreDate}` : null,
          monitor_reason: row.status === 'down' ? 'down' : 'risk_watch',
          risk_penalty: row.risk_penalty === null ? null : Number(row.risk_penalty),
          risk_reasons: riskReasons,
          risk_reason_summary: row.status === 'down'
            ? '该机场已由管理员确认标记为跑路状态，已停止日常测评与调度采样。'
            : buildRiskReasonSummary({
                metrics,
                score: {
                  r: row.score_r === null ? undefined : Number(row.score_r),
                  details,
                },
              }),
          snapshot_is_stale: scoreDate ? scoreDate < date : false,
        };
      }),
    };
  }
}

function safeJsonObject(value: unknown): Record<string, ScoreDetailValue> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return sanitizeDetails(value as Record<string, unknown>);
  }
  try {
    const parsed = JSON.parse(String(value));
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    return sanitizeDetails(parsed as Record<string, unknown>);
  } catch {
    return {};
  }
}

function safeJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function sanitizeDetails(details: Record<string, unknown>): Record<string, ScoreDetailValue> {
  return Object.fromEntries(
    Object.entries(details)
      .map(([key, val]) => [key, toScoreDetailValue(val)])
      .filter((entry): entry is [string, ScoreDetailValue] => entry[1] !== undefined),
  );
}

function toScoreDetailValue(value: unknown): ScoreDetailValue | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  return undefined;
}

function shiftDateByDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function round2(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}
