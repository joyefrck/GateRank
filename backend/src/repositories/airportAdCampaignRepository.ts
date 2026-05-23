import { randomUUID } from 'node:crypto';
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import {
  AIRPORT_AD_ALLOWED_MONTHS,
  AIRPORT_AD_LOW_BALANCE_WARNING_THRESHOLD,
  AIRPORT_AD_MONTHLY_PRICE,
  AIRPORT_AD_SLOT_LIMIT,
  type AirportDealView,
  type PortalAirportAdCampaignView,
  type PortalAirportAdStatus,
} from '../../../shared/airportAds';
import { HttpError } from '../middleware/errorHandler';
import { formatSqlDateTimeInTimezone, sqlDateTimeToTimezoneIso } from '../utils/time';

export interface AirportAdCampaignInput {
  airport_id: number;
  applicant_account_id: number;
  application_id: number;
  months: number;
  monthly_price: number;
  coupon_code: string;
  discount_title: string;
  discount_description: string;
  applicable_plan: string;
  is_stackable: boolean;
  refund_supported: boolean;
  discount_percent: number | null;
}

export interface AirportAdCampaignUpdateInput extends Omit<AirportAdCampaignInput, 'months'> {
  campaign_id: number;
  extend_months: number;
}

interface CampaignRow extends RowDataPacket {
  campaign_id: number;
  airport_id: number;
  airport_name: string;
  airport_slug: string | null;
  website: string;
  plan_price_month: number;
  has_trial: number;
  streaming_support_json: unknown;
  payment_methods_json: unknown;
  coupon_code: string;
  discount_title: string;
  discount_description: string;
  applicable_plan: string;
  starts_at: string;
  ends_at: string;
  purchased_months: number;
  billed_amount: number;
  is_stackable: number;
  refund_supported: number;
  discount_percent: number | null;
  campaign_status: 'active' | 'canceled';
  created_at: string;
}

interface WalletRow extends RowDataPacket {
  id: number;
  applicant_account_id: number;
  application_id: number;
  airport_id: number | null;
  balance: number;
}

interface ActiveCampaignRow extends RowDataPacket {
  id: number;
  airport_id: number;
  wallet_id: number;
  starts_at: string;
  ends_at: string;
  purchased_months: number;
  billed_amount: number;
  display_order: number;
}

interface CountRow extends RowDataPacket {
  active_count: number;
}

interface MaxOrderRow extends RowDataPacket {
  max_order: number | null;
}

