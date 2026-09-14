import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { BillingEligibilityService } from './billingEligibilityService';
import { advanceHomeAirportRotation, type HomeAirportRotationState } from '../utils/homeAirportRotation';
import type { HomeAirportRotationInfo } from '../../../shared/homeAirportRotation';

export interface HomeAirportSelection {
  airport_ids: number[];
  total: number;
  rotation: HomeAirportRotationInfo;
}

/** A single persisted row serializes homepage decisions across requests and API instances. */
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
    await this.pool.query('INSERT IGNORE INTO home_airport_rotation (id, state_json) VALUES (1, NULL)');
  }

  async getSelection(limit: number, intervalMinutes: number): Promise<HomeAirportSelection> {
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
           AND EXISTS (
             SELECT 1 FROM applicant_wallet_transactions t
              WHERE t.wallet_id = w.id AND t.transaction_type = 'recharge' AND t.amount > 0
           )
         ORDER BY a.id
      `);
      const eligibility = await this.billingEligibility.getSnapshot(connection);
      const ids = candidates.map(row => Number(row.airport_id))
        .filter(id => eligibility.get(id)?.score_hidden === false);
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
