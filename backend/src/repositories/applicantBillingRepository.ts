import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { CLICK_CHARGE_AMOUNT, CLICK_DEDUPE_HOURS } from '../config/billing';
import { sqlDateTimeToTimezoneIso } from '../utils/time';
import type { BillingEligibilityService } from '../services/billingEligibilityService';

export const LOW_BALANCE_WARNING_THRESHOLD = 30;

export type BillingPaymentChannel = 'alipay' | 'wxpay' | 'usdt';
export type BillingOrderStatus = 'created' | 'paid' | 'failed' | 'expired' | 'canceled';
export type WalletTransactionType = 'recharge' | 'click_charge' | 'ad_campaign_charge' | 'adjustment';
export type ClickBillingStatus = 'billed' | 'duplicate' | 'free' | 'insufficient_balance' | 'unlisted' | 'no_wallet';
export type BillingMailNotificationType = 'low_balance_warning' | 'airport_auto_unlisted' | 'airport_online';

export interface BillingMailNotificationEvent {
  type: BillingMailNotificationType;
  to: string;
  applicantAccountId?: number | null;
  airportName: string;
  balance: number;
  thresholdAmount: number;
}

export interface ApplicantWalletView {
  id: number;
  applicant_account_id: number;
  application_id: number;
  airport_id: number | null;
  airport_is_listed?: boolean | null;
  balance: number;
  auto_unlisted_at: string | null;
  low_balance_notified_at?: string | null;
  applicant_email?: string | null;
  airport_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminWalletAdjustmentInput {
  airport_id: number;
  amount: number;
  description: string;
  reference_id: string;
}

export interface RechargeOrderView {
  id: number;
  applicant_account_id: number;
  out_trade_no: string;
  gateway_trade_no: string | null;
  channel: BillingPaymentChannel;
  amount: number;
  status: BillingOrderStatus;
  pay_type: string | null;
  pay_info: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface WalletTransactionView {
  id: number;
  transaction_type: WalletTransactionType;
  amount: number;
  balance_after: number;
  reference_type: string | null;
  reference_id: string | null;
  description: string;
  created_at: string;
}

export interface PaginatedBillingRecords<T> {
  items: T[];
  total: number;
}

export interface ApplicantClickView {
  id: number;
  click_id: string;
  airport_id: number;
  airport_name: string | null;
  placement: string;
  target_kind: string;
  target_url: string;
  billing_status: ClickBillingStatus;
  billed_amount: number;
  occurred_at: string;
}

export interface LegacyWalletBackfillResult {
  applicationsCreated: number;
  accountsCreated: number;
  walletsLinked: number;
  walletsCreated: number;
}

interface WalletRow extends RowDataPacket {
  id: number;
  applicant_account_id: number;
  application_id: number;
  airport_id: number | null;
  airport_is_listed?: number | null;
  balance: number;
  auto_unlisted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface RechargeOrderRow extends RowDataPacket {
  id: number;
  applicant_account_id: number;
  out_trade_no: string;
  gateway_trade_no: string | null;
  channel: BillingPaymentChannel;
  amount: number;
  status: BillingOrderStatus;
  pay_type: string | null;
  pay_info: string | null;
  notify_payload_json: unknown;
  paid_at: string | null;
  created_at: string;
}

interface TransactionRow extends RowDataPacket {
  id: number;
  transaction_type: WalletTransactionType;
  amount: number;
  balance_after: number;
  reference_type: string | null;
  reference_id: string | null;
  description: string;
  created_at: string;
}

interface ClickRow extends RowDataPacket {
  id: number;
  click_id: string;
  airport_id: number;
  airport_name: string | null;
  placement: string;
  target_kind: string;
  target_url: string;
  billing_status: ClickBillingStatus;
  billed_amount: number;
  occurred_at: string;
}

interface AirportOwnerRow extends RowDataPacket {
  airport_id: number;
  airport_name: string;
  is_listed: number;
  applicant_account_id: number | null;
  application_id: number | null;
  wallet_id: number | null;
  balance: number | null;
  auto_unlisted_at: string | null;
  low_balance_notified_at: string | null;
  applicant_email: string | null;
}

interface ListingSyncRow extends RowDataPacket {
  wallet_id: number;
  applicant_account_id: number | null;
  airport_id: number | null;
  airport_name: string | null;
  applicant_email: string | null;
  balance: number;
  auto_unlisted_at: string | null;
  low_balance_notified_at: string | null;
  is_listed: number | null;
}

export interface BillingListingSyncResult {
  checked: number;
  restored: number;
  unlisted: number;
  unchanged: number;
  skipped: number;
  notification_events: BillingMailNotificationEvent[];
}

interface ApplicationIdRow extends RowDataPacket {
  id: number;
}

interface AccountIdRow extends RowDataPacket {
  id: number;
}

export interface ProcessOutboundClickInput {
  click_id: string;
  airport_id: number;
  placement: string;
  target_kind: 'website' | 'subscription_url';
  target_url: string;
  visitor_hash: string;
  session_hash: string;
  occurred_at: string;
  event_date: string;
  click_charge_amount?: number;
}

export interface ProcessOutboundClickResult {
  status: ClickBillingStatus;
  billed_amount: number;
  airport_name: string;
  balance_after: number | null;
  notification_events: BillingMailNotificationEvent[];
}

export interface RechargeCreditResult {
  credited: boolean;
  notification_events: BillingMailNotificationEvent[];
}

export type PublicScoreHiddenReason = 'insufficient_balance';

export interface PublicScoreVisibility {
  score_hidden: boolean;
  score_hidden_reason: PublicScoreHiddenReason | null;
}

export class ApplicantBillingRepository {
  constructor(private readonly pool: Pool) {}

