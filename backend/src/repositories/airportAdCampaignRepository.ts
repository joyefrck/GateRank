import { randomUUID } from 'node:crypto';
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import {
  AIRPORT_AD_ALLOWED_MONTHS,
  AIRPORT_AD_LOW_BALANCE_WARNING_THRESHOLD,
  AIRPORT_AD_MONTHLY_PRICE,
  AIRPORT_HOME_AD_SLOTS,
  type AdminAirportAdDerivedStatus,
  type AdminAirportAdPlacementFilter,
  type AdminAirportAdStatsListView,
  type AdminAirportAdStatsView,
  type AdminAirportAdStatusFilter,
  type AirportAdMonthOption,
  type AirportDealView,
  type AirportHomeAdSlot,
  type AirportHomeAdSlotPrices,
  type PortalAirportAdCampaignView,
  type PortalAirportAdStatsView,
  type PortalAirportAdStatus,
} from '../../../shared/airportAds';
import { HttpError } from '../middleware/errorHandler';
import {
  dateDaysAgo,
  diffDays,
  formatSqlDateTimeInTimezone,
  getDateInTimezone,
  sqlDateTimeToTimezoneIso,
} from '../utils/time';

const PORTAL_AD_STATS_PAGE_SIZE = 30 as const;
const ADMIN_AD_STATS_PAGE_SIZE = 20 as const;

export interface AirportAdCampaignInput {
  airport_id: number;
  applicant_account_id: number;
  application_id: number;
  months: number;
  monthly_price: number;
  home_slot?: AirportHomeAdSlot | null;
  coupon_code: string;
  discount_title: string;
  discount_description: string;
  applicable_plan: string;
  is_stackable: boolean;
  refund_supported: boolean;
  discount_percent: number | null;
}

export interface AirportAdCampaignUpdateInput extends Omit<AirportAdCampaignInput, 'months' | 'home_slot'> {
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
  founded_on: string | null;
  airport_intro: string | null;
  tags_json: unknown;
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
  home_slot: number | null;
  tracking_started_at: string | null;
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
  home_slot: number | null;
  tracking_started_at: string | null;
}

export interface AirportAdCampaignRenewInput {
  campaign_id: number;
  airport_id: number;
  applicant_account_id: number;
  application_id: number;
  months: AirportAdMonthOption;
  monthly_price: number;
}

interface ActiveHomeSlotRow extends RowDataPacket {
  id: number;
  home_slot: number;
}

interface MaxOrderRow extends RowDataPacket {
  max_order: number | null;
}

interface CampaignStatsOwnerRow extends RowDataPacket {
  campaign_id: number;
  tracking_started_at: string | null;
  ends_at: string;
}

interface AdminCampaignStatsOwnerRow extends CampaignStatsOwnerRow {
  airport_id: number;
  airport_name: string;
  airport_slug: string | null;
  coupon_code: string;
  home_slot: number | null;
  starts_at: string;
  purchased_months: number;
  campaign_status: 'active' | 'canceled';
}

interface AdminCampaignStatsListRow extends AdminCampaignStatsOwnerRow {
  created_at: string;
  impressions: number;
  clicks: number;
}

interface CountRow extends RowDataPacket {
  total: number;
}

interface CampaignStatsAggregateRow extends RowDataPacket {
  impressions: number;
  clicks: number;
}

interface CampaignStatsDailyRow extends CampaignStatsAggregateRow {
  event_date: string;
}

