import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { BillingEligibilityService } from './billingEligibilityService';
import { advanceHomeAirportRotation, type HomeAirportRotationState } from '../utils/homeAirportRotation';
import type { HomeAirportRotationInfo } from '../../../shared/homeAirportRotation';
import { isHomeSummaryEligible, type HomeSummaryCandidate, type HomeSummarySection } from '../utils/homeSummaryEligibility';

export interface HomeAirportSelection {
  airport_ids: number[];
  total: number;
  rotation: HomeAirportRotationInfo;
}

export type HomeSummarySelections = Record<HomeSummarySection, HomeAirportSelection>;

/** Separate persisted rows serialize each homepage queue across API instances. */
export class HomeAirportRotationService {
  constructor(
    private readonly pool: Pool,
    private readonly billingEligibility: Pick<BillingEligibilityService, 'getSnapshot'>,
    private readonly now: () => number = Date.now,
  ) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS home_airport_rotation (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
      state_json JSON NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);
    await this.pool.query('INSERT IGNORE INTO home_airport_rotation (id, state_json) VALUES (1, NULL), (2, NULL), (3, NULL)');
  }

  async getSummarySelections(
    date: string,
    limits: Record<HomeSummarySection, number>,
    intervalMinutes: number,
    scoreRuleVersion: 'v1_spcr' | 'v2_spncr',
  ): Promise<HomeSummarySelections> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [states] = await connection.query<Array<RowDataPacket & {
        id: number; state_json: HomeAirportRotationState | string | null;
      }>>('SELECT id, state_json FROM home_airport_rotation WHERE id IN (2, 3) ORDER BY id FOR UPDATE');
      if (states.length !== 2) throw new Error('Homepage summary rotation states are not initialized');
      // Read all current evidence, not the truncated daily category rankings.
      const [rows] = await connection.query<Array<RowDataPacket & {
        airport_id: number; tags_json: string[] | string; details_json: HomeSummaryCandidate['score']['details'] | string;
        s: number; p: number; c: number; r: number; stable_days_streak: number;
        domain_ok: number; ssl_days_left: number | null; recent_complaints_count: number; history_incidents: number;
      }>>(`SELECT a.id AS airport_id, a.tags_json, s.score_s AS s, s.score_p AS p,
                  s.score_c AS c, s.score_r AS r, s.details_json,
                  m.stable_days_streak, m.domain_ok, m.ssl_days_left, m.recent_complaints_count, m.history_incidents
             FROM airports a
             JOIN airport_scores_daily s ON s.airport_id = a.id AND s.date = ?
             JOIN airport_metrics_daily m ON m.airport_id = a.id AND m.date = s.date
            WHERE a.is_listed = 1 AND a.status = 'normal'
              AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.details_json, '$.score_rule_version')), 'v1_spcr') = ?
            ORDER BY a.id`, [date, scoreRuleVersion]);
      const visibility = await this.billingEligibility.getSnapshot(connection);
      const candidates = rows.filter(row => visibility.get(Number(row.airport_id))?.score_hidden === false).map(row => ({
        id: Number(row.airport_id),
        airport: { is_listed: true, status: 'normal' as const,
          tags: (typeof row.tags_json === 'string' ? JSON.parse(row.tags_json) : row.tags_json) || [] },
        metrics: { stable_days_streak: Number(row.stable_days_streak), domain_ok: Boolean(row.domain_ok),
          ssl_days_left: row.ssl_days_left === null ? null : Number(row.ssl_days_left),
          recent_complaints_count: Number(row.recent_complaints_count), history_incidents: Number(row.history_incidents) },
        score: { s: Number(row.s), p: Number(row.p), c: Number(row.c), r: Number(row.r),
          details: (typeof row.details_json === 'string' ? JSON.parse(row.details_json) : row.details_json) || {} },
      }));
      const result = {} as HomeSummarySelections;
      const now = this.now();
      for (const [section, id] of [['most_stable', 2], ['best_value', 3]] as const) {
        const stored = states.find(row => Number(row.id) === id)!;
        const previous = typeof stored.state_json === 'string' ? JSON.parse(stored.state_json) : stored.state_json;
        const ids = candidates.filter(row => isHomeSummaryEligible(row, section)).map(row => row.id);
        const state = advanceHomeAirportRotation(previous, ids, now, intervalMinutes);
        if (JSON.stringify(previous) !== JSON.stringify(state)) {
          await connection.execute('UPDATE home_airport_rotation SET state_json = ? WHERE id = ?', [JSON.stringify(state), id]);
        }
        result[section] = {
          airport_ids: state.queue.slice(0, limits[section]), total: state.queue.length,
          rotation: { interval_minutes: intervalMinutes, round: state.round,
            started_at: new Date(state.started_at).toISOString(),
            next_rotation_at: new Date(state.started_at + intervalMinutes * 60_000).toISOString() },
        };
      }
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async getSelection(limit: number, intervalMinutes: number, forcedAirportIds: number[] = []): Promise<HomeAirportSelection> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<Array<RowDataPacket & { state_json: HomeAirportRotationState | string | null }>>(
        'SELECT state_json FROM home_airport_rotation WHERE id = 1 FOR UPDATE',
      );
      if (!rows.length) throw new Error('Homepage rotation state is not initialized');
      const previous = typeof rows[0].state_json === 'string'
        ? JSON.parse(rows[0].state_json) as HomeAirportRotationState
        : rows[0].state_json;
      // Use the same account/application/wallet relationship as outbound click billing.
      const [candidates] = await connection.query<Array<RowDataPacket & { airport_id: number }>>(`
        SELECT DISTINCT a.id AS airport_id
          FROM airports a
          JOIN airport_applications ap ON ap.approved_airport_id = a.id
          JOIN applicant_accounts aa ON aa.application_id = ap.id
          JOIN applicant_wallets w ON w.applicant_account_id = aa.id AND w.airport_id = a.id
         WHERE a.is_listed = 1 AND a.status IN ('normal', 'risk')
           AND ap.payment_status = 'paid'
           AND (
             SELECT sns.parsed_nodes_count
               FROM airport_subscription_node_snapshots sns
              WHERE sns.airport_id = a.id
              ORDER BY sns.captured_at DESC, sns.id DESC
              LIMIT 1
           ) > 0
           AND EXISTS (
             SELECT 1 FROM applicant_wallet_transactions t
              WHERE t.wallet_id = w.id AND t.transaction_type = 'recharge' AND t.amount > 0
           )
         ORDER BY a.id
      `);
      const eligibility = await this.billingEligibility.getSnapshot(connection);
      const ids = candidates.map(row => Number(row.airport_id))
        .filter(id => eligibility.get(id)?.score_hidden === false);
      // Query independently: a designated airport may have no application, account or wallet.
      if (forcedAirportIds.length) {
        const [forced] = await connection.query<Array<RowDataPacket & { airport_id: number }>>(
          `SELECT id AS airport_id FROM airports
            WHERE is_listed = 1 AND status IN ('normal', 'risk')
              AND id IN (${forcedAirportIds.map(() => '?').join(',')}) ORDER BY id`,
          forcedAirportIds,
        );
        ids.push(...forced.map(row => Number(row.airport_id)));
      }
      const state = advanceHomeAirportRotation(previous, ids, this.now(), intervalMinutes);
      if (JSON.stringify(previous) !== JSON.stringify(state)) {
        await connection.execute('UPDATE home_airport_rotation SET state_json = ? WHERE id = 1', [JSON.stringify(state)]);
      }
      await connection.commit();
      return {
        airport_ids: state.queue.slice(0, limit),
        total: state.queue.length,
        rotation: {
          interval_minutes: state.interval_minutes,
          round: state.round,
          started_at: new Date(state.started_at).toISOString(),
          next_rotation_at: new Date(state.started_at + intervalMinutes * 60_000).toISOString(),
        },
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
