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
import { CLICK_CHARGE_AMOUNT } from '../config/billing';
import { buildAirportReportPath, buildAirportSlugCandidate } from '../../../shared/publicSeo';
import {
  AIRPORT_CLIENT_FILTERS,
  AIRPORT_FILTER_CATALOG,
  AIRPORT_IMPORT_FILTERS,
  AIRPORT_LINE_FILTERS,
  AIRPORT_REGION_FILTERS,
  getAirportFilterLabel,
} from '../../../shared/airportFilterCatalog';
import { EMPTY_FULL_RANKING_FILTERS, type FullRankingFilters } from '../../../shared/fullRankingFilters';
import { AIRPORT_PROFILE_REGION_KEYS } from '../utils/airportProfile';

interface ScoreRow extends RowDataPacket {
  airport_id: number;
  date: unknown;
  score_s: number;
  score_p: number;
  score_n: number | null;
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
  slug: string | null;
  name: string;
  website: string;
  status: AirportStatus;
  tags_json: unknown;
  streaming_support_json: unknown;
  payment_methods_json: unknown;
  has_annual_plan: number | null;
  has_telegram_group: number | null;
  telegram_allows_speaking: number | null;
  has_lifetime_plan: number | null;
  airport_profile_json: unknown;
  region_counts_json: unknown;
  founded_on: unknown;
  plan_price_month: number;
  has_trial: number;
  airport_intro: string | null;
  created_at: unknown;
  score_date: unknown;
  display_score: number | null;
  score_hidden: number | boolean;
}

interface PublicDisplayScoreRow extends RowDataPacket {
  airport_id: number;
  display_score: number | null;
}

interface PublicBillingRankRow extends RowDataPacket {
  airport_id: number;
  display_score: number | null;
}

interface PublicRiskMonitorRow extends RowDataPacket {
  airport_id: number;
  slug: string | null;
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
  score_hidden: number | boolean;
  risk_penalty: number | null;
  details_json: unknown;
  domain_ok: number | null;
  ssl_days_left: number | null;
  recent_complaints_count: number | null;
  history_incidents: number | null;
  score_r: number | null;
}

type FullRankingCapabilities = NonNullable<FullRankingItem['capabilities']>;

const PUBLIC_FULL_RANKING_ORDER_SQL = `
        score_hidden ASC,
        CASE WHEN s.date IS NULL THEN 1 ELSE 0 END ASC,
        display_score DESC,
        a.created_at DESC,
        a.id ASC`;

