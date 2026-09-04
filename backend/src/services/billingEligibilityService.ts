import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getDateInTimezone } from '../utils/time';
import { resolveClickChargeAmount, type RankClickChargeAmounts } from './marketingSettingsService';
import { MarketingSettingsService } from './marketingSettingsService';
import { SystemSettingRepository } from '../repositories/systemSettingRepository';
import { ScoreRuleService } from './scoreRuleService';

export interface BillingEligibility {
  score_revision?: string;
  rank: number | null;
  /** A rejected candidate retains the attempted tier; never fall back to a cheaper price. */
  billing_rank: number | null;
  click_charge_amount: number;
  score_hidden: boolean;
  score_hidden_reason: 'insufficient_balance' | null;
}

interface Candidate {
  score_revision?: string;
  airport_id: number;
  balance: number | null;
  display_score: number | null;
  rankable: boolean | number;
}

interface BillingConfig {
  click_charge_amount: number;
  rank_click_charge_amounts?: Partial<RankClickChargeAmounts>;
}

export function allocateBillingEligibility(
  candidates: Candidate[], config: BillingConfig,
): Map<number, BillingEligibility> {
  const result = new Map<number, BillingEligibility>();
  let nextRank = 1;
  for (const candidate of candidates) {
    const ranked = Boolean(candidate.rankable) && candidate.display_score != null;
    const billingRank = ranked ? nextRank : null;
    const price = resolveClickChargeAmount(config, billingRank);
    const hidden = Math.round(Number(candidate.balance || 0) * 100) < Math.round(price * 100);
    result.set(Number(candidate.airport_id), {
      ...(candidate.score_revision ? { score_revision: candidate.score_revision } : {}),
      rank: ranked && !hidden ? nextRank++ : null,
      billing_rank: billingRank,
      click_charge_amount: price,
      score_hidden: hidden,
      score_hidden_reason: hidden ? 'insufficient_balance' : null,
    });
  }
  return result;
}

export class BillingEligibilityService {
  constructor(
    private readonly pool: Pool,
    private readonly settings: { getConfig(): Promise<BillingConfig> },
    private readonly scoreRules: { resolveRuleVersion(date: string): Promise<'v1_spcr' | 'v2_spncr'> },
  ) {}

  async getSnapshot(
    connection: Pool | PoolConnection = this.pool,
    lockedWallet?: { airport_id: number; balance: number },
  ): Promise<Map<number, BillingEligibility>> {
    const today = getDateInTimezone('Asia/Shanghai');
    const [latest] = await connection.query<Array<RowDataPacket & { score_date: string | null }>>(
      "SELECT DATE_FORMAT(MAX(date), '%Y-%m-%d') AS score_date FROM airport_scores_daily WHERE date <= ?",
      [today],
    );
    // Match the public ranking's fallback before today's score snapshot has been generated.
    const date = latest[0]?.score_date || today;
    // A transaction must not borrow more pool connections while holding its wallet lock.
    const transactionSettings = connection === this.pool ? null : new SystemSettingRepository(connection as Pool);
    const settings = transactionSettings ? new MarketingSettingsService({ systemSettingRepository: transactionSettings }) : this.settings;
    const rules = transactionSettings ? new ScoreRuleService({ systemSettingRepository: transactionSettings }) : this.scoreRules;
    const [config, version] = await Promise.all([settings.getConfig(), rules.resolveRuleVersion(date)]);
    const [rows] = await connection.query<Array<RowDataPacket & Candidate>>(
      `SELECT a.id AS airport_id, w.balance,
              SHA2(CONCAT_WS(':', s.date, s.final_score, s.details_json,
                (SELECT GROUP_CONCAT(CONCAT_WS(':', r.list_type, r.rank_no, r.score) ORDER BY r.list_type SEPARATOR '|')
                   FROM airport_rankings_daily r WHERE r.airport_id = a.id AND r.date = s.date)
              ), 256) AS score_revision,
              (a.status IN ('normal', 'risk')) AS rankable,
              COALESCE(
                CAST(JSON_UNQUOTE(JSON_EXTRACT(s.details_json, '$.manual_total_score')) AS DECIMAL(10,2)),
                CAST(JSON_UNQUOTE(JSON_EXTRACT(s.details_json, '$.total_score')) AS DECIMAL(10,2)),
                s.final_score
              ) AS display_score
         FROM airports a
         LEFT JOIN applicant_wallets w ON w.airport_id = a.id
         LEFT JOIN airport_scores_daily s ON s.airport_id = a.id AND s.date = (
           SELECT MAX(s2.date) FROM airport_scores_daily s2
            WHERE s2.airport_id = a.id AND s2.date ${version === 'v2_spncr' ? '=' : '<='} ?
              AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s2.details_json, '$.score_rule_version')), 'v1_spcr') = ?
         )
        WHERE a.is_listed = 1
        ORDER BY CASE WHEN s.date IS NULL THEN 1 ELSE 0 END ASC,
                 display_score DESC, a.created_at DESC, a.id ASC`,
      [date, version],
    );
    if (lockedWallet) {
      for (const row of rows) {
        if (Number(row.airport_id) === lockedWallet.airport_id) row.balance = lockedWallet.balance;
      }
    }
    return allocateBillingEligibility(rows, config);
  }

  async getHiddenScoreSql(): Promise<string> {
    const snapshot = await this.getSnapshot();
    const visible = [...snapshot].filter(([, value]) => !value.score_hidden).map(([id]) => id);
    // IDs originate from numeric database primary keys, not request input.
    const ids = visible.filter((id) => Number.isSafeInteger(id) && id > 0);
    return ids.length ? `(a.id NOT IN (${ids.join(',')}))` : '(1 = 1)';
  }
}