  billingEligibility?: BillingEligibilityService;

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS applicant_wallets (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        applicant_account_id BIGINT UNSIGNED NOT NULL,
        application_id BIGINT UNSIGNED NOT NULL,
        airport_id BIGINT UNSIGNED NULL,
        balance DECIMAL(10,2) NOT NULL DEFAULT 0,
        auto_unlisted_at DATETIME NULL,
        low_balance_notified_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_applicant_wallets_account (applicant_account_id),
        INDEX idx_applicant_wallets_application (application_id),
        INDEX idx_applicant_wallets_airport (airport_id)
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS applicant_recharge_orders (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        applicant_account_id BIGINT UNSIGNED NOT NULL,
        out_trade_no VARCHAR(64) NOT NULL,
        gateway_trade_no VARCHAR(64) NULL,
        channel ENUM('alipay', 'wxpay', 'usdt') NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        status ENUM('created', 'paid', 'failed', 'expired', 'canceled') NOT NULL DEFAULT 'created',
        pay_type VARCHAR(32) NULL,
        pay_info TEXT NULL,
        notify_payload_json JSON NULL,
        paid_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_applicant_recharge_orders_out_trade_no (out_trade_no),
        INDEX idx_applicant_recharge_orders_account_created (applicant_account_id, created_at DESC),
        INDEX idx_applicant_recharge_orders_status_created (status, created_at DESC)
      )
    `);

    await this.pool.query(`
      ALTER TABLE applicant_recharge_orders
        MODIFY COLUMN channel ENUM('alipay', 'wxpay', 'usdt') NOT NULL,
        MODIFY COLUMN status ENUM('created', 'paid', 'failed', 'expired', 'canceled') NOT NULL DEFAULT 'created'
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS applicant_wallet_transactions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        wallet_id BIGINT UNSIGNED NOT NULL,
        applicant_account_id BIGINT UNSIGNED NOT NULL,
        application_id BIGINT UNSIGNED NOT NULL,
        airport_id BIGINT UNSIGNED NULL,
        transaction_type ENUM('recharge', 'click_charge', 'ad_campaign_charge', 'adjustment') NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        balance_after DECIMAL(10,2) NOT NULL,
        reference_type VARCHAR(64) NULL,
        reference_id VARCHAR(128) NULL,
        description VARCHAR(255) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_wallet_transactions_account_created (applicant_account_id, created_at DESC),
        INDEX idx_wallet_transactions_wallet_created (wallet_id, created_at DESC),
        UNIQUE KEY uk_wallet_transactions_reference (reference_type, reference_id)
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS outbound_click_records (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        click_id CHAR(36) NOT NULL,
        airport_id BIGINT UNSIGNED NOT NULL,
        applicant_account_id BIGINT UNSIGNED NULL,
        application_id BIGINT UNSIGNED NULL,
        wallet_id BIGINT UNSIGNED NULL,
        occurred_at DATETIME NOT NULL,
        event_date DATE NOT NULL,
        placement VARCHAR(64) NOT NULL,
        target_kind ENUM('website', 'subscription_url') NOT NULL,
        target_url VARCHAR(2048) NOT NULL,
        billing_status ENUM('billed', 'duplicate', 'free', 'insufficient_balance', 'unlisted', 'no_wallet') NOT NULL,
        billed_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        visitor_hash CHAR(64) NOT NULL,
        session_hash CHAR(64) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_outbound_click_records_click_id (click_id),
        INDEX idx_outbound_click_records_airport_visitor_time (airport_id, visitor_hash, occurred_at),
        INDEX idx_outbound_click_records_account_time (applicant_account_id, occurred_at DESC)
      )
    `);

    await this.pool.query(`
      ALTER TABLE outbound_click_records
        MODIFY COLUMN billing_status ENUM('billed', 'duplicate', 'free', 'insufficient_balance', 'unlisted', 'no_wallet') NOT NULL
    `);
    await this.pool.query(`
      ALTER TABLE applicant_wallet_transactions
        MODIFY COLUMN transaction_type ENUM('recharge', 'click_charge', 'ad_campaign_charge', 'adjustment') NOT NULL
    `);

    await this.ensureColumn('low_balance_notified_at', 'DATETIME NULL AFTER auto_unlisted_at');
  }

  async backfillLegacyAirportWallets(): Promise<LegacyWalletBackfillResult> {
    const [applicationResult] = await this.pool.execute<ResultSetHeader>(`
      INSERT INTO airport_applications (
        name,
        website,
        websites_json,
        status,
        plan_price_month,
        has_trial,
        subscription_url,
        applicant_email,
        applicant_telegram,
        founded_on,
        airport_intro,
        test_account,
        test_password,
        approved_airport_id,
        review_status,
        payment_status,
        payment_amount,
        paid_at,
        review_note,
        reviewed_by,
        reviewed_at
      )
      SELECT
        a.name,
        a.website,
        a.websites_json,
        a.status,
        a.plan_price_month,
        a.has_trial,
        a.subscription_url,
        CONCAT('legacy-airport-', a.id, '@gaterank.local'),
        COALESCE(NULLIF(a.applicant_telegram, ''), 'legacy-import'),
        COALESCE(a.founded_on, DATE(a.created_at), CURRENT_DATE()),
        COALESCE(NULLIF(a.airport_intro, ''), CONCAT(a.name, ' 历史机场资料自动补齐')),
        COALESCE(NULLIF(a.test_account, ''), 'legacy-import'),
        COALESCE(NULLIF(a.test_password, ''), 'legacy-import'),
        a.id,
        'reviewed',
        'paid',
        0,
        NOW(),
        '历史机场钱包初始化',
        'system_legacy_wallet_backfill',
        NOW()
        FROM airports a
        LEFT JOIN applicant_wallets airport_wallet ON airport_wallet.airport_id = a.id
        LEFT JOIN airport_applications existing_application ON existing_application.approved_airport_id = a.id
       WHERE airport_wallet.id IS NULL
         AND existing_application.id IS NULL
    `);

    const [accountResult] = await this.pool.execute<ResultSetHeader>(`
      INSERT IGNORE INTO applicant_accounts (
        application_id,
        email,
        password_hash,
        must_change_password
      )
      SELECT
        ap.id,
        CONCAT('legacy-airport-', a.id, '@gaterank.local'),
        'legacy-disabled',
        1
        FROM airports a
        JOIN airport_applications ap ON ap.approved_airport_id = a.id
        LEFT JOIN applicant_wallets airport_wallet ON airport_wallet.airport_id = a.id
        LEFT JOIN applicant_accounts existing_account ON existing_account.application_id = ap.id
       WHERE airport_wallet.id IS NULL
         AND existing_account.id IS NULL
    `);

    const [linkResult] = await this.pool.execute<ResultSetHeader>(`
      UPDATE applicant_wallets wallet
      JOIN applicant_accounts account ON account.id = wallet.applicant_account_id
      JOIN airport_applications ap ON ap.id = account.application_id
      JOIN airports a ON a.id = ap.approved_airport_id
      LEFT JOIN applicant_wallets airport_wallet ON airport_wallet.airport_id = a.id
         SET wallet.airport_id = a.id
       WHERE wallet.airport_id IS NULL
         AND airport_wallet.id IS NULL
    `);

    const [walletResult] = await this.pool.execute<ResultSetHeader>(`
      INSERT IGNORE INTO applicant_wallets (
        applicant_account_id,
        application_id,
        airport_id,
        balance
      )
      SELECT
        account.id,
        ap.id,
        a.id,
        0
        FROM airports a
        JOIN airport_applications ap ON ap.approved_airport_id = a.id
        JOIN applicant_accounts account ON account.application_id = ap.id
        LEFT JOIN applicant_wallets airport_wallet ON airport_wallet.airport_id = a.id
        LEFT JOIN applicant_wallets account_wallet ON account_wallet.applicant_account_id = account.id
       WHERE airport_wallet.id IS NULL
         AND account_wallet.id IS NULL
    `);

    return {
      applicationsCreated: applicationResult.affectedRows,
      accountsCreated: accountResult.affectedRows,
      walletsLinked: linkResult.affectedRows,
      walletsCreated: walletResult.affectedRows,
    };
  }

  async ensureWalletForAccount(applicantAccountId: number, applicationId: number): Promise<ApplicantWalletView> {
    await this.pool.execute<ResultSetHeader>(
      `INSERT IGNORE INTO applicant_wallets (applicant_account_id, application_id, balance)
       VALUES (?, ?, 0)`,
      [applicantAccountId, applicationId],
    );
    const wallet = await this.getWalletByAccountId(applicantAccountId);
    if (!wallet) {
      throw new Error('failed to create applicant wallet');
    }
    return wallet;
  }

  async linkAirportByApplicationId(applicationId: number, airportId: number): Promise<void> {
    await this.pool.execute<ResultSetHeader>(
      `UPDATE applicant_wallets
          SET airport_id = ?
        WHERE application_id = ?
          AND airport_id IS NULL`,
      [airportId, applicationId],
    );
  }

  async clearAutoUnlistedByAirportId(airportId: number): Promise<number> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE applicant_wallets
          SET auto_unlisted_at = NULL
        WHERE airport_id = ?
          AND auto_unlisted_at IS NOT NULL`,
      [airportId],
    );
    return result.affectedRows;
  }