export class AirportAdCampaignRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS airport_ad_campaigns (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        airport_id BIGINT UNSIGNED NOT NULL,
        applicant_account_id BIGINT UNSIGNED NOT NULL,
        application_id BIGINT UNSIGNED NOT NULL,
        wallet_id BIGINT UNSIGNED NOT NULL,
        coupon_code VARCHAR(64) NOT NULL,
        discount_title VARCHAR(128) NOT NULL,
        discount_description TEXT NOT NULL,
        applicable_plan VARCHAR(128) NOT NULL,
        is_stackable TINYINT(1) NOT NULL DEFAULT 0,
        refund_supported TINYINT(1) NOT NULL DEFAULT 0,
        discount_percent DECIMAL(5,2) NULL,
        purchased_months INT UNSIGNED NOT NULL,
        billed_amount DECIMAL(10,2) NOT NULL,
        starts_at DATETIME NOT NULL,
        ends_at DATETIME NOT NULL,
        status ENUM('active', 'canceled') NOT NULL DEFAULT 'active',
        display_order BIGINT UNSIGNED NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_airport_ad_campaigns_active_slots (status, starts_at, ends_at, id),
        INDEX idx_airport_ad_campaigns_airport_active (airport_id, status, ends_at),
        INDEX idx_airport_ad_campaigns_account_created (applicant_account_id, created_at DESC)
      )
    `);
  }

  async listActiveDeals(now: Date = new Date()): Promise<AirportDealView[]> {
    const nowSql = formatSqlDateTimeInTimezone(now);
    const [rows] = await this.pool.query<CampaignRow[]>(
      `${this.selectDealSql()}
        WHERE campaign.status = 'active'
          AND campaign.starts_at <= ?
          AND campaign.ends_at > ?
          AND airport.status <> 'down'
          AND airport.is_listed = 1
        ORDER BY campaign.starts_at ASC, campaign.id ASC
        LIMIT ${AIRPORT_AD_SLOT_LIMIT}`,
      [nowSql, nowSql],
    );
    return rows.map(toDealView);
  }

  async getPortalStatus(
    airportId: number | null,
    monthlyPrice = AIRPORT_AD_MONTHLY_PRICE,
    now: Date = new Date(),
  ): Promise<PortalAirportAdStatus> {
    const activeCampaign = airportId ? await this.getActiveDealByAirportId(airportId, now) : null;
    const campaigns = await this.listPortalCampaignsByAirportId(airportId, now);
    const activeCount = await this.countActiveCampaigns(now);
    const remainingSlots = Math.max(0, AIRPORT_AD_SLOT_LIMIT - activeCount);

    return {
      active_campaign: activeCampaign,
      campaigns,
      remaining_slots: remainingSlots,
      slot_limit: AIRPORT_AD_SLOT_LIMIT,
      monthly_price: normalizeMonthlyPrice(monthlyPrice),
      low_balance_warning_threshold: AIRPORT_AD_LOW_BALANCE_WARNING_THRESHOLD,
      allowed_months: [...AIRPORT_AD_ALLOWED_MONTHS],
    };
  }

  async listPortalCampaignsByAirportId(airportId: number | null, now: Date = new Date()): Promise<PortalAirportAdCampaignView[]> {
    if (!airportId) {
      return [];
    }
    const [rows] = await this.pool.query<CampaignRow[]>(
      `${this.selectDealSql()}
        WHERE campaign.airport_id = ?
        ORDER BY campaign.ends_at DESC, campaign.id DESC
        LIMIT 20`,
      [airportId],
    );
    return rows.map((row) => toPortalCampaignView(row, now));
  }

  async purchase(input: AirportAdCampaignInput, now: Date = new Date()): Promise<AirportDealView> {
    if (!AIRPORT_AD_ALLOWED_MONTHS.includes(input.months as (typeof AIRPORT_AD_ALLOWED_MONTHS)[number])) {
      throw new HttpError(400, 'BAD_REQUEST', '投放月份不支持');
    }

    const monthlyPrice = normalizeMonthlyPrice(input.monthly_price);
    const amount = roundMoney(monthlyPrice * input.months);
    const nowSql = formatSqlDateTimeInTimezone(now);
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const activeCount = await this.countActiveCampaignsForUpdate(connection, nowSql);
      if (activeCount >= AIRPORT_AD_SLOT_LIMIT) {
        throw new HttpError(409, 'AIRPORT_AD_SLOTS_SOLD_OUT', '当前 6 个广告位已满，空位释放后可继续投放');
      }

      const wallet = await this.ensureWalletForAccount(connection, input);
      if (Number(wallet.balance) < amount) {
        throw new HttpError(409, 'AIRPORT_AD_BALANCE_INSUFFICIENT', '余额不足，无法购买广告位');
      }

      const nextEndsAt = addMonths(now, input.months);
      const nextEndsAtSql = formatSqlDateTimeInTimezone(nextEndsAt);
      const nextBalance = roundMoney(Number(wallet.balance) - amount);

      await connection.execute<ResultSetHeader>(
        'UPDATE applicant_wallets SET balance = ? WHERE id = ?',
        [nextBalance, wallet.id],
      );

      const displayOrder = await this.nextDisplayOrder(connection);
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO airport_ad_campaigns (
           airport_id, applicant_account_id, application_id, wallet_id,
           coupon_code, discount_title, discount_description, applicable_plan,
           is_stackable, refund_supported, discount_percent,
           purchased_months, billed_amount, starts_at, ends_at, status, display_order
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
        [
          input.airport_id,
          input.applicant_account_id,
          input.application_id,
          wallet.id,
          input.coupon_code,
          input.discount_title,
          input.discount_description,
          input.applicable_plan,
          input.is_stackable ? 1 : 0,
          input.refund_supported ? 1 : 0,
          input.discount_percent,
          input.months,
          amount,
          nowSql,
          nextEndsAtSql,
          displayOrder,
        ],
      );
      const campaignId = result.insertId;

      await connection.execute<ResultSetHeader>(
        `INSERT INTO applicant_wallet_transactions (
           wallet_id, applicant_account_id, application_id, airport_id, transaction_type,
           amount, balance_after, reference_type, reference_id, description
         ) VALUES (?, ?, ?, ?, 'ad_campaign_charge', ?, ?, 'ad_campaign', ?, ?)`,
        [
          wallet.id,
          input.applicant_account_id,
          input.application_id,
          input.airport_id,
          -amount,
          nextBalance,
          randomUUID(),
          `广告投放扣费 ¥${amount.toFixed(2)}（${input.months}个月）`,
        ],
      );

      await connection.commit();
      const deal = await this.getActiveDealByAirportId(input.airport_id, now);
      if (!deal) {
        throw new Error('failed to load created airport ad campaign');
      }
      return deal;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async update(input: AirportAdCampaignUpdateInput, now: Date = new Date()): Promise<AirportDealView> {
    const allowedExtendMonths = [0, ...AIRPORT_AD_ALLOWED_MONTHS] as number[];
    if (!allowedExtendMonths.includes(input.extend_months)) {
      throw new HttpError(400, 'BAD_REQUEST', 'extend_months must be one of 0,1,2,3,6,12');
    }

    const nowSql = formatSqlDateTimeInTimezone(now);
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const existing = await this.getEditableCampaignForUpdate(connection, input, nowSql);
      if (!existing) {
        throw new HttpError(404, 'AIRPORT_AD_CAMPAIGN_NOT_EDITABLE', '投放不存在、已过期或不属于当前机场');
      }

      const monthlyPrice = normalizeMonthlyPrice(input.monthly_price);
      const amount = roundMoney(monthlyPrice * input.extend_months);
      let nextBalance: number | null = null;
      let chargeWalletId: number | null = null;
      if (amount > 0) {
        const wallet = await this.ensureWalletForAccount(connection, input);
        chargeWalletId = wallet.id;
        if (Number(wallet.balance) < amount) {
          throw new HttpError(409, 'AIRPORT_AD_BALANCE_INSUFFICIENT', '余额不足，无法延长广告投放');
        }
        nextBalance = roundMoney(Number(wallet.balance) - amount);
        await connection.execute<ResultSetHeader>(
          'UPDATE applicant_wallets SET balance = ? WHERE id = ?',
          [nextBalance, wallet.id],
        );
      }

      const textFields = [
        input.coupon_code,
        input.discount_title,
        input.discount_description,
        input.applicable_plan,
        input.is_stackable ? 1 : 0,
        input.refund_supported ? 1 : 0,
        input.discount_percent,
      ];
      if (amount > 0) {
        const baseEndsAt = new Date(existing.ends_at).getTime() > now.getTime()
          ? new Date(existing.ends_at)
          : now;
        const nextEndsAtSql = formatSqlDateTimeInTimezone(addMonths(baseEndsAt, input.extend_months));
        await connection.execute<ResultSetHeader>(
          `UPDATE airport_ad_campaigns
              SET coupon_code = ?,
                  discount_title = ?,
                  discount_description = ?,
                  applicable_plan = ?,
                  is_stackable = ?,
                  refund_supported = ?,
                  discount_percent = ?,
                  purchased_months = purchased_months + ?,
                  billed_amount = billed_amount + ?,
                  ends_at = ?,
                  updated_at = NOW()
            WHERE id = ?`,
          [
            ...textFields,
            input.extend_months,
            amount,
            nextEndsAtSql,
            input.campaign_id,
          ],
        );
        await connection.execute<ResultSetHeader>(
          `INSERT INTO applicant_wallet_transactions (
             wallet_id, applicant_account_id, application_id, airport_id, transaction_type,
             amount, balance_after, reference_type, reference_id, description
           ) VALUES (?, ?, ?, ?, 'ad_campaign_charge', ?, ?, 'ad_campaign', ?, ?)`,
          [
            chargeWalletId,
            input.applicant_account_id,
            input.application_id,
            input.airport_id,
            -amount,
            nextBalance,
            randomUUID(),
            `广告投放续期扣费 ¥${amount.toFixed(2)}（${input.extend_months}个月）`,
          ],
        );
      } else {
        await connection.execute<ResultSetHeader>(
          `UPDATE airport_ad_campaigns
              SET coupon_code = ?,
                  discount_title = ?,
                  discount_description = ?,
                  applicable_plan = ?,
                  is_stackable = ?,
                  refund_supported = ?,
                  discount_percent = ?,
                  updated_at = NOW()
            WHERE id = ?`,
          [
            ...textFields,
            input.campaign_id,
          ],
        );
      }

      await connection.commit();
      const deal = await this.getActiveDealByAirportId(input.airport_id, now);
      if (!deal) {
        throw new Error('failed to load updated airport ad campaign');
      }
      return deal;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async cancel(
    input: Pick<AirportAdCampaignUpdateInput, 'campaign_id' | 'airport_id' | 'applicant_account_id' | 'application_id'>,
    now: Date = new Date(),
  ): Promise<boolean> {
    const nowSql = formatSqlDateTimeInTimezone(now);
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const existing = await this.getEditableCampaignForUpdate(connection, input, nowSql);
      if (!existing) {
        throw new HttpError(404, 'AIRPORT_AD_CAMPAIGN_NOT_CANCELABLE', '投放不存在、已过期或不属于当前机场');
      }

      await connection.execute<ResultSetHeader>(
        `UPDATE airport_ad_campaigns
            SET status = 'canceled',
                updated_at = NOW()
          WHERE id = ?`,
        [input.campaign_id],
      );

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private selectDealSql(): string {
    return `
      SELECT
        campaign.id AS campaign_id,
        campaign.airport_id,
        airport.name AS airport_name,
        airport.slug AS airport_slug,
        airport.website,
        airport.plan_price_month,
        airport.has_trial,
        airport.streaming_support_json,
        airport.payment_methods_json,
        campaign.coupon_code,
        campaign.discount_title,
        campaign.discount_description,
        campaign.applicable_plan,
        DATE_FORMAT(campaign.starts_at, '%Y-%m-%d %H:%i:%s') AS starts_at,
        DATE_FORMAT(campaign.ends_at, '%Y-%m-%d %H:%i:%s') AS ends_at,
        campaign.purchased_months,
        campaign.billed_amount,
        campaign.is_stackable,
        campaign.refund_supported,
        campaign.discount_percent,
        campaign.status AS campaign_status,
        DATE_FORMAT(campaign.created_at, '%Y-%m-%d %H:%i:%s') AS created_at
      FROM airport_ad_campaigns campaign
      JOIN airports airport ON airport.id = campaign.airport_id
    `;
  }

  private async getActiveDealByAirportId(airportId: number, now: Date): Promise<AirportDealView | null> {
    const nowSql = formatSqlDateTimeInTimezone(now);
    const [rows] = await this.pool.query<CampaignRow[]>(
      `${this.selectDealSql()}
        WHERE campaign.airport_id = ?
          AND campaign.status = 'active'
          AND campaign.starts_at <= ?
          AND campaign.ends_at > ?
        ORDER BY campaign.starts_at ASC, campaign.id ASC
        LIMIT 1`,
      [airportId, nowSql, nowSql],
    );
    return rows[0] ? toDealView(rows[0]) : null;
  }

  private async countActiveCampaigns(now: Date): Promise<number> {
    const nowSql = formatSqlDateTimeInTimezone(now);
    const [rows] = await this.pool.query<CountRow[]>(
      `SELECT COUNT(*) AS active_count
         FROM airport_ad_campaigns
        WHERE status = 'active'
          AND starts_at <= ?
          AND ends_at > ?`,
      [nowSql, nowSql],
    );
    return Number(rows[0]?.active_count || 0);
  }

  private async countActiveCampaignsForUpdate(connection: PoolConnection, nowSql: string): Promise<number> {
    const [rows] = await connection.query<Array<RowDataPacket & { id: number }>>(
      `SELECT id
         FROM airport_ad_campaigns
        WHERE status = 'active'
          AND starts_at <= ?
          AND ends_at > ?
        FOR UPDATE`,
      [nowSql, nowSql],
    );
    return rows.length;
  }

  private async getEditableCampaignForUpdate(
    connection: PoolConnection,
    input: Pick<AirportAdCampaignUpdateInput, 'campaign_id' | 'airport_id' | 'applicant_account_id' | 'application_id'>,
    nowSql: string,
  ): Promise<ActiveCampaignRow | null> {
    const [rows] = await connection.query<ActiveCampaignRow[]>(
      `SELECT id, airport_id, wallet_id,
              DATE_FORMAT(starts_at, '%Y-%m-%d %H:%i:%s') AS starts_at,
              DATE_FORMAT(ends_at, '%Y-%m-%d %H:%i:%s') AS ends_at,
              purchased_months,
              billed_amount,
              display_order
         FROM airport_ad_campaigns
        WHERE id = ?
          AND airport_id = ?
          AND applicant_account_id = ?
          AND application_id = ?
          AND status = 'active'
          AND starts_at <= ?
          AND ends_at > ?
        LIMIT 1
        FOR UPDATE`,
      [
        input.campaign_id,
        input.airport_id,
        input.applicant_account_id,
        input.application_id,
        nowSql,
        nowSql,
      ],
    );
    return rows[0] || null;
  }

  private async ensureWalletForAccount(
    connection: PoolConnection,
    input: Pick<AirportAdCampaignInput, 'applicant_account_id' | 'application_id' | 'airport_id'>,
  ): Promise<WalletRow> {
    await connection.execute<ResultSetHeader>(
      `INSERT IGNORE INTO applicant_wallets (applicant_account_id, application_id, airport_id, balance)
       VALUES (?, ?, ?, 0)`,
      [input.applicant_account_id, input.application_id, input.airport_id],
    );
    await connection.execute<ResultSetHeader>(
      `UPDATE applicant_wallets
          SET airport_id = COALESCE(airport_id, ?)
        WHERE applicant_account_id = ?`,
      [input.airport_id, input.applicant_account_id],
    );
    const [rows] = await connection.query<WalletRow[]>(
      `SELECT id, applicant_account_id, application_id, airport_id, balance
         FROM applicant_wallets
        WHERE applicant_account_id = ?
        LIMIT 1
        FOR UPDATE`,
      [input.applicant_account_id],
    );
    if (!rows[0]) {
      throw new Error('failed to load applicant wallet');
    }
    return rows[0];
  }

  private async nextDisplayOrder(connection: PoolConnection): Promise<number> {
    const [rows] = await connection.query<MaxOrderRow[]>('SELECT MAX(display_order) AS max_order FROM airport_ad_campaigns');
    return Number(rows[0]?.max_order || 0) + 1;
  }
}

function toDealView(row: CampaignRow): AirportDealView {
  const paymentMethods = normalizeStringList(row.payment_methods_json);
  const streaming = normalizeStringList(row.streaming_support_json);
  const slug = row.airport_slug || `airport-${row.airport_id}`;
  return {
    campaign_id: Number(row.campaign_id),
    airport_id: Number(row.airport_id),
    airport_name: row.airport_name,
    airport_slug: slug,
    website: row.website,
    report_url: `/airports/${slug}`,
    coupon_code: row.coupon_code,
    discount_title: row.discount_title,
    discount_description: row.discount_description,
    applicable_plan: row.applicable_plan,
    starts_at: sqlDateTimeToTimezoneIso(row.starts_at),
    ends_at: sqlDateTimeToTimezoneIso(row.ends_at),
    purchased_months: Number(row.purchased_months),
    billed_amount: Number(row.billed_amount),
    is_stackable: Boolean(row.is_stackable),
    refund_supported: Boolean(row.refund_supported),
    supports_trial: Boolean(row.has_trial),
    supports_usdt: paymentMethods.some((method) => method.startsWith('usdt')),
    supports_streaming: streaming.some((item) => item !== 'chatgpt'),
    supports_ai: streaming.includes('chatgpt'),
    low_price_plan: Number(row.plan_price_month) > 0 && Number(row.plan_price_month) <= 20,
    discount_percent: row.discount_percent === null ? null : Number(row.discount_percent),
    created_at: sqlDateTimeToTimezoneIso(row.created_at),
  };
}

function toPortalCampaignView(row: CampaignRow, now: Date): PortalAirportAdCampaignView {
  const deal = toDealView(row);
  const isActive = row.campaign_status === 'active'
    && new Date(deal.starts_at).getTime() <= now.getTime()
    && new Date(deal.ends_at).getTime() > now.getTime();
  const status = row.campaign_status === 'canceled'
    ? 'canceled'
    : isActive
      ? 'active'
      : 'expired';
  const statusLabel = status === 'active' ? '投放中' : status === 'expired' ? '已到期' : '已下架';
  return {
    ...deal,
    status,
    status_label: statusLabel,
    is_active: isActive,
  };
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return normalizeStringList(parsed);
    } catch {
      return [];
    }
  }
  return [];
}

function addMonths(value: Date, months: number): Date {
  const next = new Date(value);
  next.setMonth(next.getMonth() + months);
  return next;
}

function normalizeMonthlyPrice(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return AIRPORT_AD_MONTHLY_PRICE;
  }
  return roundMoney(amount);
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}
