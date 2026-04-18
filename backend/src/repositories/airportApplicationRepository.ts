import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type {
  AirportApplication,
  AirportApplicationReviewStatus,
  AirportStatus,
} from '../types/domain';
import { formatDateOnly } from '../utils/time';

interface AirportApplicationRow extends RowDataPacket {
  id: number;
  name: string;
  website: string;
  websites_json: unknown;
  status: AirportStatus;
  plan_price_month: number;
  has_trial: number;
  subscription_url: string | null;
  applicant_email: string;
  applicant_telegram: string;
  founded_on: string;
  airport_intro: string;
  test_account: string;
  test_password: string;
  approved_airport_id: number | null;
  review_status: AirportApplicationReviewStatus;
  payment_status: 'unpaid' | 'paid';
  payment_amount: number | null;
  paid_at: string | null;
  must_change_password: number | null;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAirportApplicationInput {
  name: string;
  website: string;
  websites?: string[];
  status: AirportStatus;
  plan_price_month: number;
  has_trial: boolean;
  subscription_url?: string | null;
  applicant_email: string;
  applicant_telegram: string;
  founded_on: string;
  airport_intro: string;
  test_account: string;
  test_password: string;
}

export interface ReviewAirportApplicationInput {
  review_status: Exclude<AirportApplicationReviewStatus, 'pending' | 'awaiting_payment'>;
  review_note?: string | null;
  approved_airport_id?: number | null;
  reviewed_by: string;
  reviewed_at: string;
}

export interface UpdateAirportApplicationInput {
  name: string;
  website: string;
  websites?: string[];
  plan_price_month: number;
  has_trial: boolean;
  subscription_url?: string | null;
  applicant_email: string;
  applicant_telegram: string;
  founded_on: string;
  airport_intro: string;
  test_account: string;
  test_password: string;
}

export class AirportApplicationRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS airport_applications (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        name VARCHAR(128) NOT NULL,
        website VARCHAR(512) NOT NULL,
        websites_json JSON NULL,
        status ENUM('normal', 'risk', 'down') NOT NULL DEFAULT 'normal',
        plan_price_month DECIMAL(10,2) NOT NULL,
        has_trial TINYINT(1) NOT NULL DEFAULT 0,
        subscription_url VARCHAR(1024) NULL,
        applicant_email VARCHAR(255) NOT NULL,
        applicant_telegram VARCHAR(128) NOT NULL,
        founded_on DATE NOT NULL,
        airport_intro TEXT NOT NULL,
        test_account VARCHAR(255) NOT NULL,
        test_password VARCHAR(255) NOT NULL,
        approved_airport_id BIGINT UNSIGNED NULL,
        review_status ENUM('awaiting_payment', 'pending', 'reviewed', 'rejected') NOT NULL DEFAULT 'awaiting_payment',
        payment_status ENUM('unpaid', 'paid') NOT NULL DEFAULT 'unpaid',
        payment_amount DECIMAL(10,2) NULL,
        paid_at DATETIME NULL,
        review_note TEXT NULL,
        reviewed_by VARCHAR(128) NULL,
        reviewed_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_airport_applications_review_status_created_at (review_status, created_at DESC),
        INDEX idx_airport_applications_name (name),
        INDEX idx_airport_applications_applicant_email (applicant_email)
      )
    `);

    await this.ensureColumn('website', 'VARCHAR(512) NOT NULL AFTER name');
    await this.ensureColumn('websites_json', 'JSON NULL AFTER website');
    await this.ensureColumn(
      'status',
      "ENUM('normal', 'risk', 'down') NOT NULL DEFAULT 'normal' AFTER websites_json",
    );
    await this.ensureColumn('plan_price_month', 'DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER status');
    await this.ensureColumn('has_trial', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER plan_price_month');
    await this.ensureColumn('subscription_url', 'VARCHAR(1024) NULL AFTER has_trial');
    await this.ensureColumn('applicant_email', 'VARCHAR(255) NOT NULL AFTER subscription_url');
    await this.ensureColumn('applicant_telegram', 'VARCHAR(128) NOT NULL AFTER applicant_email');
    await this.ensureColumn('founded_on', 'DATE NOT NULL AFTER applicant_telegram');
    await this.ensureColumn('airport_intro', 'TEXT NOT NULL AFTER founded_on');
    await this.ensureColumn('test_account', 'VARCHAR(255) NOT NULL AFTER airport_intro');
    await this.ensureColumn('test_password', 'VARCHAR(255) NOT NULL AFTER test_account');
    await this.ensureColumn('approved_airport_id', 'BIGINT UNSIGNED NULL AFTER test_password');
    await this.ensureColumn(
      'review_status',
      "ENUM('awaiting_payment', 'pending', 'reviewed', 'rejected') NOT NULL DEFAULT 'awaiting_payment' AFTER approved_airport_id",
    );
    await this.ensureColumn(
      'payment_status',
      "ENUM('unpaid', 'paid') NOT NULL DEFAULT 'unpaid' AFTER review_status",
    );
    await this.ensureColumn('payment_amount', 'DECIMAL(10,2) NULL AFTER payment_status');
    await this.ensureColumn('paid_at', 'DATETIME NULL AFTER payment_amount');
    await this.ensureColumn('review_note', 'TEXT NULL AFTER paid_at');
    await this.ensureColumn('reviewed_by', 'VARCHAR(128) NULL AFTER review_note');
    await this.ensureColumn('reviewed_at', 'DATETIME NULL AFTER reviewed_by');
    await this.pool.query(
      `ALTER TABLE airport_applications
          MODIFY COLUMN review_status
            ENUM('awaiting_payment', 'pending', 'reviewed', 'rejected')
            NOT NULL DEFAULT 'awaiting_payment'`,
    );
    await this.pool.query(
      `ALTER TABLE airport_applications
          MODIFY COLUMN payment_status
            ENUM('unpaid', 'paid')
            NOT NULL DEFAULT 'unpaid'`,
    );

    await this.pool.query(
      `UPDATE airport_applications
          SET websites_json = JSON_ARRAY(website)
        WHERE websites_json IS NULL
           OR JSON_TYPE(websites_json) != 'ARRAY'
           OR JSON_LENGTH(websites_json) = 0`,
    );
  }

  async create(input: CreateAirportApplicationInput): Promise<number> {
    const websites = normalizeWebsiteList(input.websites, input.website);
    const [result] = await this.pool.execute<ResultSetHeader>(
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
        review_status,
        payment_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_payment', 'unpaid')`,
      [
        input.name,
        websites[0],
        JSON.stringify(websites),
        input.status,
        input.plan_price_month,
        input.has_trial ? 1 : 0,
        input.subscription_url || null,
        input.applicant_email,
        input.applicant_telegram,
        input.founded_on,
        input.airport_intro,
        input.test_account,
        input.test_password,
      ],
    );
    return result.insertId;
  }

  async hasBlockingEmail(email: string): Promise<boolean> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT 1
         FROM airport_applications
        WHERE applicant_email = ?
          AND review_status IN ('awaiting_payment', 'pending', 'reviewed')
        LIMIT 1`,
      [email],
    );
    return rows.length > 0;
  }

  async listByQuery(query: {
    keyword?: string;
    reviewStatus?: AirportApplicationReviewStatus;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: AirportApplication[]; total: number }> {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 20));
    const offset = (page - 1) * pageSize;
    const where: string[] = [];
    const args: Array<string | number> = [];

    if (query.reviewStatus) {
      where.push('review_status = ?');
      args.push(query.reviewStatus);
    }

    if (query.keyword) {
      const keyword = `%${query.keyword}%`;
      where.push(
        '(name LIKE ? OR website LIKE ? OR websites_json LIKE ? OR applicant_email LIKE ? OR applicant_telegram LIKE ?)',
      );
      args.push(keyword, keyword, keyword, keyword, keyword);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [totalRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM airport_applications ${whereSql}`,
      args,
    );

    const [rows] = await this.pool.query<AirportApplicationRow[]>(
      `SELECT
         airport_applications.id,
         airport_applications.name,
         airport_applications.website,
         airport_applications.websites_json,
         airport_applications.status,
         airport_applications.plan_price_month,
         airport_applications.has_trial,
         airport_applications.subscription_url,
         airport_applications.applicant_email,
         airport_applications.applicant_telegram,
         airport_applications.founded_on,
         airport_applications.airport_intro,
         airport_applications.test_account,
         airport_applications.test_password,
         airport_applications.approved_airport_id,
         airport_applications.review_status,
         airport_applications.payment_status,
         airport_applications.payment_amount,
         DATE_FORMAT(airport_applications.paid_at, '%Y-%m-%d %H:%i:%s') AS paid_at,
         account.must_change_password AS must_change_password,
         airport_applications.review_note,
         airport_applications.reviewed_by,
         airport_applications.reviewed_at,
         airport_applications.created_at,
         airport_applications.updated_at
       FROM airport_applications
       LEFT JOIN applicant_accounts AS account
         ON account.application_id = airport_applications.id
       ${whereSql}
       ORDER BY airport_applications.created_at DESC, airport_applications.id DESC
       LIMIT ? OFFSET ?`,
      [...args, pageSize, offset],
    );

    return {
      total: Number(totalRows[0]?.total || 0),
      items: rows.map(toAirportApplicationEntity),
    };
  }

  async getById(id: number): Promise<AirportApplication | null> {
    const [rows] = await this.pool.query<AirportApplicationRow[]>(
      `SELECT
         airport_applications.id,
         airport_applications.name,
         airport_applications.website,
         airport_applications.websites_json,
         airport_applications.status,
         airport_applications.plan_price_month,
         airport_applications.has_trial,
         airport_applications.subscription_url,
         airport_applications.applicant_email,
         airport_applications.applicant_telegram,
         airport_applications.founded_on,
         airport_applications.airport_intro,
         airport_applications.test_account,
         airport_applications.test_password,
         airport_applications.approved_airport_id,
         airport_applications.review_status,
         airport_applications.payment_status,
         airport_applications.payment_amount,
         DATE_FORMAT(airport_applications.paid_at, '%Y-%m-%d %H:%i:%s') AS paid_at,
         account.must_change_password AS must_change_password,
         airport_applications.review_note,
         airport_applications.reviewed_by,
         airport_applications.reviewed_at,
         airport_applications.created_at,
         airport_applications.updated_at
       FROM airport_applications
       LEFT JOIN applicant_accounts AS account
         ON account.application_id = airport_applications.id
       WHERE airport_applications.id = ?
       LIMIT 1`,
      [id],
    );

    if (rows.length === 0) {
      return null;
    }
    return toAirportApplicationEntity(rows[0]);
  }

  async review(id: number, input: ReviewAirportApplicationInput): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE airport_applications
          SET review_status = ?, review_note = ?, approved_airport_id = ?, reviewed_by = ?, reviewed_at = ?
        WHERE id = ?
          AND review_status = 'pending'`,
      [
        input.review_status,
        input.review_note || null,
        input.approved_airport_id || null,
        input.reviewed_by,
        input.reviewed_at,
        id,
      ],
    );

    return result.affectedRows > 0;
  }

  async updateApplicantDraft(id: number, input: UpdateAirportApplicationInput): Promise<boolean> {
    const websites = normalizeWebsiteList(input.websites, input.website);
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE airport_applications
          SET name = ?,
              website = ?,
              websites_json = ?,
              plan_price_month = ?,
              has_trial = ?,
              subscription_url = ?,
              applicant_email = ?,
              applicant_telegram = ?,
              founded_on = ?,
              airport_intro = ?,
              test_account = ?,
              test_password = ?
        WHERE id = ?`,
      [
        input.name,
        websites[0],
        JSON.stringify(websites),
        input.plan_price_month,
        input.has_trial ? 1 : 0,
        input.subscription_url || null,
        input.applicant_email,
        input.applicant_telegram,
        input.founded_on,
        input.airport_intro,
        input.test_account,
        input.test_password,
        id,
      ],
    );

    return result.affectedRows > 0;
  }

  async markPaid(id: number, paymentAmount: number, paidAt: string): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE airport_applications
          SET payment_status = 'paid',
              payment_amount = ?,
              paid_at = COALESCE(paid_at, ?),
              review_status = CASE
                WHEN review_status = 'awaiting_payment' THEN 'pending'
                ELSE review_status
              END
        WHERE id = ?
          AND payment_status != 'paid'`,
      [paymentAmount, paidAt, id],
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
      ['airport_applications', columnName],
    );

    if (rows.length === 0) {
      await this.pool.query(
        `ALTER TABLE airport_applications ADD COLUMN ${columnName} ${definition}`,
      );
    }
  }
}

function normalizeWebsiteList(websites?: string[], primaryWebsite?: string): string[] {
  const ordered = [primaryWebsite || '', ...(websites || [])]
    .map((value) => value.trim())
    .filter(Boolean);
  const unique = [...new Set(ordered)];
  return unique.length > 0 ? unique : [''];
}

function safeJsonArray(value: unknown): string[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map(String);
  }
  if (typeof value === 'object') {
    return [];
  }
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function toAirportApplicationEntity(row: AirportApplicationRow): AirportApplication {
  const websites = normalizeWebsiteList(safeJsonArray(row.websites_json), row.website);
  return {
    id: row.id,
    name: row.name,
    website: websites[0],
    websites,
    status: row.status,
    plan_price_month: Number(row.plan_price_month),
    has_trial: !!row.has_trial,
    subscription_url: row.subscription_url,
    applicant_email: row.applicant_email,
    applicant_telegram: row.applicant_telegram,
    founded_on: formatDateOnly(row.founded_on),
    airport_intro: row.airport_intro,
    test_account: row.test_account,
    test_password: row.test_password,
    approved_airport_id: row.approved_airport_id == null ? null : Number(row.approved_airport_id),
    review_status: row.review_status,
    payment_status: row.payment_status || 'unpaid',
    payment_amount: row.payment_amount == null ? null : Number(row.payment_amount),
    paid_at: toDateTimeString(row.paid_at),
    must_change_password:
      row.must_change_password == null ? null : Boolean(row.must_change_password),
    review_note: row.review_note,
    reviewed_by: row.reviewed_by,
    reviewed_at: toDateTimeString(row.reviewed_at),
    created_at: toDateTimeString(row.created_at),
    updated_at: toDateTimeString(row.updated_at),
  };
}

function toDateTimeString(value: unknown): string {
  if (!value) {
    return '';
  }
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    const hours = String(value.getHours()).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    const seconds = String(value.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
  const raw = String(value);
  const sqlMatch = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  if (sqlMatch) {
    return `${sqlMatch[1]} ${sqlMatch[2]}`;
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return toDateTimeString(parsed);
  }
  return raw;
}