  async listWalletsByAirportIds(airportIds: number[]): Promise<Map<number, ApplicantWalletView>> {
    const ids = [...new Set(airportIds.filter((id) => Number.isInteger(id) && id > 0))];
    if (ids.length === 0) {
      return new Map();
    }

    const placeholders = ids.map(() => '?').join(', ');
    const [rows] = await this.pool.query<WalletRow[]>(
      `SELECT id, applicant_account_id, application_id, airport_id, balance,
              DATE_FORMAT(auto_unlisted_at, '%Y-%m-%d %H:%i:%s') AS auto_unlisted_at,
              DATE_FORMAT(low_balance_notified_at, '%Y-%m-%d %H:%i:%s') AS low_balance_notified_at,
              DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
              DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
         FROM applicant_wallets
        WHERE airport_id IN (${placeholders})`,
      ids,
    );

    return new Map(
      rows
        .filter((row) => row.airport_id != null)
        .map((row) => [Number(row.airport_id), toWallet(row)]),
    );
  }

  async getWalletByAirportId(airportId: number): Promise<ApplicantWalletView | null> {
    const [rows] = await this.pool.query<WalletRow[]>(
      `SELECT id, applicant_account_id, application_id, airport_id, balance,
              DATE_FORMAT(auto_unlisted_at, '%Y-%m-%d %H:%i:%s') AS auto_unlisted_at,
              DATE_FORMAT(low_balance_notified_at, '%Y-%m-%d %H:%i:%s') AS low_balance_notified_at,
              DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
              DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
         FROM applicant_wallets
        WHERE airport_id = ?
        LIMIT 1`,
      [airportId],
    );
    return rows[0] ? toWallet(rows[0]) : null;
  }

  async addWalletBalanceAdjustment(input: AdminWalletAdjustmentInput): Promise<ApplicantWalletView | null> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const wallet = await this.ensureWalletForAirport(connection, input.airport_id);
      if (!wallet) {
        await connection.rollback();
        return null;
      }

      const amount = roundMoney(input.amount);
      const nextBalance = roundMoney(Number(wallet.balance) + amount);
      if (nextBalance < 0) {
        const error = new Error('扣减金额不能超过当前余额') as Error & { code?: string };
        error.code = 'AIRPORT_WALLET_BALANCE_INSUFFICIENT';
        throw error;
      }
      await connection.execute<ResultSetHeader>(
        `UPDATE applicant_wallets
            SET balance = ?
          WHERE id = ?`,
        [nextBalance, wallet.id],
      );
      await connection.execute<ResultSetHeader>(
        `INSERT INTO applicant_wallet_transactions (
           wallet_id, applicant_account_id, application_id, airport_id, transaction_type,
           amount, balance_after, reference_type, reference_id, description
         ) VALUES (?, ?, ?, ?, 'adjustment', ?, ?, 'admin_adjustment', ?, ?)`,
        [
          wallet.id,
          wallet.applicant_account_id,
          wallet.application_id,
          wallet.airport_id,
          amount,
          nextBalance,
          input.reference_id,
          input.description,
        ],
      );