const LATEST_SUBSCRIPTION_NODE_SNAPSHOT_JOIN_SQL = `
       LEFT JOIN airport_subscription_node_snapshots sns
         ON sns.id = (
           SELECT latest_sns.id
             FROM airport_subscription_node_snapshots latest_sns
            WHERE latest_sns.airport_id = a.id
            ORDER BY latest_sns.captured_at DESC, latest_sns.id DESC
            LIMIT 1
         )`;

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

  async getLatestAvailableDateByAirport(
    airportId: number,
    onOrBefore: string,
    scoreRuleVersion?: 'v1_spcr' | 'v2_spncr',
  ): Promise<string | null> {
    const [rows] = await this.pool.query<LatestDateRow[]>(
      `SELECT MAX(date) AS latest_date
         FROM airport_scores_daily
        WHERE airport_id = ?
          AND date <= ?
          ${scoreRuleVersion ? "AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(details_json, '$.score_rule_version')), 'v1_spcr') = ?" : ''}`,
      scoreRuleVersion ? [airportId, onOrBefore, scoreRuleVersion] : [airportId, onOrBefore],
    );

    const latestDate = rows[0]?.latest_date;
    return latestDate ? formatDateOnly(latestDate) : null;
  }

  async getPublicBillingRankByDate(
    airportId: number,
    date: string,
    clickChargeAmount: number = CLICK_CHARGE_AMOUNT,
  ): Promise<number | null> {
    const rankingFilters = buildPublicFullRankingFilters(EMPTY_FULL_RANKING_FILTERS);
    const [rows] = await this.pool.query<PublicBillingRankRow[]>(
      `SELECT
         a.id AS airport_id,
         COALESCE(
           CAST(JSON_UNQUOTE(JSON_EXTRACT(s.details_json, '$.manual_total_score')) AS DECIMAL(10,2)),
           CAST(JSON_UNQUOTE(JSON_EXTRACT(s.details_json, '$.total_score')) AS DECIMAL(10,2)),
           s.final_score
         ) AS display_score,
         (COALESCE(w.balance, 0) < ?) AS score_hidden
       FROM airports a
       LEFT JOIN applicant_wallets w
         ON w.airport_id = a.id
       LEFT JOIN (
         SELECT airport_id, MAX(date) AS score_date
           FROM airport_scores_daily
          WHERE date <= ?
          GROUP BY airport_id
       ) latest_score
         ON latest_score.airport_id = a.id
       LEFT JOIN airport_scores_daily s
         ON s.airport_id = a.id
        AND s.date = latest_score.score_date
      WHERE a.is_listed = 1
        ${rankingFilters.whereSql}
      ORDER BY
        ${PUBLIC_FULL_RANKING_ORDER_SQL}
      LIMIT 6`,
      [clickChargeAmount, date, ...rankingFilters.params],
    );

    const index = rows.findIndex((row) => Number(row.airport_id) === airportId);
    if (index < 0 || rows[index].display_score === null || rows[index].display_score === undefined) {
      return null;
    }
    return index + 1;
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
        airport_id, date, score_s, score_p, score_n, score_c, score_r,
        risk_penalty, score, recent_score, historical_score, final_score, details_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        score_s = VALUES(score_s),
        score_p = VALUES(score_p),
        score_n = VALUES(score_n),
        score_c = VALUES(score_c),
        score_r = VALUES(score_r),
        risk_penalty = VALUES(risk_penalty),
        score = VALUES(score),
        recent_score = VALUES(recent_score),
        historical_score = VALUES(historical_score),
        final_score = VALUES(final_score),
        details_json =
          CASE
            WHEN JSON_EXTRACT(details_json, '$.manual_total_score') IS NULL THEN VALUES(details_json)
            ELSE JSON_SET(
              VALUES(details_json),
              '$.manual_total_score',
              CAST(JSON_UNQUOTE(JSON_EXTRACT(details_json, '$.manual_total_score')) AS DECIMAL(10,2))
            )
          END`,
      [
        airportId,
        date,
        score.s,
        score.p,
        score.n ?? null,
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

  async deleteDaily(airportId: number, date: string): Promise<void> {
    await this.pool.execute<ResultSetHeader>(
      `DELETE FROM airport_scores_daily
        WHERE airport_id = ? AND date = ?`,
      [airportId, date],
    );
  }

  async updateManualTotalScore(
    airportId: number,
    date: string,
    totalScore: number | null,
  ): Promise<boolean> {
    const sql = totalScore === null
      ? `UPDATE airport_scores_daily
            SET details_json = JSON_REMOVE(COALESCE(details_json, JSON_OBJECT()), '$.manual_total_score')
          WHERE airport_id = ? AND date = ?`
      : `UPDATE airport_scores_daily
            SET details_json = JSON_SET(
              COALESCE(details_json, JSON_OBJECT()),
              '$.manual_total_score',
              ?
            )
          WHERE airport_id = ? AND date = ?`;
    const params = totalScore === null ? [airportId, date] : [totalScore, airportId, date];
    const [result] = await this.pool.execute<ResultSetHeader>(sql, params);
    return result.affectedRows > 0;
  }

  async getByAirportAndDate(airportId: number, date: string): Promise<AirportScoreDaily | null> {
    const [rows] = await this.pool.query<ScoreRow[]>(
      `SELECT airport_id, date, score_s, score_p, score_n, score_c, score_r,
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
    return toAirportScoreDaily(row);
  }

  async getByDate(date: string): Promise<AirportScoreDaily[]> {
    const [rows] = await this.pool.query<ScoreRow[]>(
      `SELECT airport_id, date, score_s, score_p, score_n, score_c, score_r,
              risk_penalty, score, recent_score, historical_score, final_score, details_json
         FROM airport_scores_daily
        WHERE date = ?`,
      [date],
    );

    return rows.map(toAirportScoreDaily);
  }

  async getByAirportIdsAndDate(airportIds: number[], date: string): Promise<Map<number, AirportScoreDaily>> {
    if (airportIds.length === 0) {
      return new Map();
    }

    const placeholders = airportIds.map(() => '?').join(', ');
    const [rows] = await this.pool.query<ScoreRow[]>(
      `SELECT airport_id, date, score_s, score_p, score_n, score_c, score_r,
              risk_penalty, score, recent_score, historical_score, final_score, details_json
         FROM airport_scores_daily
        WHERE date = ?
          AND airport_id IN (${placeholders})`,
      [date, ...airportIds],
    );

    return new Map(rows.map((row) => [row.airport_id, toAirportScoreDaily(row)]));
  }

  async getTrend(airportId: number, startDate: string, endDate: string): Promise<AirportScoreDaily[]> {
    const [rows] = await this.pool.query<ScoreRow[]>(
      `SELECT airport_id, date, score_s, score_p, score_n, score_c, score_r,
              risk_penalty, score, recent_score, historical_score, final_score, details_json
         FROM airport_scores_daily
        WHERE airport_id = ? AND date >= ? AND date <= ?
        ORDER BY date ASC`,
      [airportId, startDate, endDate],
    );

    return rows.map(toAirportScoreDaily);
  }

  async getTrendsByAirportIds(
    airportIds: number[],
    startDate: string,
    endDate: string,
  ): Promise<Map<number, AirportScoreDaily[]>> {
    if (airportIds.length === 0) {
      return new Map();
    }

    const placeholders = airportIds.map(() => '?').join(', ');
    const [rows] = await this.pool.query<ScoreRow[]>(
      `SELECT airport_id, date, score_s, score_p, score_n, score_c, score_r,
              risk_penalty, score, recent_score, historical_score, final_score, details_json
         FROM airport_scores_daily
        WHERE airport_id IN (${placeholders})
          AND date >= ?
          AND date <= ?
        ORDER BY airport_id ASC, date ASC`,
      [...airportIds, startDate, endDate],
    );

    const trends = new Map<number, AirportScoreDaily[]>();
    for (const row of rows) {
      const list = trends.get(row.airport_id);
      const score = toAirportScoreDaily(row);
      if (list) {
        list.push(score);
      } else {
        trends.set(row.airport_id, [score]);
      }
    }
    return trends;
  }

  async getPublicDisplayScoreByAirportAndDate(
    airportId: number,
    date: string,
    scoreRuleVersion?: 'v1_spcr' | 'v2_spncr',
  ): Promise<number | null> {
    const [rows] = await this.pool.query<PublicDisplayScoreRow[]>(
      `SELECT
         airport_id,
         COALESCE(
           CAST(JSON_UNQUOTE(JSON_EXTRACT(details_json, '$.manual_total_score')) AS DECIMAL(10,2)),
           CAST(JSON_UNQUOTE(JSON_EXTRACT(details_json, '$.total_score')) AS DECIMAL(10,2)),
           final_score
         ) AS display_score
       FROM airport_scores_daily
       WHERE airport_id = ? AND date = ?
         ${scoreRuleVersion ? "AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(details_json, '$.score_rule_version')), 'v1_spcr') = ?" : ''}
       LIMIT 1`,
      scoreRuleVersion ? [airportId, date, scoreRuleVersion] : [airportId, date],
    );

    const displayScore = rows[0]?.display_score;
    return displayScore === null || displayScore === undefined ? null : Number(displayScore);
  }

  async getPublicDisplayScoresByDate(
    airportIds: number[],
    date: string,
    scoreRuleVersion?: 'v1_spcr' | 'v2_spncr',
  ): Promise<Map<number, number>> {
    if (airportIds.length === 0) {
      return new Map();
    }

    const placeholders = airportIds.map(() => '?').join(', ');
    const [rows] = await this.pool.query<PublicDisplayScoreRow[]>(
      `SELECT
         airport_id,
         COALESCE(
           CAST(JSON_UNQUOTE(JSON_EXTRACT(details_json, '$.manual_total_score')) AS DECIMAL(10,2)),
           CAST(JSON_UNQUOTE(JSON_EXTRACT(details_json, '$.total_score')) AS DECIMAL(10,2)),
           final_score
         ) AS display_score
       FROM airport_scores_daily
       WHERE date = ?
         ${scoreRuleVersion ? "AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(details_json, '$.score_rule_version')), 'v1_spcr') = ?" : ''}
         AND airport_id IN (${placeholders})`,
      [date, ...(scoreRuleVersion ? [scoreRuleVersion] : []), ...airportIds],
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
    filters: FullRankingFilters = EMPTY_FULL_RANKING_FILTERS,
    clickChargeAmount: number = CLICK_CHARGE_AMOUNT,
    scoreRuleVersion: 'v1_spcr' | 'v2_spncr' = 'v1_spcr',
  ): Promise<{ total: number; items: FullRankingItem[] }> {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));
    const offset = (safePage - 1) * safePageSize;
    const rankingFilters = buildPublicFullRankingFilters(filters);
    const countSnapshotJoin = filters.region.length > 0 ? LATEST_SUBSCRIPTION_NODE_SNAPSHOT_JOIN_SQL : '';
    const isV2 = scoreRuleVersion === 'v2_spncr';
    const versionExpression = "COALESCE(JSON_UNQUOTE(JSON_EXTRACT(details_json, '$.score_rule_version')), 'v1_spcr')";

    const [totalRows] = await this.pool.query<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) AS total
         FROM airports a
         ${countSnapshotJoin}
        WHERE a.is_listed = 1
          ${rankingFilters.whereSql}`,
      rankingFilters.params,
    );

    const [rows] = await this.pool.query<PublicFullRankingRow[]>(
      `SELECT
         a.id AS airport_id,
         a.slug,
         a.name,
         a.website,
         a.status,
         a.tags_json,
         a.streaming_support_json,
         a.payment_methods_json,
         a.has_annual_plan,
         a.has_telegram_group,
         a.telegram_allows_speaking,
         a.has_lifetime_plan,
         a.airport_profile_json,
         sns.region_counts_json,
         a.founded_on,
         a.plan_price_month,
         a.has_trial,
         a.airport_intro,
         a.created_at,
         s.date AS score_date,
         COALESCE(
           CAST(JSON_UNQUOTE(JSON_EXTRACT(s.details_json, '$.manual_total_score')) AS DECIMAL(10,2)),
           CAST(JSON_UNQUOTE(JSON_EXTRACT(s.details_json, '$.total_score')) AS DECIMAL(10,2)),
           s.final_score
         ) AS display_score,
         (COALESCE(w.balance, 0) < ?) AS score_hidden
       FROM airports a
       ${LATEST_SUBSCRIPTION_NODE_SNAPSHOT_JOIN_SQL}
       LEFT JOIN applicant_wallets w
         ON w.airport_id = a.id
       LEFT JOIN (
         SELECT airport_id, MAX(date) AS score_date
           FROM airport_scores_daily
           WHERE date ${isV2 ? '=' : '<='} ?
             AND ${versionExpression} = ?
          GROUP BY airport_id
       ) latest_score
         ON latest_score.airport_id = a.id
       LEFT JOIN airport_scores_daily s
         ON s.airport_id = a.id
        AND s.date = latest_score.score_date
      WHERE a.is_listed = 1
        ${rankingFilters.whereSql}
      ORDER BY
        ${PUBLIC_FULL_RANKING_ORDER_SQL}
      LIMIT ? OFFSET ?`,
      [clickChargeAmount, date, scoreRuleVersion, ...rankingFilters.params, safePageSize, offset],
    );

    const yesterdayDate = shiftDateByDays(date, -1);
    const yesterdayDisplayScores = await this.getPublicDisplayScoresByDate(
      rows.map((row) => Number(row.airport_id)),
      yesterdayDate,
      scoreRuleVersion,
    );

    return {
      total: Number(totalRows[0]?.total || 0),
      items: rows.map((row, index) => {
        const scoreHidden = Boolean(row.score_hidden);
        const currentScore = scoreHidden || row.display_score === null ? null : Number(row.display_score);
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
          score_hidden: scoreHidden,
          score_hidden_reason: scoreHidden ? 'insufficient_balance' : null,
          score_delta_vs_yesterday: {
            label: '对比昨天',
            value:
              currentScore === null || yesterdayScore === undefined
                ? null
                : round2(currentScore - yesterdayScore),
          },
          score_date: row.score_date ? formatDateOnly(row.score_date) : null,
          report_url: row.score_date ? buildAirportReportPath(resolveAirportSlugFromRow(row)) : null,
          capabilities: buildFullRankingCapabilities(row),
        };
      }),
    };
  }

  async getPublicRiskMonitorByDate(
    date: string,
    page: number,
    pageSize: number,
    clickChargeAmount: number = CLICK_CHARGE_AMOUNT,
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
         a.slug,
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
             CAST(JSON_UNQUOTE(JSON_EXTRACT(s.details_json, '$.manual_total_score')) AS DECIMAL(10,2)),
             CAST(JSON_UNQUOTE(JSON_EXTRACT(s.details_json, '$.total_score')) AS DECIMAL(10,2)),
             s.final_score
           ) AS display_score,
           (COALESCE(w.balance, 0) < ?) AS score_hidden,
           s.risk_penalty,
         s.details_json,
         m.domain_ok,
         m.ssl_days_left,
         m.recent_complaints_count,
         m.history_incidents
      FROM airports a
       LEFT JOIN applicant_wallets w
         ON w.airport_id = a.id
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
        score_hidden ASC,
        CASE WHEN s.date IS NULL THEN 1 ELSE 0 END ASC,
        COALESCE(s.risk_penalty, -1) DESC,
        display_score DESC,
        a.created_at DESC,
        a.id ASC
      LIMIT ? OFFSET ?`,
      [clickChargeAmount, date, safePageSize, offset],
    );

    const yesterdayDate = shiftDateByDays(date, -1);
    const yesterdayDisplayScores = await this.getPublicDisplayScoresByDate(
      rows.map((row) => Number(row.airport_id)),
      yesterdayDate,
    );

    return {
      total: Number(totalRows[0]?.total || 0),
      items: rows.map((row, index) => {
        const scoreHidden = Boolean(row.score_hidden);
        const currentScore = scoreHidden || row.display_score === null ? null : Number(row.display_score);
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
          score_hidden: scoreHidden,
          score_hidden_reason: scoreHidden ? 'insufficient_balance' : null,
          score_delta_vs_yesterday: {
            label: '对比昨天',
            value:
              currentScore === null || yesterdayScore === undefined
                ? null
                : round2(currentScore - yesterdayScore),
          },
          score_date: scoreDate,
          report_url: scoreDate ? buildAirportReportPath(resolveAirportSlugFromRow(row)) : null,
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

function buildPublicFullRankingFilters(filters: FullRankingFilters): { whereSql: string; params: unknown[] } {
  const clauses = ["a.status IN ('normal', 'risk')"];
  const params: unknown[] = [];

  if (filters.q) {
    const keyword = `%${filters.q.toLowerCase()}%`;
    clauses.push(`(
      LOWER(a.name) LIKE ?
      OR LOWER(a.website) LIKE ?
      OR LOWER(COALESCE(a.airport_intro, '')) LIKE ?
      OR LOWER(COALESCE(JSON_UNQUOTE(a.tags_json), '')) LIKE ?
    )`);
    params.push(keyword, keyword, keyword, keyword);
  }

  addJsonArrayFilter(clauses, params, 'a.payment_methods_json', filters.payment);
  addJsonArrayFilter(clauses, params, 'a.streaming_support_json', filters.streaming);
  addJsonBooleanMapFilter(clauses, 'clients', filters.client);
  addJsonBooleanMapFilter(clauses, 'import_methods', filters.import);
  addRegionFilter(clauses, filters.region);
  addLineFilter(clauses, params, filters.line);

  if (filters.trial !== null) {
    clauses.push('a.has_trial = ?');
    params.push(filters.trial ? 1 : 0);
  }
  if (filters.annual !== null) {
    clauses.push('(a.has_annual_plan = ? OR JSON_UNQUOTE(JSON_EXTRACT(a.airport_profile_json, "$.plan.supports_annual")) = ?)');
    params.push(filters.annual ? 1 : 0, filters.annual ? 'true' : 'false');
  }
  if (filters.lifetime !== null) {
    clauses.push('(a.has_lifetime_plan = ? OR JSON_UNQUOTE(JSON_EXTRACT(a.airport_profile_json, "$.plan.has_lifetime_plan")) = ?)');
    params.push(filters.lifetime ? 1 : 0, filters.lifetime ? 'true' : 'false');
  }
  if (filters.telegram !== null) {
    clauses.push('(a.has_telegram_group = ? OR JSON_UNQUOTE(JSON_EXTRACT(a.airport_profile_json, "$.telegram.has_group")) = ?)');
    params.push(filters.telegram ? 1 : 0, filters.telegram ? 'true' : 'false');
  }
  if (filters.price_min !== null) {
    clauses.push('a.plan_price_month >= ?');
    params.push(filters.price_min);
  }
  if (filters.price_max !== null) {
    clauses.push('a.plan_price_month <= ?');
    params.push(filters.price_max);
  }

  return {
    whereSql: clauses.map((clause) => `AND ${clause}`).join('\n          '),
    params,
  };
}

function addJsonArrayFilter(clauses: string[], params: unknown[], column: string, values: string[]): void {
  if (values.length === 0) {
    return;
  }
  clauses.push(`(${values.map(() => `JSON_CONTAINS(COALESCE(${column}, JSON_ARRAY()), JSON_QUOTE(?))`).join(' OR ')})`);
  params.push(...values);
}

function addJsonBooleanMapFilter(clauses: string[], field: 'clients' | 'import_methods', values: string[]): void {
  if (values.length === 0) {
    return;
  }
  clauses.push(`(${values.map((value) => (
    `JSON_UNQUOTE(JSON_EXTRACT(a.airport_profile_json, '$.${field}.${value}')) = 'true'`
  )).join(' OR ')})`);
}

function addRegionFilter(clauses: string[], values: string[]): void {
  if (values.length === 0) {
    return;
  }
  const regionCodes = values
    .map((value) => AIRPORT_REGION_FILTERS.find((item) => item.key === value)?.regionCode)
    .filter((value): value is string => Boolean(value));
  if (regionCodes.length === 0) {
    return;
  }
  clauses.push(`(${regionCodes.map((code) => (
    `COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(sns.region_counts_json, '$.${code}')) AS UNSIGNED), 0) > 0`
  )).join(' OR ')})`);
}