export class AirportAdCampaignRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(now: Date = new Date()): Promise<void> {
    const nowSql = formatSqlDateTimeInTimezone(now);
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
        home_slot TINYINT UNSIGNED NULL,
        purchased_months INT UNSIGNED NOT NULL,
        billed_amount DECIMAL(10,2) NOT NULL,
        starts_at DATETIME NOT NULL,
        ends_at DATETIME NOT NULL,
        tracking_started_at DATETIME NULL,
        status ENUM('active', 'canceled') NOT NULL DEFAULT 'active',
        display_order BIGINT UNSIGNED NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_airport_ad_campaigns_active_slots (status, starts_at, ends_at, id),
        INDEX idx_airport_ad_campaigns_home_slot_active (home_slot, status, starts_at, ends_at),
        INDEX idx_airport_ad_campaigns_airport_active (airport_id, status, ends_at),
        INDEX idx_airport_ad_campaigns_account_created (applicant_account_id, created_at DESC)
      )
    `);
    await this.ensureColumn(
      'airport_ad_campaigns',
      'home_slot',
      'TINYINT UNSIGNED NULL AFTER discount_percent',
    );
    await this.ensureColumn(
      'airport_ad_campaigns',
      'tracking_started_at',
      'DATETIME NULL AFTER ends_at',
    );
    await this.pool.query(
      `UPDATE airport_ad_campaigns
          SET tracking_started_at = ?
        WHERE tracking_started_at IS NULL
          AND status = 'active'
          AND starts_at <= ?
          AND ends_at > ?`,
      [nowSql, nowSql, nowSql],
    );
    await this.ensureIndex(
      'airport_ad_campaigns',
      'idx_airport_ad_campaigns_home_slot_active',
      `CREATE INDEX idx_airport_ad_campaigns_home_slot_active
         ON airport_ad_campaigns (home_slot, status, starts_at, ends_at)`,
    );
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
        ORDER BY campaign.starts_at ASC, campaign.id ASC`,
      [nowSql, nowSql],
    );
    return rows.map(toDealView);
  }

  async listActiveHomeDeals(now: Date = new Date()): Promise<AirportDealView[]> {
    const nowSql = formatSqlDateTimeInTimezone(now);
    const [rows] = await this.pool.query<CampaignRow[]>(
      `${this.selectDealSql()}
        WHERE campaign.status = 'active'
          AND campaign.starts_at <= ?
          AND campaign.ends_at > ?
          AND campaign.home_slot IS NOT NULL
          AND airport.status <> 'down'
          AND airport.is_listed = 1
        ORDER BY campaign.home_slot ASC, campaign.starts_at ASC, campaign.id ASC
        LIMIT ${AIRPORT_HOME_AD_SLOTS.length}`,
      [nowSql, nowSql],
    );
    return rows.map(toDealView);
  }

  async getPortalStatus(
    airportId: number | null,
    monthlyPrice = AIRPORT_AD_MONTHLY_PRICE,
    homeSlotMonthlyPricesOrNow: AirportHomeAdSlotPrices | Date = createDefaultHomeSlotPrices(monthlyPrice),
    now: Date = new Date(),
  ): Promise<PortalAirportAdStatus> {
    const resolvedNow = homeSlotMonthlyPricesOrNow instanceof Date ? homeSlotMonthlyPricesOrNow : now;
    const homeSlotMonthlyPrices = homeSlotMonthlyPricesOrNow instanceof Date
      ? createDefaultHomeSlotPrices(monthlyPrice)
      : homeSlotMonthlyPricesOrNow;
    const activeCampaign = airportId ? await this.getActiveDealByAirportId(airportId, resolvedNow) : null;
    const campaigns = await this.listPortalCampaignsByAirportId(airportId, resolvedNow);
    const occupiedHomeSlots = await this.listActiveHomeSlots(resolvedNow);

    return {
      active_campaign: activeCampaign,
      campaigns,
      monthly_price: normalizeMonthlyPrice(monthlyPrice),
      home_slot_monthly_prices: normalizeHomeSlotPrices(homeSlotMonthlyPrices, monthlyPrice),
      home_slot_availability: {
        1: !occupiedHomeSlots.has(1),
        2: !occupiedHomeSlots.has(2),
        3: !occupiedHomeSlots.has(3),
        4: !occupiedHomeSlots.has(4),
      },
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

  async getPortalStats(input: {
    campaign_id: number;
    airport_id: number;
    applicant_account_id: number;
    application_id: number;
    page: number;
  }, now: Date = new Date()): Promise<PortalAirportAdStatsView> {
    if (!Number.isInteger(input.page) || input.page <= 0) {
      throw new HttpError(400, 'BAD_REQUEST', 'page must be positive integer');
    }

    const [campaignRows] = await this.pool.query<CampaignStatsOwnerRow[]>(
      `SELECT id AS campaign_id,
              DATE_FORMAT(tracking_started_at, '%Y-%m-%d %H:%i:%s') AS tracking_started_at,
              DATE_FORMAT(ends_at, '%Y-%m-%d %H:%i:%s') AS ends_at
         FROM airport_ad_campaigns
        WHERE id = ?
          AND airport_id = ?
          AND applicant_account_id = ?
          AND application_id = ?
        LIMIT 1`,
      [input.campaign_id, input.airport_id, input.applicant_account_id, input.application_id],
    );
    const campaign = campaignRows[0];
    if (!campaign) {
      throw new HttpError(404, 'AIRPORT_AD_CAMPAIGN_NOT_FOUND', '投放不存在或不属于当前账户');
    }

    return this.aggregateCampaignStats(campaign, input.page, now);
  }

  async listAdminStats(input: {
    page: number;
    keyword?: string;
    status: AdminAirportAdStatusFilter;
    placement: AdminAirportAdPlacementFilter;
  }, now: Date = new Date()): Promise<AdminAirportAdStatsListView> {
    if (!Number.isInteger(input.page) || input.page <= 0) {
      throw new HttpError(400, 'BAD_REQUEST', 'page must be positive integer');
    }
    const nowSql = formatSqlDateTimeInTimezone(now);
    const where: string[] = [];
    const whereParams: unknown[] = [];
    const keyword = input.keyword?.trim();
    if (keyword) {
      where.push('(airport.name LIKE ? OR campaign.coupon_code LIKE ?)');
      whereParams.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (input.status === 'active') {
      where.push("campaign.status = 'active' AND campaign.ends_at > ?");
      whereParams.push(nowSql);
    } else if (input.status === 'expired') {
      where.push("campaign.status = 'active' AND campaign.ends_at <= ?");
      whereParams.push(nowSql);
    } else if (input.status === 'canceled') {
      where.push("campaign.status = 'canceled'");
    }
    if (input.placement === 'deal') {
      where.push('campaign.home_slot IS NULL');
    } else if (input.placement !== 'all') {
      const slot = Number(input.placement.slice('home_'.length));
      if (!isAirportHomeAdSlot(slot)) {
        throw new HttpError(400, 'BAD_REQUEST', 'invalid placement');
      }
      where.push('campaign.home_slot = ?');
      whereParams.push(slot);
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const [countRows] = await this.pool.query<CountRow[]>(
      `SELECT COUNT(*) AS total
         FROM airport_ad_campaigns campaign
         JOIN airports airport ON airport.id = campaign.airport_id
         ${whereSql}`,
      whereParams,
    );
    const total = Number(countRows[0]?.total || 0);
    const offset = (input.page - 1) * ADMIN_AD_STATS_PAGE_SIZE;
    const [rows] = await this.pool.query<AdminCampaignStatsListRow[]>(
      `WITH filtered_campaigns AS (
         SELECT
           campaign.id AS campaign_id,
           campaign.airport_id,
           airport.name AS airport_name,
           airport.slug AS airport_slug,
           campaign.coupon_code,
           campaign.home_slot,
           DATE_FORMAT(campaign.starts_at, '%Y-%m-%d %H:%i:%s') AS starts_at,
           DATE_FORMAT(campaign.ends_at, '%Y-%m-%d %H:%i:%s') AS ends_at,
           campaign.purchased_months,
           campaign.status AS campaign_status,
           DATE_FORMAT(campaign.tracking_started_at, '%Y-%m-%d %H:%i:%s') AS tracking_started_at,
           DATE_FORMAT(campaign.created_at, '%Y-%m-%d %H:%i:%s') AS created_at
         FROM airport_ad_campaigns campaign
         JOIN airports airport ON airport.id = campaign.airport_id
         ${whereSql}
         ORDER BY campaign.created_at DESC, campaign.id DESC
         LIMIT ? OFFSET ?
       )
       SELECT
         campaign.*,
         SUM(CASE WHEN event.event_type = 'airport_impression' THEN 1 ELSE 0 END) AS impressions,
         SUM(CASE WHEN event.event_type = 'outbound_click' THEN 1 ELSE 0 END) AS clicks
       FROM filtered_campaigns campaign
       LEFT JOIN marketing_events event
         ON event.campaign_id = campaign.campaign_id
        AND campaign.tracking_started_at IS NOT NULL
        AND event.event_date >= DATE(campaign.tracking_started_at)
        AND event.event_date <= LEAST(DATE(campaign.ends_at), DATE(?))
        AND event.event_type IN ('airport_impression', 'outbound_click')
       GROUP BY campaign.campaign_id, campaign.airport_id, campaign.airport_name,
                campaign.airport_slug, campaign.coupon_code, campaign.home_slot,
                campaign.starts_at, campaign.ends_at, campaign.purchased_months,
                campaign.campaign_status, campaign.tracking_started_at, campaign.created_at
       ORDER BY campaign.created_at DESC, campaign.campaign_id DESC`,
      [...whereParams, ADMIN_AD_STATS_PAGE_SIZE, offset, nowSql],
    );
    return {
      items: rows.map((row) => toAdminStatsListItem(row, nowSql)),
      pagination: {
        page: input.page,
        page_size: ADMIN_AD_STATS_PAGE_SIZE,
        total,
        total_pages: Math.ceil(total / ADMIN_AD_STATS_PAGE_SIZE),
      },
    };
  }

  async getAdminStats(input: {
    campaign_id: number;
    page: number;
  }, now: Date = new Date()): Promise<AdminAirportAdStatsView> {
    if (!Number.isInteger(input.page) || input.page <= 0) {
      throw new HttpError(400, 'BAD_REQUEST', 'page must be positive integer');
    }
    const [campaignRows] = await this.pool.query<AdminCampaignStatsOwnerRow[]>(
      `SELECT campaign.id AS campaign_id,
              campaign.airport_id,
              airport.name AS airport_name,
              airport.slug AS airport_slug,
              campaign.coupon_code,
              campaign.home_slot,
              DATE_FORMAT(campaign.starts_at, '%Y-%m-%d %H:%i:%s') AS starts_at,
              DATE_FORMAT(campaign.ends_at, '%Y-%m-%d %H:%i:%s') AS ends_at,
              campaign.purchased_months,
              campaign.status AS campaign_status,
              DATE_FORMAT(campaign.tracking_started_at, '%Y-%m-%d %H:%i:%s') AS tracking_started_at
         FROM airport_ad_campaigns campaign
         JOIN airports airport ON airport.id = campaign.airport_id
        WHERE campaign.id = ?
        LIMIT 1`,
      [input.campaign_id],
    );
    const campaign = campaignRows[0];
    if (!campaign) {
      throw new HttpError(404, 'AIRPORT_AD_CAMPAIGN_NOT_FOUND', '投放不存在');
    }
    const stats = await this.aggregateCampaignStats(campaign, input.page, now);
    const nowSql = formatSqlDateTimeInTimezone(now);
    const homeSlot = normalizeHomeSlotOrNull(campaign.home_slot);
    return {
      ...stats,
      airport_id: Number(campaign.airport_id),
      airport_name: String(campaign.airport_name),
      airport_slug: String(campaign.airport_slug || ''),
      coupon_code: String(campaign.coupon_code),
      home_slot: homeSlot,
      starts_at: sqlDateTimeToTimezoneIso(campaign.starts_at),
      ends_at: sqlDateTimeToTimezoneIso(campaign.ends_at),
      purchased_months: Number(campaign.purchased_months),
      status: deriveAdminCampaignStatus(campaign.campaign_status, campaign.ends_at, nowSql),
    };
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
      const homeSlot = input.home_slot ?? null;
      if (homeSlot !== null) {
        assertHomeSlot(homeSlot);
        await this.assertHomeSlotAvailableForUpdate(connection, homeSlot, nowSql);
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
           is_stackable, refund_supported, discount_percent, home_slot,
           purchased_months, billed_amount, starts_at, ends_at, tracking_started_at, status, display_order
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
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
          homeSlot,
          input.months,
          amount,
          nowSql,
          nextEndsAtSql,
          nowSql,
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
          `${homeSlot ? `首页 ${homeSlot} 号位` : '优惠活动'}投放扣费 ¥${amount.toFixed(2)}（${input.months}个月）`,
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
      const existingHomeSlot = isAirportHomeAdSlot(Number(existing.home_slot))
        ? Number(existing.home_slot) as AirportHomeAdSlot
        : null;
      if (input.extend_months > 0 && existingHomeSlot !== null) {
        await this.assertHomeSlotAvailableForUpdate(
          connection,
          existingHomeSlot,
          nowSql,
          existing.id,
        );
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
            `${existingHomeSlot ? `首页 ${existingHomeSlot} 号位` : '优惠活动'}续期扣费 ¥${amount.toFixed(2)}（${input.extend_months}个月）`,
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

  async renew(input: AirportAdCampaignRenewInput, now: Date = new Date()): Promise<AirportDealView> {
    if (!AIRPORT_AD_ALLOWED_MONTHS.includes(input.months)) {
      throw new HttpError(400, 'BAD_REQUEST', '投放月份不支持');
    }

    const monthlyPrice = normalizeMonthlyPrice(input.monthly_price);
    const amount = roundMoney(monthlyPrice * input.months);
    const nowSql = formatSqlDateTimeInTimezone(now);
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const existing = await this.getRenewableCampaignForUpdate(connection, input);
      if (!existing) {
        throw new HttpError(
          409,
          'AIRPORT_AD_CAMPAIGN_NOT_RENEWABLE',
          '投放不存在、已下架或不属于当前机场',
        );
      }

      const homeSlot = isAirportHomeAdSlot(Number(existing.home_slot))
        ? Number(existing.home_slot) as AirportHomeAdSlot
        : null;
      if (homeSlot !== null) {
        await this.assertHomeSlotAvailableForUpdate(connection, homeSlot, nowSql, existing.id);
      }

      const wallet = await this.ensureWalletForAccount(connection, input);
      if (Number(wallet.balance) < amount) {
        throw new HttpError(409, 'AIRPORT_AD_BALANCE_INSUFFICIENT', '余额不足，无法延长广告投放');
      }
      const nextBalance = roundMoney(Number(wallet.balance) - amount);
      await connection.execute<ResultSetHeader>(
        'UPDATE applicant_wallets SET balance = ? WHERE id = ?',
        [nextBalance, wallet.id],
      );

      const existingEndsAt = new Date(sqlDateTimeToTimezoneIso(existing.ends_at));
      const isExpired = existingEndsAt.getTime() <= now.getTime();
      const nextStartsAtSql = isExpired ? nowSql : existing.starts_at;
      const nextEndsAtSql = formatSqlDateTimeInTimezone(addMonths(isExpired ? now : existingEndsAt, input.months));
      await connection.execute<ResultSetHeader>(
        `UPDATE airport_ad_campaigns
            SET starts_at = ?,
                ends_at = ?,
                tracking_started_at = COALESCE(tracking_started_at, ?),
                purchased_months = purchased_months + ?,
                billed_amount = billed_amount + ?,
                updated_at = NOW()
          WHERE id = ?`,
        [nextStartsAtSql, nextEndsAtSql, nowSql, input.months, amount, input.campaign_id],
      );
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
          `${homeSlot ? `首页 ${homeSlot} 号位` : '优惠活动'}延期扣费 ¥${amount.toFixed(2)}（${input.months}个月）`,
        ],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const campaign = await this.getDealByCampaignId(input.campaign_id);
    if (!campaign) {
      throw new Error('failed to load renewed airport ad campaign');
    }
    return campaign;
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

  private async aggregateCampaignStats(
    campaign: CampaignStatsOwnerRow,
    page: number,
    now: Date,
  ): Promise<PortalAirportAdStatsView> {
    const trackingStartedOn = campaign.tracking_started_at?.slice(0, 10) || null;
    if (!trackingStartedOn) {
      return emptyPortalStats(campaign.campaign_id, page);
    }

    const today = getDateInTimezone('Asia/Shanghai', now);
    const campaignEndsOn = String(campaign.ends_at).slice(0, 10);
    const statsEndsOn = campaignEndsOn < today ? campaignEndsOn : today;
    const total = statsEndsOn < trackingStartedOn ? 0 : diffDays(trackingStartedOn, statsEndsOn) + 1;
    if (total === 0) {
      return {
        ...emptyPortalStats(campaign.campaign_id, page),
        tracking_started_on: trackingStartedOn,
      };
    }

    const [summaryRows] = await this.pool.query<CampaignStatsAggregateRow[]>(
      `SELECT
         SUM(CASE WHEN event_type = 'airport_impression' THEN 1 ELSE 0 END) AS impressions,
         SUM(CASE WHEN event_type = 'outbound_click' THEN 1 ELSE 0 END) AS clicks
       FROM marketing_events
       WHERE campaign_id = ?
         AND event_date BETWEEN ? AND ?
         AND event_type IN ('airport_impression', 'outbound_click')`,
      [campaign.campaign_id, trackingStartedOn, statsEndsOn],
    );
    const impressions = Number(summaryRows[0]?.impressions || 0);
    const clicks = Number(summaryRows[0]?.clicks || 0);
    const offset = (page - 1) * PORTAL_AD_STATS_PAGE_SIZE;
    const pageEndsOn = dateDaysAgo(statsEndsOn, offset);
    const requestedStart = dateDaysAgo(pageEndsOn, PORTAL_AD_STATS_PAGE_SIZE - 1);
    const pageStartsOn = requestedStart < trackingStartedOn ? trackingStartedOn : requestedStart;
    const daily: PortalAirportAdStatsView['daily'] = [];

    if (offset < total) {
      const [dailyRows] = await this.pool.query<CampaignStatsDailyRow[]>(
        `SELECT
           DATE_FORMAT(event_date, '%Y-%m-%d') AS event_date,
           SUM(CASE WHEN event_type = 'airport_impression' THEN 1 ELSE 0 END) AS impressions,
           SUM(CASE WHEN event_type = 'outbound_click' THEN 1 ELSE 0 END) AS clicks
         FROM marketing_events
         WHERE campaign_id = ?
           AND event_date BETWEEN ? AND ?
           AND event_type IN ('airport_impression', 'outbound_click')
         GROUP BY event_date
         ORDER BY event_date DESC`,
        [campaign.campaign_id, pageStartsOn, pageEndsOn],
      );
      const valuesByDate = new Map(dailyRows.map((row) => [String(row.event_date).slice(0, 10), row]));
      for (let index = 0; index < Math.min(PORTAL_AD_STATS_PAGE_SIZE, total - offset); index += 1) {
        const date = dateDaysAgo(pageEndsOn, index);
        const row = valuesByDate.get(date);
        const dayImpressions = Number(row?.impressions || 0);
        const dayClicks = Number(row?.clicks || 0);
        daily.push({
          date,
          impressions: dayImpressions,
          clicks: dayClicks,
          ctr: computeAdCtr(dayClicks, dayImpressions),
        });
      }
    }

    return {
      campaign_id: campaign.campaign_id,
      tracking_started_on: trackingStartedOn,
      summary: { impressions, clicks, ctr: computeAdCtr(clicks, impressions) },
      daily,
      pagination: {
        page,
        page_size: PORTAL_AD_STATS_PAGE_SIZE,
        total,
        total_pages: Math.ceil(total / PORTAL_AD_STATS_PAGE_SIZE),
      },
    };
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
        DATE_FORMAT(airport.founded_on, '%Y-%m-%d') AS founded_on,
        airport.airport_intro,
        airport.tags_json,
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
        campaign.home_slot,
        DATE_FORMAT(campaign.tracking_started_at, '%Y-%m-%d %H:%i:%s') AS tracking_started_at,
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

  private async getDealByCampaignId(campaignId: number): Promise<AirportDealView | null> {
    const [rows] = await this.pool.query<CampaignRow[]>(
      `${this.selectDealSql()}
        WHERE campaign.id = ?
        LIMIT 1`,
      [campaignId],
    );
    return rows[0] ? toDealView(rows[0]) : null;
  }

  private async listActiveHomeSlots(now: Date): Promise<Set<AirportHomeAdSlot>> {
    const nowSql = formatSqlDateTimeInTimezone(now);
    const [rows] = await this.pool.query<ActiveHomeSlotRow[]>(
      `SELECT id, home_slot
         FROM airport_ad_campaigns
        WHERE status = 'active'
          AND starts_at <= ?
          AND ends_at > ?
          AND home_slot IS NOT NULL
        ORDER BY home_slot ASC, id ASC`,
      [nowSql, nowSql],
    );
    return new Set(
      rows
        .map((row) => Number(row.home_slot))
        .filter(isAirportHomeAdSlot),
    );
  }

  private async assertHomeSlotAvailableForUpdate(
    connection: PoolConnection,
    homeSlot: AirportHomeAdSlot,
    nowSql: string,
    excludeCampaignId?: number,
  ): Promise<void> {
    const params: Array<string | number> = [homeSlot, nowSql, nowSql];
    const excludeSql = excludeCampaignId ? 'AND id <> ?' : '';
    if (excludeCampaignId) {
      params.push(excludeCampaignId);
    }
    const [rows] = await connection.query<ActiveHomeSlotRow[]>(
      `SELECT id, home_slot
         FROM airport_ad_campaigns
        WHERE home_slot = ?
          AND status = 'active'
          AND starts_at <= ?
          AND ends_at > ?
          ${excludeSql}
        LIMIT 1
        FOR UPDATE`,
      params,
    );
    if (rows.length > 0) {
      throw new HttpError(
        409,
        'AIRPORT_HOME_AD_SLOT_OCCUPIED',
        `首页 ${homeSlot} 号位正在投放中，请选择其他位置`,
      );
    }
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
              display_order,
              home_slot
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

  private async getRenewableCampaignForUpdate(
    connection: PoolConnection,
    input: Pick<AirportAdCampaignRenewInput, 'campaign_id' | 'airport_id' | 'applicant_account_id' | 'application_id'>,
  ): Promise<ActiveCampaignRow | null> {
    const [rows] = await connection.query<ActiveCampaignRow[]>(
      `SELECT id, airport_id, wallet_id,
              DATE_FORMAT(starts_at, '%Y-%m-%d %H:%i:%s') AS starts_at,
              DATE_FORMAT(ends_at, '%Y-%m-%d %H:%i:%s') AS ends_at,
              purchased_months,
              billed_amount,
              display_order,
              home_slot,
              DATE_FORMAT(tracking_started_at, '%Y-%m-%d %H:%i:%s') AS tracking_started_at
         FROM airport_ad_campaigns
        WHERE id = ?
          AND airport_id = ?
          AND applicant_account_id = ?
          AND application_id = ?
          AND status = 'active'
        LIMIT 1
        FOR UPDATE`,
      [input.campaign_id, input.airport_id, input.applicant_account_id, input.application_id],
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

  private async ensureColumn(table: string, columnName: string, definition: string): Promise<void> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS count
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?`,
      [table, columnName],
    );
    if (Number(rows[0]?.count || 0) === 0) {
      await this.pool.query(`ALTER TABLE ${table} ADD COLUMN ${columnName} ${definition}`);
    }
  }

  private async ensureIndex(table: string, indexName: string, createSql: string): Promise<void> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS count
         FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND INDEX_NAME = ?`,
      [table, indexName],
    );
    if (Number(rows[0]?.count || 0) === 0) {
      await this.pool.query(createSql);
    }
  }
}

function toAdminStatsListItem(
  row: AdminCampaignStatsListRow,
  nowSql: string,
): AdminAirportAdStatsListView['items'][number] {
  const impressions = Number(row.impressions || 0);
  const clicks = Number(row.clicks || 0);
  return {
    campaign_id: Number(row.campaign_id),
    airport_id: Number(row.airport_id),
    airport_name: String(row.airport_name),
    airport_slug: String(row.airport_slug || ''),
    coupon_code: String(row.coupon_code),
    home_slot: normalizeHomeSlotOrNull(row.home_slot),
    starts_at: sqlDateTimeToTimezoneIso(row.starts_at),
    ends_at: sqlDateTimeToTimezoneIso(row.ends_at),
    purchased_months: Number(row.purchased_months),
    status: deriveAdminCampaignStatus(row.campaign_status, row.ends_at, nowSql),
    tracking_started_on: row.tracking_started_at?.slice(0, 10) || null,
    summary: { impressions, clicks, ctr: computeAdCtr(clicks, impressions) },
  };
}

function deriveAdminCampaignStatus(
  campaignStatus: 'active' | 'canceled',
  endsAt: string,
  nowSql: string,
): AdminAirportAdDerivedStatus {
  if (campaignStatus === 'canceled') {
    return 'canceled';
  }
  return String(endsAt) > nowSql ? 'active' : 'expired';
}

function normalizeHomeSlotOrNull(value: number | null): AirportHomeAdSlot | null {
  const slot = Number(value);
  return isAirportHomeAdSlot(slot) ? slot : null;
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
    plan_price_month: Number(row.plan_price_month || 0),
    founded_on: row.founded_on || null,
    airport_intro: row.airport_intro || '',
    tags: normalizeStringList(row.tags_json),
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
    home_slot: isAirportHomeAdSlot(Number(row.home_slot)) ? Number(row.home_slot) as AirportHomeAdSlot : null,
    is_homepage: isAirportHomeAdSlot(Number(row.home_slot)),
    tracking_started_at: row.tracking_started_at ? sqlDateTimeToTimezoneIso(row.tracking_started_at) : null,
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

function createDefaultHomeSlotPrices(fallback: unknown): AirportHomeAdSlotPrices {
  const monthlyPrice = normalizeMonthlyPrice(fallback);
  return {
    1: monthlyPrice,
    2: monthlyPrice,
    3: monthlyPrice,
    4: monthlyPrice,
  };
}

function normalizeHomeSlotPrices(
  value: Partial<AirportHomeAdSlotPrices> | null | undefined,
  fallback: unknown,
): AirportHomeAdSlotPrices {
  const defaults = createDefaultHomeSlotPrices(fallback);
  return {
    1: normalizeMonthlyPrice(value?.[1] ?? defaults[1]),
    2: normalizeMonthlyPrice(value?.[2] ?? defaults[2]),
    3: normalizeMonthlyPrice(value?.[3] ?? defaults[3]),
    4: normalizeMonthlyPrice(value?.[4] ?? defaults[4]),
  };
}

function isAirportHomeAdSlot(value: number): value is AirportHomeAdSlot {
  return (AIRPORT_HOME_AD_SLOTS as readonly number[]).includes(value);
}

function assertHomeSlot(value: number): asserts value is AirportHomeAdSlot {
  if (!isAirportHomeAdSlot(value)) {
    throw new HttpError(400, 'BAD_REQUEST', '请选择首页 1–4 号位');
  }
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function emptyPortalStats(campaignId: number, page: number): PortalAirportAdStatsView {
  return {
    campaign_id: campaignId,
    tracking_started_on: null,
    summary: { impressions: 0, clicks: 0, ctr: null },
    daily: [],
    pagination: { page, page_size: PORTAL_AD_STATS_PAGE_SIZE, total: 0, total_pages: 0 },
  };
}

function computeAdCtr(clicks: number, impressions: number): number | null {
  return impressions > 0 ? Number((clicks / impressions).toFixed(4)) : null;
}
