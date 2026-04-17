import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { sqlDateTimeToTimezoneIso } from '../utils/time';

export type ApplicationPaymentChannel = 'alipay' | 'wxpay';
export type ApplicationPaymentOrderStatus = 'created' | 'paid' | 'failed' | 'expired';

interface ApplicationPaymentOrderRow extends RowDataPacket {
  id: number;
  application_id: number;
  out_trade_no: string;
  gateway_trade_no: string | null;
  channel: ApplicationPaymentChannel;
  amount: number;
  status: ApplicationPaymentOrderStatus;
  pay_type: string | null;
  pay_info: string | null;
  notify_payload_json: unknown;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationPaymentOrder {
  id: number;
  application_id: number;
  out_trade_no: string;
  gateway_trade_no: string | null;
  channel: ApplicationPaymentChannel;
  amount: number;
  status: ApplicationPaymentOrderStatus;
  pay_type: string | null;
  pay_info: string | null;
  notify_payload_json: Record<string, unknown> | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateApplicationPaymentOrderInput {
  application_id: number;
  out_trade_no: string;
  channel: ApplicationPaymentChannel;
  amount: number;
  status?: ApplicationPaymentOrderStatus;
  gateway_trade_no?: string | null;
  pay_type?: string | null;
  pay_info?: string | null;
}

export class ApplicationPaymentOrderRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS application_payment_orders (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        application_id BIGINT UNSIGNED NOT NULL,
        out_trade_no VARCHAR(64) NOT NULL,
        gateway_trade_no VARCHAR(64) NULL,
        channel ENUM('alipay', 'wxpay') NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        status ENUM('created', 'paid', 'failed', 'expired') NOT NULL DEFAULT 'created',
        pay_type VARCHAR(32) NULL,
        pay_info TEXT NULL,
        notify_payload_json JSON NULL,
        paid_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_application_payment_orders_out_trade_no (out_trade_no),
        INDEX idx_application_payment_orders_application_id (application_id),
        INDEX idx_application_payment_orders_status_created_at (status, created_at DESC)
      )
    `);

    await this.ensureColumn('gateway_trade_no', 'VARCHAR(64) NULL AFTER out_trade_no');
    await this.ensureColumn('pay_type', 'VARCHAR(32) NULL AFTER status');
    await this.ensureColumn('pay_info', 'TEXT NULL AFTER pay_type');
    await this.ensureColumn('notify_payload_json', 'JSON NULL AFTER pay_info');
    await this.ensureColumn('paid_at', 'DATETIME NULL AFTER notify_payload_json');
  }

  async create(input: CreateApplicationPaymentOrderInput): Promise<number> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO application_payment_orders (
         application_id,
         out_trade_no,
         gateway_trade_no,
         channel,
         amount,
         status,
         pay_type,
         pay_info
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.application_id,
        input.out_trade_no,
        input.gateway_trade_no || null,
        input.channel,
        input.amount,
        input.status || 'created',
        input.pay_type || null,
        input.pay_info || null,
      ],
    );
    return result.insertId;
  }

  async getByOutTradeNo(outTradeNo: string): Promise<ApplicationPaymentOrder | null> {
    const [rows] = await this.pool.query<ApplicationPaymentOrderRow[]>(
      `SELECT
         id,
         application_id,
         out_trade_no,
         gateway_trade_no,
         channel,
         amount,
         status,
         pay_type,
         pay_info,
         notify_payload_json,
         DATE_FORMAT(paid_at, '%Y-%m-%d %H:%i:%s') AS paid_at,
         DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
         DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
       FROM application_payment_orders
       WHERE out_trade_no = ?
       LIMIT 1`,
      [outTradeNo],
    );

    return rows[0] ? toApplicationPaymentOrder(rows[0]) : null;
  }

  async getLatestByApplicationId(applicationId: number): Promise<ApplicationPaymentOrder | null> {
    const [rows] = await this.pool.query<ApplicationPaymentOrderRow[]>(
      `SELECT
         id,
         application_id,
         out_trade_no,
         gateway_trade_no,
         channel,
         amount,
         status,
         pay_type,
         pay_info,
         notify_payload_json,
         DATE_FORMAT(paid_at, '%Y-%m-%d %H:%i:%s') AS paid_at,
         DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
         DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
       FROM application_payment_orders
       WHERE application_id = ?
       ORDER BY id DESC
       LIMIT 1`,
      [applicationId],
    );

    return rows[0] ? toApplicationPaymentOrder(rows[0]) : null;
  }

  async markPaid(
    outTradeNo: string,
    input: {
      gateway_trade_no?: string | null;
      pay_type?: string | null;
      pay_info?: string | null;
      notify_payload_json?: Record<string, unknown> | null;
      paid_at: string;
    },
  ): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE application_payment_orders
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
    return result.affectedRows > 0;
  }

  private async ensureColumn(columnName: string, definition: string): Promise<void> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT 1
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
        LIMIT 1`,
      ['application_payment_orders', columnName],
    );

    if (rows.length === 0) {
      await this.pool.query(
        `ALTER TABLE application_payment_orders ADD COLUMN ${columnName} ${definition}`,
      );
    }
  }
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function toApplicationPaymentOrder(
  row: ApplicationPaymentOrderRow,
): ApplicationPaymentOrder {
  return {
    id: Number(row.id),
    application_id: Number(row.application_id),
    out_trade_no: row.out_trade_no,
    gateway_trade_no: row.gateway_trade_no,
    channel: row.channel,
    amount: Number(row.amount),
    status: row.status,
    pay_type: row.pay_type,
    pay_info: row.pay_info,
    notify_payload_json: parseJsonObject(row.notify_payload_json),
    paid_at: row.paid_at ? sqlDateTimeToTimezoneIso(row.paid_at) : null,
    created_at: sqlDateTimeToTimezoneIso(row.created_at),
    updated_at: sqlDateTimeToTimezoneIso(row.updated_at),
  };
}