      const [updatedRows] = await connection.query<WalletRow[]>(
        `SELECT id, applicant_account_id, application_id, airport_id, balance,
                DATE_FORMAT(auto_unlisted_at, '%Y-%m-%d %H:%i:%s') AS auto_unlisted_at,
                DATE_FORMAT(low_balance_notified_at, '%Y-%m-%d %H:%i:%s') AS low_balance_notified_at,
                DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
                DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
           FROM applicant_wallets
          WHERE id = ?
          LIMIT 1`,
        [wallet.id],
      );
      await connection.commit();
      return updatedRows[0] ? toWallet(updatedRows[0]) : null;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async syncListingStatusByBalance(clickChargeAmount: number): Promise<BillingListingSyncResult> {
    const minimumBalance = normalizeClickChargeAmount(clickChargeAmount);
    const result: BillingListingSyncResult = {
      checked: 0,
      restored: 0,
      unlisted: 0,
      unchanged: 0,
      skipped: 0,
      notification_events: [],
    };
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<ListingSyncRow[]>(
        `SELECT w.id AS wallet_id,
                w.applicant_account_id,
                w.airport_id,
                a.name AS airport_name,
                aa.email AS applicant_email,
                w.balance,
                DATE_FORMAT(w.auto_unlisted_at, '%Y-%m-%d %H:%i:%s') AS auto_unlisted_at,
                DATE_FORMAT(w.low_balance_notified_at, '%Y-%m-%d %H:%i:%s') AS low_balance_notified_at,
                a.is_listed
           FROM applicant_wallets w
           LEFT JOIN airports a
             ON a.id = w.airport_id
           LEFT JOIN applicant_accounts aa
             ON aa.id = w.applicant_account_id
          WHERE w.airport_id IS NOT NULL
          FOR UPDATE`,
      );

      for (const row of rows) {
        result.checked += 1;
        if (!row.airport_id || row.is_listed === null) {
          result.skipped += 1;
          continue;
        }

        const balance = Number(row.balance || 0);
        const isListed = Boolean(row.is_listed);
        const hasBillingRestriction = Boolean(row.auto_unlisted_at);

        if (balance >= minimumBalance) {
          if (hasBillingRestriction) {
            await connection.execute<ResultSetHeader>(
              `UPDATE airports
                  SET is_listed = 1
                WHERE id = ?`,
              [row.airport_id],
            );
            await connection.execute<ResultSetHeader>(
              `UPDATE applicant_wallets
                  SET auto_unlisted_at = NULL,
                      low_balance_notified_at = CASE WHEN balance >= ? THEN NULL ELSE low_balance_notified_at END
                WHERE id = ?`,
              [LOW_BALANCE_WARNING_THRESHOLD, row.wallet_id],
            );
            pushBillingNotificationEvent(result.notification_events, 'airport_online', row, balance);
            result.restored += 1;
          } else {
            result.unchanged += 1;
          }
          if (balance >= LOW_BALANCE_WARNING_THRESHOLD && row.low_balance_notified_at) {
            await connection.execute<ResultSetHeader>(
              `UPDATE applicant_wallets
                  SET low_balance_notified_at = NULL
                WHERE id = ?`,
              [row.wallet_id],
            );
          }
          if (balance < LOW_BALANCE_WARNING_THRESHOLD && !row.low_balance_notified_at) {
            await connection.execute<ResultSetHeader>(
              `UPDATE applicant_wallets
                  SET low_balance_notified_at = NOW()
                WHERE id = ?`,
              [row.wallet_id],
            );
            pushBillingNotificationEvent(result.notification_events, 'low_balance_warning', row, balance);
          }
          continue;
        }

        if (!isListed && hasBillingRestriction) {
          await connection.execute<ResultSetHeader>(
            `UPDATE airports
                SET is_listed = 1
              WHERE id = ?`,
            [row.airport_id],
          );
          result.restored += 1;
          continue;
        }

        if (!isListed) {
          result.unchanged += 1;
        } else if (!hasBillingRestriction) {
          await connection.execute<ResultSetHeader>(
            `UPDATE applicant_wallets
                SET auto_unlisted_at = COALESCE(auto_unlisted_at, NOW())
              WHERE id = ?`,
            [row.wallet_id],
          );
          pushBillingNotificationEvent(result.notification_events, 'airport_auto_unlisted', row, balance);
          result.unlisted += 1;
        } else {
          result.unchanged += 1;
        }
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

  private async ensureWalletForAirport(
    connection: PoolConnection,
    airportId: number,
  ): Promise<WalletRow | null> {
    const existingWallet = await this.getWalletByAirportIdForUpdate(connection, airportId);
    if (existingWallet) {
      return existingWallet;
    }

    await connection.execute<ResultSetHeader>(
      `INSERT INTO airport_applications (
        name,
        website,
        websites_json,
        status,
        plan_price_month,
        has_trial,
        subscription_url,
        applicant_email,
        applicant_telegram,
        founded_on,
        airport_intro,
        test_account,
        test_password,
        approved_airport_id,
        review_status,
        payment_status,
        payment_amount,
        paid_at,
        review_note,
        reviewed_by,
        reviewed_at
      )
      SELECT
        a.name,
        a.website,
        a.websites_json,
        a.status,
        a.plan_price_month,
        a.has_trial,
        a.subscription_url,
        CONCAT('legacy-airport-', a.id, '@gaterank.local'),
        COALESCE(NULLIF(a.applicant_telegram, ''), 'legacy-import'),
        COALESCE(a.founded_on, DATE(a.created_at), CURRENT_DATE()),
        COALESCE(NULLIF(a.airport_intro, ''), CONCAT(a.name, ' 历史机场资料自动补齐')),
        COALESCE(NULLIF(a.test_account, ''), 'legacy-import'),
        COALESCE(NULLIF(a.test_password, ''), 'legacy-import'),
        a.id,
        'reviewed',
        'paid',
        0,
        NOW(),
        '历史机场钱包初始化',
        'system_legacy_wallet_backfill',
        NOW()
        FROM airports a
        LEFT JOIN airport_applications existing_application ON existing_application.approved_airport_id = a.id
       WHERE a.id = ?
         AND existing_application.id IS NULL`,
      [airportId],
    );

    const [applicationRows] = await connection.query<ApplicationIdRow[]>(
      `SELECT id
         FROM airport_applications
        WHERE approved_airport_id = ?
        ORDER BY id DESC
        LIMIT 1
        FOR UPDATE`,
      [airportId],
    );
    const applicationId = applicationRows[0]?.id;
    if (!applicationId) {
      return null;
    }

    await connection.execute<ResultSetHeader>(
      `INSERT IGNORE INTO applicant_accounts (
        application_id,
        email,
        password_hash,
        must_change_password
      ) VALUES (?, CONCAT('legacy-airport-', ?, '@gaterank.local'), 'legacy-disabled', 1)`,
      [applicationId, airportId],
    );

    const [accountRows] = await connection.query<AccountIdRow[]>(
      `SELECT id
         FROM applicant_accounts
        WHERE application_id = ?
        LIMIT 1
        FOR UPDATE`,
      [applicationId],
    );
    const accountId = accountRows[0]?.id;
    if (!accountId) {
      return null;
    }

    await connection.execute<ResultSetHeader>(
      `UPDATE applicant_wallets
          SET airport_id = ?
        WHERE applicant_account_id = ?
          AND airport_id IS NULL`,
      [airportId, accountId],
    );

    await connection.execute<ResultSetHeader>(
      `INSERT IGNORE INTO applicant_wallets (
        applicant_account_id,
        application_id,
        airport_id,
        balance
      ) VALUES (?, ?, ?, 0)`,
      [accountId, applicationId, airportId],
    );

    return this.getWalletByAirportIdForUpdate(connection, airportId);
  }

  private async getWalletByAirportIdForUpdate(
    connection: PoolConnection,
    airportId: number,
  ): Promise<WalletRow | null> {
    const [rows] = await connection.query<WalletRow[]>(
      `SELECT id, applicant_account_id, application_id, airport_id, balance,
              DATE_FORMAT(auto_unlisted_at, '%Y-%m-%d %H:%i:%s') AS auto_unlisted_at,
              DATE_FORMAT(low_balance_notified_at, '%Y-%m-%d %H:%i:%s') AS low_balance_notified_at,
              DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
              DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
         FROM applicant_wallets
        WHERE airport_id = ?
        LIMIT 1
        FOR UPDATE`,
      [airportId],
    );
    return rows[0] ?? null;
  }

  async getWalletByAccountId(applicantAccountId: number): Promise<ApplicantWalletView | null> {
    const [rows] = await this.pool.query<WalletRow[]>(
      `SELECT w.id, w.applicant_account_id, w.application_id, w.airport_id, w.balance,
              a.is_listed AS airport_is_listed,
              DATE_FORMAT(w.auto_unlisted_at, '%Y-%m-%d %H:%i:%s') AS auto_unlisted_at,
              DATE_FORMAT(w.low_balance_notified_at, '%Y-%m-%d %H:%i:%s') AS low_balance_notified_at,
              DATE_FORMAT(w.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
              DATE_FORMAT(w.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
         FROM applicant_wallets w
         LEFT JOIN airports a ON a.id = w.airport_id
        WHERE w.applicant_account_id = ?
        LIMIT 1`,
      [applicantAccountId],
    );
    return rows[0] ? toWallet(rows[0]) : null;
  }

  async createRechargeOrder(input: {
    applicant_account_id: number;
    out_trade_no: string;
    channel: BillingPaymentChannel;
    amount: number;
    gateway_trade_no?: string | null;
    pay_type?: string | null;
    pay_info?: string | null;
  }): Promise<number> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO applicant_recharge_orders (
         applicant_account_id, out_trade_no, gateway_trade_no, channel, amount, pay_type, pay_info
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.applicant_account_id,
        input.out_trade_no,
        input.gateway_trade_no || null,
        input.channel,
        input.amount,
        input.pay_type || null,
        input.pay_info || null,
      ],
    );
    return result.insertId;
  }

