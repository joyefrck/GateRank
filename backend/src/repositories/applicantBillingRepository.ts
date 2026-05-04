import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { CLICK_CHARGE_AMOUNT, CLICK_DEDUPE_HOURS } from '../config/billing';
import { sqlDateTimeToTimezoneIso } from '../utils/time';

export type BillingPaymentChannel = 'alipay' | 'wxpay';
export type BillingOrderStatus = 'created' | 'paid' | 'failed' | 'expired' | 'canceled';
export type WalletTransactionType = 'recharge' | 'click_charge' | 'adjustment';
export type ClickBillingStatus = 'billed' | 'duplicate' | 'insufficient_balance' | 'unlisted' | 'no_wallet';

export interface ApplicantWalletView {
  id: number;
  applicant_account_id: number;
  application_id: number;
  airport_id: number | null;
  balance: number;
  auto_unlisted_at: string | null;
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

interface WalletRow extends RowDataPacket {
  id: number;
  applicant_account_id: number;
  application_id: number;
  airport_id: number | null;
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
}

export interface ProcessOutboundClickResult {
  status: ClickBillingStatus;
  billed_amount: number;
  airport_name: string;
  balance_after: number | null;
}

export class ApplicantBillingRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS applicant_wallets (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        applicant_account_id BIGINT UNSIGNED NOT NULL,
        application_id BIGINT UNSIGNED NOT NULL,
        airport_id BIGINT UNSIGNED NULL,
        balance DECIMAL(10,2) NOT NULL DEFAULT 0,
        auto_unlisted_at DATETIME NULL,
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
        channel ENUM('alipay', 'wxpay') NOT NULL,
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
        MODIFY COLUMN status ENUM('created', 'paid', 'failed', 'expired', 'canceled') NOT NULL DEFAULT 'created'
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS applicant_wallet_transactions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        wallet_id BIGINT UNSIGNED NOT NULL,
        applicant_account_id BIGINT UNSIGNED NOT NULL,
        application_id BIGINT UNSIGNED NOT NULL,
        airport_id BIGINT UNSIGNED NULL,
        transaction_type ENUM('recharge', 'click_charge', 'adjustment') NOT NULL,
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
        billing_status ENUM('billed', 'duplicate', 'insufficient_balance', 'unlisted', 'no_wallet') NOT NULL,
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

  async listWalletsByAirportIds(airportIds: number[]): Promise<Map<number, ApplicantWalletView>> {
    const ids = [...new Set(airportIds.filter((id) => Number.isInteger(id) && id > 0))];
    if (ids.length === 0) {
      return new Map();
    }

    const placeholders = ids.map(() => '?').join(', ');
    const [rows] = await this.pool.query<WalletRow[]>(
      `SELECT id, applicant_account_id, application_id, airport_id, balance,
              DATE_FORMAT(auto_unlisted_at, '%Y-%m-%d %H:%i:%s') AS auto_unlisted_at,
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
      const [rows] = await connection.query<WalletRow[]>(
        `SELECT id, applicant_account_id, application_id, airport_id, balance,
                DATE_FORMAT(auto_unlisted_at, '%Y-%m-%d %H:%i:%s') AS auto_unlisted_at,
                DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
                DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
           FROM applicant_wallets
          WHERE airport_id = ?
          LIMIT 1
          FOR UPDATE`,
        [input.airport_id],
      );
      const wallet = rows[0];
      if (!wallet) {
        await connection.rollback();
        return null;
      }

      const amount = roundMoney(input.amount);
      const nextBalance = roundMoney(Number(wallet.balance) + amount);
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

  async getWalletByAccountId(applicantAccountId: number): Promise<ApplicantWalletView | null> {
    const [rows] = await this.pool.query<WalletRow[]>(
      `SELECT id, applicant_account_id, application_id, airport_id, balance,
              DATE_FORMAT(auto_unlisted_at, '%Y-%m-%d %H:%i:%s') AS auto_unlisted_at,
              DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
              DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
         FROM applicant_wallets
        WHERE applicant_account_id = ?
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

  async listRechargeOrders(applicantAccountId: number, limit = 20): Promise<RechargeOrderView[]> {
    const [rows] = await this.pool.query<RechargeOrderRow[]>(
      `SELECT id, applicant_account_id, out_trade_no, gateway_trade_no, channel, amount, status,
              pay_type, pay_info, notify_payload_json,
              DATE_FORMAT(paid_at, '%Y-%m-%d %H:%i:%s') AS paid_at,
              DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
         FROM applicant_recharge_orders
        WHERE applicant_account_id = ?
        ORDER BY id DESC
        LIMIT ?`,
      [applicantAccountId, limit],
    );
    return rows.map(toRechargeOrder);
  }

  async markRechargePaidAndCredit(
    outTradeNo: string,
    input: {
      gateway_trade_no?: string | null;
      pay_type?: string | null;
      pay_info?: string | null;
      notify_payload_json?: Record<string, unknown> | null;
      paid_at: string;
    },
  ): Promise<boolean> {
    const connection = await this.pool.getConnection();
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
        return false;
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
            SET balance = ?
          WHERE id = ?`,
        [nextBalance, wallet.id],
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

      if (wallet.airport_id && wallet.auto_unlisted_at && nextBalance >= CLICK_CHARGE_AMOUNT) {
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
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async listTransactions(applicantAccountId: number, limit = 50): Promise<WalletTransactionView[]> {
    const [rows] = await this.pool.query<TransactionRow[]>(
      `SELECT id, transaction_type, amount, balance_after, reference_type, reference_id, description,
              DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
         FROM applicant_wallet_transactions
        WHERE applicant_account_id = ?
        ORDER BY id DESC
        LIMIT ?`,
      [applicantAccountId, limit],
    );
    return rows.map(toTransaction);
  }

  async listClicks(applicantAccountId: number, limit = 50): Promise<ApplicantClickView[]> {
    const [rows] = await this.pool.query<ClickRow[]>(
      `SELECT c.id, c.click_id, c.airport_id, a.name AS airport_name, c.placement, c.target_kind,
              c.target_url, c.billing_status, c.billed_amount,
              DATE_FORMAT(c.occurred_at, '%Y-%m-%d %H:%i:%s') AS occurred_at
         FROM outbound_click_records c
         LEFT JOIN airports a ON a.id = c.airport_id
        WHERE c.applicant_account_id = ?
        ORDER BY c.id DESC
        LIMIT ?`,
      [applicantAccountId, limit],
    );
    return rows.map(toClick);
  }

  async processOutboundClick(input: ProcessOutboundClickInput): Promise<ProcessOutboundClickResult> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [ownerRows] = await connection.query<AirportOwnerRow[]>(
        `SELECT
           a.id AS airport_id,
           a.name AS airport_name,
           a.is_listed,
           aa.id AS applicant_account_id,
           ap.id AS application_id,
           w.id AS wallet_id,
           w.balance
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
      if (!owner) {
        throw new Error('airport not found');
      }

      if (!owner.is_listed) {
        await this.insertClick(connection, input, owner, 'unlisted', 0);
        await connection.commit();
        return { status: 'unlisted', billed_amount: 0, airport_name: owner.airport_name, balance_after: owner.balance == null ? null : Number(owner.balance) };
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
      }

      if (!owner.wallet_id || !owner.applicant_account_id || !owner.application_id) {
        await this.insertClick(connection, input, owner, 'no_wallet', 0);
        await connection.commit();
        return { status: 'no_wallet', billed_amount: 0, airport_name: owner.airport_name, balance_after: owner.balance == null ? null : Number(owner.balance) };
      }

      const balance = Number(owner.balance || 0);
      if (balance < CLICK_CHARGE_AMOUNT) {
        await this.autoUnlistAirport(connection, Number(owner.wallet_id), input.airport_id);
        await this.insertClick(connection, input, owner, 'insufficient_balance', 0);
        await connection.commit();
        return { status: 'insufficient_balance', billed_amount: 0, airport_name: owner.airport_name, balance_after: balance };
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
        return { status: 'duplicate', billed_amount: 0, airport_name: owner.airport_name, balance_after: balance };
      }

      const nextBalance = roundMoney(balance - CLICK_CHARGE_AMOUNT);
      await connection.execute<ResultSetHeader>(
        `UPDATE applicant_wallets
            SET balance = ?
          WHERE id = ?`,
        [nextBalance, owner.wallet_id],
      );
      await this.insertClick(connection, input, owner, 'billed', CLICK_CHARGE_AMOUNT);
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
          -CLICK_CHARGE_AMOUNT,
          nextBalance,
          input.click_id,
          `外链点击扣费 ¥${CLICK_CHARGE_AMOUNT.toFixed(2)}`,
        ],
      );

      if (nextBalance < CLICK_CHARGE_AMOUNT) {
        await this.autoUnlistAirport(connection, Number(owner.wallet_id), input.airport_id);
      }

      await connection.commit();
      return { status: 'billed', billed_amount: CLICK_CHARGE_AMOUNT, airport_name: owner.airport_name, balance_after: nextBalance };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private async getWalletForAccount(connection: PoolConnection, applicantAccountId: number): Promise<WalletRow | null> {
    const [rows] = await connection.query<WalletRow[]>(
      `SELECT id, applicant_account_id, application_id, airport_id, balance,
              DATE_FORMAT(auto_unlisted_at, '%Y-%m-%d %H:%i:%s') AS auto_unlisted_at,
              DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
              DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
         FROM applicant_wallets
        WHERE applicant_account_id = ?
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

  private async autoUnlistAirport(connection: PoolConnection, walletId: number, airportId: number): Promise<void> {
    await connection.execute<ResultSetHeader>(
      `UPDATE airports
          SET is_listed = 0
        WHERE id = ?`,
      [airportId],
    );
    await connection.execute<ResultSetHeader>(
      `UPDATE applicant_wallets
          SET auto_unlisted_at = COALESCE(auto_unlisted_at, NOW())
        WHERE id = ?`,
      [walletId],
    );
  }
}

function toWallet(row: WalletRow): ApplicantWalletView {
  return {
    id: Number(row.id),
    applicant_account_id: Number(row.applicant_account_id),
    application_id: Number(row.application_id),
    airport_id: row.airport_id == null ? null : Number(row.airport_id),
    balance: Number(row.balance),
    auto_unlisted_at: row.auto_unlisted_at ? sqlDateTimeToTimezoneIso(row.auto_unlisted_at) : null,
    created_at: sqlDateTimeToTimezoneIso(row.created_at),
    updated_at: sqlDateTimeToTimezoneIso(row.updated_at),
  };
}

function toRechargeOrder(row: RechargeOrderRow): RechargeOrderView {
  return {
    id: Number(row.id),
    applicant_account_id: Number(row.applicant_account_id),
    out_trade_no: row.out_trade_no,
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