function addLineFilter(clauses: string[], params: unknown[], values: string[]): void {
  if (values.length === 0) {
    return;
  }
  const regionKeys = AIRPORT_PROFILE_REGION_KEYS;
  clauses.push(`(${values.map(() => (
    `(${regionKeys.map((regionKey) => (
      `JSON_CONTAINS(COALESCE(JSON_EXTRACT(a.airport_profile_json, '$.regions.${regionKey}.line_types'), JSON_ARRAY()), JSON_QUOTE(?))`
    )).join(' OR ')})`
  )).join(' OR ')})`);
  for (const value of values) {
    params.push(...regionKeys.map(() => value));
  }
}

function buildFullRankingCapabilities(row: PublicFullRankingRow): FullRankingCapabilities {
  const profile = safeJsonRecord(row.airport_profile_json);
  const plan = safeJsonRecord(profile.plan);
  const telegram = safeJsonRecord(profile.telegram);
  return {
    payment_methods: toCatalogItems(safeJsonArray(row.payment_methods_json), 'payment'),
    streaming: toCatalogItems(safeJsonArray(row.streaming_support_json), 'streaming'),
    clients: toBooleanCatalogItems(safeJsonRecord(profile.clients), AIRPORT_CLIENT_FILTERS),
    import_methods: toBooleanCatalogItems(safeJsonRecord(profile.import_methods), AIRPORT_IMPORT_FILTERS),
    regions: buildFullRankingRegionCapabilities(
      safeJsonRecord(profile.regions),
      safeJsonRecord(row.region_counts_json),
    ),
    plan: {
      supports_annual: nullableBoolean(plan.supports_annual) ?? nullableDbBoolean(row.has_annual_plan),
      has_lifetime_plan: nullableBoolean(plan.has_lifetime_plan) ?? nullableDbBoolean(row.has_lifetime_plan),
    },
    telegram: {
      has_group: nullableBoolean(telegram.has_group) ?? nullableDbBoolean(row.has_telegram_group),
      group_allows_speaking: nullableBoolean(telegram.group_allows_speaking) ?? nullableDbBoolean(row.telegram_allows_speaking),
    },
  };
}