  async getRechargeOrderByOutTradeNo(outTradeNo: string): Promise<RechargeOrderView | null> {
    const [rows] = await this.pool.query<RechargeOrderRow[]>(
      `SELECT id, applicant_account_id, out_trade_no, gateway_trade_no, channel, amount, status,
              pay_type, pay_info, notify_payload_json,
              DATE_FORMAT(paid_at, '%Y-%m-%d %H:%i:%s') AS paid_at,
              DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
         FROM applicant_recharge_orders
        WHERE out_trade_no = ?
        LIMIT 1`,
      [outTradeNo],
    );
    return rows[0] ? toRechargeOrder(rows[0]) : null;
  }

  async cancelRechargeOrder(applicantAccountId: number, outTradeNo: string): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE applicant_recharge_orders
          SET status = 'canceled'
        WHERE applicant_account_id = ?
          AND out_trade_no = ?
          AND status = 'created'`,
      [applicantAccountId, outTradeNo],
    );
    return result.affectedRows > 0;
  }

  async listRechargeOrders(
    applicantAccountId: number,
    page = 1,
    pageSize = 20,
  ): Promise<PaginatedBillingRecords<RechargeOrderView>> {
    const offset = (page - 1) * pageSize;
    const [[countRow], [rows]] = await Promise.all([
      this.pool.query<Array<RowDataPacket & { total: number }>>(
        `SELECT COUNT(*) AS total
           FROM applicant_recharge_orders
          WHERE applicant_account_id = ?`,
        [applicantAccountId],
      ),
      this.pool.query<RechargeOrderRow[]>(
        `SELECT id, applicant_account_id, out_trade_no, gateway_trade_no, channel, amount, status,
                pay_type, pay_info, notify_payload_json,
                DATE_FORMAT(paid_at, '%Y-%m-%d %H:%i:%s') AS paid_at,
                DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
           FROM applicant_recharge_orders
          WHERE applicant_account_id = ?
          ORDER BY id DESC
          LIMIT ? OFFSET ?`,
        [applicantAccountId, pageSize, offset],
      ),
    ]);
    return {
      items: rows.map(toRechargeOrder),
      total: Number(countRow[0]?.total || 0),
    };
  }

  async listRechargeOrdersByAirportId(
    airportId: number,
    page = 1,
    pageSize = 20,
  ): Promise<PaginatedBillingRecords<RechargeOrderView>> {
    const offset = (page - 1) * pageSize;
    const [[countRow], [rows]] = await Promise.all([
      this.pool.query<Array<RowDataPacket & { total: number }>>(
        `SELECT COUNT(*) AS total
           FROM applicant_wallets w
           JOIN applicant_recharge_orders o ON o.applicant_account_id = w.applicant_account_id
          WHERE w.airport_id = ?`,
        [airportId],
      ),
      this.pool.query<RechargeOrderRow[]>(
        `SELECT o.id, o.applicant_account_id, o.out_trade_no, o.gateway_trade_no, o.channel, o.amount, o.status,
                o.pay_type, o.pay_info, o.notify_payload_json,
                DATE_FORMAT(o.paid_at, '%Y-%m-%d %H:%i:%s') AS paid_at,
                DATE_FORMAT(o.created_at, '%Y-%m-%d %H:%i:%s') AS created_at
           FROM applicant_wallets w
           JOIN applicant_recharge_orders o ON o.applicant_account_id = w.applicant_account_id
          WHERE w.airport_id = ?
          ORDER BY o.created_at DESC, o.id DESC
          LIMIT ? OFFSET ?`,
        [airportId, pageSize, offset],
      ),
    ]);
    return {
      items: rows.map(toRechargeOrder),
      total: Number(countRow[0]?.total || 0),
    };
  }

  async markRechargePaidAndCredit(
    outTradeNo: string,
    input: {
      gateway_trade_no?: string | null;
      pay_type?: string | null;
      pay_info?: string | null;
      notify_payload_json?: Record<string, unknown> | null;
      paid_at: string;
      click_charge_amount?: number;
    },
  ): Promise<RechargeCreditResult> {
    const connection = await this.pool.getConnection();
    const notificationEvents: BillingMailNotificationEvent[] = [];
    try {
      await connection.beginTransaction();
      const [orderRows] = await connection.query<RechargeOrderRow[]>(
        `SELECT id, applicant_account_id, amount, status
           FROM applicant_recharge_orders
          WHERE out_trade_no = ?
          LIMIT 1
          FOR UPDATE`,
        [outTradeNo],
      );
      const order = orderRows[0];
      if (!order || order.status === 'paid') {
        await connection.rollback();
        return { credited: false, notification_events: [] };
      }

      await connection.execute<ResultSetHeader>(
        `UPDATE applicant_recharge_orders
            SET gateway_trade_no = COALESCE(?, gateway_trade_no),
                status = 'paid',
                pay_type = COALESCE(?, pay_type),
                pay_info = COALESCE(?, pay_info),
                notify_payload_json = ?,
                paid_at = COALESCE(paid_at, ?)
          WHERE out_trade_no = ?
            AND status != 'paid'`,
        [
          input.gateway_trade_no || null,
          input.pay_type || null,
          input.pay_info || null,
          input.notify_payload_json ? JSON.stringify(input.notify_payload_json) : null,
          input.paid_at,
          outTradeNo,
        ],
      );

      const wallet = await this.getWalletForAccount(connection, Number(order.applicant_account_id));
      if (!wallet) {
        throw new Error('applicant wallet not found for recharge');
      }
      const nextBalance = roundMoney(Number(wallet.balance) + Number(order.amount));
      await connection.execute<ResultSetHeader>(
        `UPDATE applicant_wallets
            SET balance = ?,
                low_balance_notified_at = CASE WHEN ? >= ? THEN NULL ELSE low_balance_notified_at END
          WHERE id = ?`,
        [nextBalance, nextBalance, LOW_BALANCE_WARNING_THRESHOLD, wallet.id],
      );
      await connection.execute<ResultSetHeader>(
        `INSERT IGNORE INTO applicant_wallet_transactions (
           wallet_id, applicant_account_id, application_id, airport_id, transaction_type,
           amount, balance_after, reference_type, reference_id, description
         ) VALUES (?, ?, ?, ?, 'recharge', ?, ?, 'recharge_order', ?, ?)`,
        [
          wallet.id,
          wallet.applicant_account_id,
          wallet.application_id,
          wallet.airport_id,
          Number(order.amount),
          nextBalance,
          outTradeNo,
          `充值入账 ¥${Number(order.amount).toFixed(2)}`,
        ],
      );

      const clickChargeAmount = normalizeClickChargeAmount(input.click_charge_amount);
      if (wallet.airport_id && wallet.auto_unlisted_at && nextBalance >= clickChargeAmount) {
        await connection.execute<ResultSetHeader>(
          `UPDATE airports
              SET is_listed = 1
            WHERE id = ?`,
          [wallet.airport_id],
        );
        await connection.execute<ResultSetHeader>(
          `UPDATE applicant_wallets
              SET auto_unlisted_at = NULL
            WHERE id = ?`,
          [wallet.id],
        );
        pushBillingNotificationEvent(notificationEvents, 'airport_online', wallet, nextBalance);
      }

      await connection.commit();
      return { credited: true, notification_events: notificationEvents };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async listTransactions(
    applicantAccountId: number,
    page = 1,
    pageSize = 20,
  ): Promise<PaginatedBillingRecords<WalletTransactionView>> {
    const offset = (page - 1) * pageSize;
    const [[countRow], [rows]] = await Promise.all([
      this.pool.query<Array<RowDataPacket & { total: number }>>(
        `SELECT COUNT(*) AS total
           FROM applicant_wallet_transactions
          WHERE applicant_account_id = ?`,
        [applicantAccountId],
      ),
      this.pool.query<TransactionRow[]>(
        `SELECT id, transaction_type, amount, balance_after, reference_type, reference_id, description,
                DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
           FROM applicant_wallet_transactions
          WHERE applicant_account_id = ?
          ORDER BY id DESC
          LIMIT ? OFFSET ?`,
        [applicantAccountId, pageSize, offset],
      ),
    ]);
    return {
      items: rows.map(toTransaction),
      total: Number(countRow[0]?.total || 0),
    };
  }

  async listWalletTransactionsByAirportId(
    airportId: number,
    page = 1,
    pageSize = 20,
    transactionTypes?: readonly WalletTransactionType[],
  ): Promise<PaginatedBillingRecords<WalletTransactionView>> {
    const offset = (page - 1) * pageSize;
    const typeFilter = transactionTypes?.length
      ? ` AND t.transaction_type IN (${transactionTypes.map(() => '?').join(', ')})`
      : '';
    const params = transactionTypes?.length ? [airportId, ...transactionTypes] : [airportId];
    const [[countRow], [rows]] = await Promise.all([
      this.pool.query<Array<RowDataPacket & { total: number }>>(
        `SELECT COUNT(*) AS total
           FROM applicant_wallets w
           JOIN applicant_wallet_transactions t ON t.wallet_id = w.id
          WHERE w.airport_id = ?${typeFilter}`,
        params,
      ),
      this.pool.query<TransactionRow[]>(
        `SELECT t.id, t.transaction_type, t.amount, t.balance_after, t.reference_type, t.reference_id, t.description,
                DATE_FORMAT(t.created_at, '%Y-%m-%d %H:%i:%s') AS created_at
           FROM applicant_wallets w
           JOIN applicant_wallet_transactions t ON t.wallet_id = w.id
          WHERE w.airport_id = ?${typeFilter}
          ORDER BY t.created_at DESC, t.id DESC
          LIMIT ? OFFSET ?`,
        [...params, pageSize, offset],
      ),
    ]);
    return {
      items: rows.map(toTransaction),
      total: Number(countRow[0]?.total || 0),
    };
  }

  async listClicks(
    applicantAccountId: number,
    page = 1,
    pageSize = 20,
  ): Promise<PaginatedBillingRecords<ApplicantClickView>> {
    const offset = (page - 1) * pageSize;
    const [[countRow], [rows]] = await Promise.all([
      this.pool.query<Array<RowDataPacket & { total: number }>>(
        `SELECT COUNT(*) AS total
           FROM outbound_click_records
          WHERE applicant_account_id = ?`,
        [applicantAccountId],
      ),
      this.pool.query<ClickRow[]>(
        `SELECT c.id, c.click_id, c.airport_id, a.name AS airport_name, c.placement, c.target_kind,
                c.target_url, c.billing_status, c.billed_amount,
                DATE_FORMAT(c.occurred_at, '%Y-%m-%d %H:%i:%s') AS occurred_at
           FROM outbound_click_records c
           LEFT JOIN airports a ON a.id = c.airport_id
          WHERE c.applicant_account_id = ?
          ORDER BY c.id DESC
          LIMIT ? OFFSET ?`,
        [applicantAccountId, pageSize, offset],
      ),
    ]);
    return {
      items: rows.map(toClick),
      total: Number(countRow[0]?.total || 0),
    };
  }

  async countClicksForDate(applicantAccountId: number, eventDate: string): Promise<number> {
    const [rows] = await this.pool.query<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) AS total
         FROM outbound_click_records
        WHERE applicant_account_id = ?
          AND event_date = ?`,
      [applicantAccountId, eventDate],
    );
    return Number(rows[0]?.total || 0);
  }

  async processOutboundClick(input: ProcessOutboundClickInput): Promise<ProcessOutboundClickResult> {
    let clickChargeAmount = normalizeClickChargeAmount(input.click_charge_amount);
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [ownerRows] = await connection.query<AirportOwnerRow[]>(
        `SELECT
           a.id AS airport_id,
           a.name AS airport_name,
           a.is_listed,
           aa.email AS applicant_email,
           aa.id AS applicant_account_id,
           ap.id AS application_id,
           w.id AS wallet_id,
           w.balance,
           DATE_FORMAT(w.auto_unlisted_at, '%Y-%m-%d %H:%i:%s') AS auto_unlisted_at,
           DATE_FORMAT(w.low_balance_notified_at, '%Y-%m-%d %H:%i:%s') AS low_balance_notified_at
         FROM airports a
         LEFT JOIN airport_applications ap ON ap.approved_airport_id = a.id
         LEFT JOIN applicant_accounts aa ON aa.application_id = ap.id
         LEFT JOIN applicant_wallets w ON w.applicant_account_id = aa.id
         WHERE a.id = ?
         LIMIT 1
         FOR UPDATE`,
        [input.airport_id],
      );
      const owner = ownerRows[0];
      const notificationEvents: BillingMailNotificationEvent[] = [];
      if (!owner) {
        throw new Error('airport not found');
      }

      if (!owner.is_listed) {
        await this.insertClick(connection, input, owner, 'unlisted', 0);
        await connection.commit();
        return {
          status: 'unlisted',
          billed_amount: 0,
          airport_name: owner.airport_name,
          balance_after: owner.balance == null ? null : Number(owner.balance),
          notification_events: [],
        };
      }

      if (!owner.wallet_id && owner.applicant_account_id && owner.application_id) {
        await connection.execute<ResultSetHeader>(
          `INSERT IGNORE INTO applicant_wallets (applicant_account_id, application_id, airport_id, balance)
           VALUES (?, ?, ?, 0)`,
          [owner.applicant_account_id, owner.application_id, input.airport_id],
        );
        const wallet = await this.getWalletForAccount(connection, Number(owner.applicant_account_id));
        owner.wallet_id = wallet?.id || null;
        owner.balance = wallet ? Number(wallet.balance) : null;
        owner.auto_unlisted_at = wallet?.auto_unlisted_at || null;
        owner.low_balance_notified_at = wallet?.low_balance_notified_at || null;
      }

      if (!owner.wallet_id || !owner.applicant_account_id || !owner.application_id) {
        await this.insertClick(connection, input, owner, 'no_wallet', 0);
        await connection.commit();
        return {
          status: 'no_wallet',
          billed_amount: 0,
          airport_name: owner.airport_name,
          balance_after: owner.balance == null ? null : Number(owner.balance),
          notification_events: [],
        };
      }

      const balance = Number(owner.balance || 0);
      if (this.billingEligibility) {
        // Re-evaluate after the wallet lock, not using the pre-transaction route quote.
        const decision = (await this.billingEligibility.getSnapshot(connection, {
          airport_id: input.airport_id, balance,
        })).get(input.airport_id);
        if (!decision) throw new Error('billing eligibility unavailable');
        clickChargeAmount = decision.click_charge_amount;
      }
      if (balance < clickChargeAmount) {
        await this.insertClick(connection, input, owner, 'free', 0);
        await connection.commit();
        return {
          status: 'free',
          billed_amount: 0,
          airport_name: owner.airport_name,
          balance_after: balance,
          notification_events: [],
        };
      }

      const [duplicateRows] = await connection.query<RowDataPacket[]>(
        `SELECT id
           FROM outbound_click_records
          WHERE airport_id = ?
            AND visitor_hash = ?
            AND billing_status = 'billed'
            AND occurred_at >= DATE_SUB(?, INTERVAL ${CLICK_DEDUPE_HOURS} HOUR)
          LIMIT 1`,
        [input.airport_id, input.visitor_hash, input.occurred_at],
      );

      if (duplicateRows.length > 0) {
        await this.insertClick(connection, input, owner, 'duplicate', 0);
        await connection.commit();
        return {
          status: 'duplicate',
          billed_amount: 0,
          airport_name: owner.airport_name,
          balance_after: balance,
          notification_events: [],
        };
      }

      const nextBalance = roundMoney(balance - clickChargeAmount);
      await connection.execute<ResultSetHeader>(
        `UPDATE applicant_wallets
            SET balance = ?
          WHERE id = ?`,
        [nextBalance, owner.wallet_id],
      );
      await this.insertClick(connection, input, owner, 'billed', clickChargeAmount);
      await connection.execute<ResultSetHeader>(
        `INSERT INTO applicant_wallet_transactions (
           wallet_id, applicant_account_id, application_id, airport_id, transaction_type,
           amount, balance_after, reference_type, reference_id, description
         ) VALUES (?, ?, ?, ?, 'click_charge', ?, ?, 'outbound_click', ?, ?)`,
        [
          owner.wallet_id,
          owner.applicant_account_id,
          owner.application_id,
          input.airport_id,
          -clickChargeAmount,
          nextBalance,
          input.click_id,
          `外链点击扣费 ¥${clickChargeAmount.toFixed(2)}`,
        ],
      );

      if (nextBalance < LOW_BALANCE_WARNING_THRESHOLD && !owner.low_balance_notified_at) {
        await connection.execute<ResultSetHeader>(
          `UPDATE applicant_wallets
              SET low_balance_notified_at = NOW()
            WHERE id = ?`,
          [owner.wallet_id],
        );
        pushBillingNotificationEvent(notificationEvents, 'low_balance_warning', owner, nextBalance);
      }

      await connection.commit();
      return {
        status: 'billed',
        billed_amount: clickChargeAmount,
        airport_name: owner.airport_name,
        balance_after: nextBalance,
        notification_events: notificationEvents,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private async getWalletForAccount(connection: PoolConnection, applicantAccountId: number): Promise<WalletRow | null> {
    const [rows] = await connection.query<WalletRow[]>(
      `SELECT w.id, w.applicant_account_id, w.application_id, w.airport_id, w.balance,
              DATE_FORMAT(w.auto_unlisted_at, '%Y-%m-%d %H:%i:%s') AS auto_unlisted_at,
              DATE_FORMAT(w.low_balance_notified_at, '%Y-%m-%d %H:%i:%s') AS low_balance_notified_at,
              DATE_FORMAT(w.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
              DATE_FORMAT(w.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
              aa.email AS applicant_email,
              a.name AS airport_name
         FROM applicant_wallets w
         LEFT JOIN applicant_accounts aa ON aa.id = w.applicant_account_id
         LEFT JOIN airports a ON a.id = w.airport_id
        WHERE w.applicant_account_id = ?
        LIMIT 1
        FOR UPDATE`,
      [applicantAccountId],
    );
    return rows[0] || null;
  }

  private async insertClick(
    connection: PoolConnection,
    input: ProcessOutboundClickInput,
    owner: AirportOwnerRow,
    billingStatus: ClickBillingStatus,
    billedAmount: number,
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      `INSERT INTO outbound_click_records (
         click_id, airport_id, applicant_account_id, application_id, wallet_id,
         occurred_at, event_date, placement, target_kind, target_url,
         billing_status, billed_amount, visitor_hash, session_hash
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.click_id,
        input.airport_id,
        owner.applicant_account_id || null,
        owner.application_id || null,
        owner.wallet_id || null,
        input.occurred_at,
        input.event_date,
        input.placement,
        input.target_kind,
        input.target_url,
        billingStatus,
        billedAmount,
        input.visitor_hash,
        input.session_hash,
      ],
    );
  }

  async getPublicScoreVisibilityByAirportIds(
    airportIds: number[],
    clickChargeAmount: number = CLICK_CHARGE_AMOUNT,
  ): Promise<Map<number, PublicScoreVisibility>> {
    if (this.billingEligibility) {
      const snapshot = await this.billingEligibility.getSnapshot();
      return new Map(airportIds.map((id) => {
        const decision = snapshot.get(id);
        return [id, {
          score_hidden: decision?.score_hidden ?? true,
          score_hidden_reason: decision?.score_hidden === false ? null : 'insufficient_balance',
        }];
      }));
    }
    const uniqueAirportIds = Array.from(new Set(airportIds.map((id) => Number(id)).filter(Number.isFinite)));
    const result = new Map<number, PublicScoreVisibility>();
    for (const airportId of uniqueAirportIds) {
      result.set(airportId, { score_hidden: true, score_hidden_reason: 'insufficient_balance' });
    }
    if (uniqueAirportIds.length === 0) {
      return result;
    }

    const placeholders = uniqueAirportIds.map(() => '?').join(', ');
    const [rows] = await this.pool.query<Array<RowDataPacket & { airport_id: number; balance: number | null }>>(
      `SELECT airport_id, balance
         FROM applicant_wallets
        WHERE airport_id IN (${placeholders})`,
      uniqueAirportIds,
    );
    for (const row of rows) {
      const balance = Number(row.balance || 0);
      result.set(Number(row.airport_id), balance < clickChargeAmount
        ? { score_hidden: true, score_hidden_reason: 'insufficient_balance' }
        : { score_hidden: false, score_hidden_reason: null });
    }

    return result;
  }

  private async markBillingRestricted(connection: PoolConnection, walletId: number): Promise<void> {
    await connection.execute<ResultSetHeader>(
      `UPDATE applicant_wallets
          SET auto_unlisted_at = COALESCE(auto_unlisted_at, NOW())
        WHERE id = ?`,
      [walletId],
    );
  }

  private async ensureColumn(columnName: string, definition: string): Promise<void> {
    try {
      await this.pool.query(`ALTER TABLE applicant_wallets ADD COLUMN ${columnName} ${definition}`);
    } catch (error) {
      if (isDuplicateColumnError(error)) {
        return;
      }
      throw error;
    }
  }
}

function toWallet(row: WalletRow): ApplicantWalletView {
  return {
    id: Number(row.id),
    applicant_account_id: Number(row.applicant_account_id),
    application_id: Number(row.application_id),
    airport_id: row.airport_id == null ? null : Number(row.airport_id),
    airport_is_listed: row.airport_is_listed == null ? null : Boolean(row.airport_is_listed),
    balance: Number(row.balance),
    auto_unlisted_at: row.auto_unlisted_at ? sqlDateTimeToTimezoneIso(row.auto_unlisted_at) : null,
    low_balance_notified_at: row.low_balance_notified_at ? sqlDateTimeToTimezoneIso(row.low_balance_notified_at) : null,
    created_at: sqlDateTimeToTimezoneIso(row.created_at),
    updated_at: sqlDateTimeToTimezoneIso(row.updated_at),
  };
}

function pushBillingNotificationEvent(
  events: BillingMailNotificationEvent[],
  type: BillingMailNotificationType,
  source: {
    applicant_account_id?: number | null;
    applicant_email?: string | null;
    airport_name?: string | null;
    balance?: number | null;
  },
  balance: number,
): void {
  const to = String(source.applicant_email || '').trim();
  const airportName = String(source.airport_name || '').trim();
  if (!to || !airportName) {
    return;
  }
  const event: BillingMailNotificationEvent = {
    type,
    to,
    airportName,
    balance,
    thresholdAmount: LOW_BALANCE_WARNING_THRESHOLD,
  };
  if (source.applicant_account_id != null) {
    event.applicantAccountId = Number(source.applicant_account_id);
  }
  events.push(event);
}

function toRechargeOrder(row: RechargeOrderRow): RechargeOrderView {
  return {
    id: Number(row.id),
    applicant_account_id: Number(row.applicant_account_id),
    out_trade_no: row.out_trade_no,
    gateway_trade_no: row.gateway_trade_no,
    channel: row.channel,
    amount: Number(row.amount),
    status: row.status,
    pay_type: row.pay_type,
    pay_info: row.pay_info,
    paid_at: row.paid_at ? sqlDateTimeToTimezoneIso(row.paid_at) : null,
    created_at: sqlDateTimeToTimezoneIso(row.created_at),
  };
}

function toTransaction(row: TransactionRow): WalletTransactionView {
  return {
    id: Number(row.id),
    transaction_type: row.transaction_type,
    amount: Number(row.amount),
    balance_after: Number(row.balance_after),
    reference_type: row.reference_type,
    reference_id: row.reference_id,
    description: row.description,
    created_at: sqlDateTimeToTimezoneIso(row.created_at),
  };
}

function toClick(row: ClickRow): ApplicantClickView {
  return {
    id: Number(row.id),
    click_id: row.click_id,
    airport_id: Number(row.airport_id),
    airport_name: row.airport_name,
    placement: row.placement,
    target_kind: row.target_kind,
    target_url: row.target_url,
    billing_status: row.billing_status,
    billed_amount: Number(row.billed_amount),
    occurred_at: sqlDateTimeToTimezoneIso(row.occurred_at),
  };
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function normalizeClickChargeAmount(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return CLICK_CHARGE_AMOUNT;
  }
  return roundMoney(amount);
}

function isDuplicateColumnError(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && (
      (error as { code?: unknown }).code === 'ER_DUP_FIELDNAME'
      || (error as { errno?: unknown }).errno === 1060
    ),
  );
}