function toCatalogItems(values: string[], category: 'payment' | 'streaming'): FullRankingCapabilities['payment_methods'] {
  const allowed = new Set(AIRPORT_FILTER_CATALOG[category].map((item) => item.key));
  return values
    .filter((value) => allowed.has(value))
    .map((value) => ({ key: value, label: getAirportFilterLabel(category, value) }));
}

function toBooleanCatalogItems(
  source: Record<string, unknown>,
  options: Array<{ key: string; label: string }>,
): FullRankingCapabilities['clients'] {
  return options
    .filter((item) => nullableBoolean(source[item.key]) === true)
    .map((item) => ({ key: item.key, label: item.label }));
}

function buildFullRankingRegionCapabilities(
  source: Record<string, unknown>,
  regionCounts: Record<string, unknown>,
): FullRankingCapabilities['regions'] {
  return AIRPORT_REGION_FILTERS
    .map((option) => {
      if (Number(regionCounts[option.regionCode] || 0) <= 0) {
        return null;
      }
      const region = safeJsonRecord(source[option.key]);
      const lineTypes = safeJsonArray(region.line_types)
        .filter((value) => AIRPORT_LINE_FILTERS.some((item) => item.key === value))
        .map((value) => ({ key: value, label: getAirportFilterLabel('line', value) }));
      const hasResidential = nullableBoolean(region.has_residential);
      const hasNativeIp = nullableBoolean(region.has_native_ip);
      return {
        key: option.key,
        label: option.label,
        line_types: lineTypes,
        has_residential: hasResidential,
        has_native_ip: hasNativeIp,
      };
    })
    .filter((item): item is FullRankingCapabilities['regions'][number] => item !== null);
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

function toAirportScoreDaily(row: ScoreRow): AirportScoreDaily {
  return {
    airport_id: row.airport_id,
    date: formatDateOnly(row.date),
    s: Number(row.score_s),
    p: Number(row.score_p),
    n: row.score_n === null || row.score_n === undefined ? null : Number(row.score_n),
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

function resolveAirportSlugFromRow(row: { airport_id: number; slug?: string | null; name: string; website: string }): string {
  return row.slug || buildAirportSlugCandidate({ name: row.name, website: row.website }) || `airport-${row.airport_id}`;
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

function safeJsonRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function nullableBoolean(value: unknown): boolean | null {
  if (value === true || value === 1) {
    return true;
  }
  if (value === false || value === 0) {
    return false;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no') {
      return false;
    }
  }
  return null;
}

function nullableDbBoolean(value: number | null): boolean | null {
  return value === null ? null : Number(value) > 0;
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
