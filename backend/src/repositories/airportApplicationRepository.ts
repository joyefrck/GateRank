import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type {
  AirportApplication,
  AirportApplicationEmailReply,
  AirportApplicationPaymentStatus,
  AirportApplicationReviewStatus,
  AirportPaymentMethod,
  AirportProfile,
  AirportStatus,
  AirportStreamingSupport,
} from '../types/domain';
import { normalizeAirportProfile } from '../utils/airportProfile';
import { formatDateOnly } from '../utils/time';

interface AirportApplicationRow extends RowDataPacket {
  id: number;
  name: string;
  website: string;
  websites_json: unknown;
  status: AirportStatus;
  plan_price_month: number;
  has_trial: number;
  streaming_support_json: unknown;
  payment_methods_json: unknown;
  payment_crypto_other: string | null;
  airport_profile_json: unknown;
  subscription_url: string | null;
  applicant_email: string;
  applicant_telegram: string;
  founded_on: string;
  airport_intro: string;
  test_account: string;
  test_password: string;
  approved_airport_id: number | null;
  review_status: AirportApplicationReviewStatus;
  payment_status: AirportApplicationPaymentStatus;
  payment_amount: number | null;
  paid_at: string | null;
  must_change_password: number | null;
  review_note: string | null;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AirportApplicationReplyRow extends RowDataPacket {
  id: number;
  application_id: number;
  to_email: string;
  reply_body: string;
  sent_by: string;
  sent_at: string;
  created_at: string;
}

export interface CreateAirportApplicationInput {
  name: string;
  website: string;
  websites?: string[];
  status: AirportStatus;
  plan_price_month: number;
  has_trial: boolean;
  streaming_support?: AirportStreamingSupport[];
  payment_methods?: AirportPaymentMethod[];
  payment_crypto_other?: string | null;
  profile?: AirportProfile;
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
  streaming_support?: AirportStreamingSupport[];
  payment_methods?: AirportPaymentMethod[];
  payment_crypto_other?: string | null;
  profile?: AirportProfile;
  subscription_url?: string | null;
  applicant_email: string;
  applicant_telegram: string;
  founded_on: string;
  airport_intro: string;
  test_account: string;
  test_password: string;
}

export interface UpdateAirportApplicationOperationsInput {
  name: string;
  website: string;
  websites?: string[];
  plan_price_month: number;
  has_trial: boolean;
  streaming_support?: AirportStreamingSupport[];
  payment_methods?: AirportPaymentMethod[];
  payment_crypto_other?: string | null;
  profile?: AirportProfile;
  subscription_url?: string | null;
  applicant_telegram: string;
  founded_on: string;
  airport_intro: string;
  test_account: string;
  test_password: string;
}

export interface CreateAirportApplicationReplyInput {
  application_id: number;
  to_email: string;
  reply_body: string;
  sent_by: string;
  sent_at: string;
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
        streaming_support_json JSON NULL,
        payment_methods_json JSON NULL,
        payment_crypto_other VARCHAR(128) NULL,
        airport_profile_json JSON NULL,
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
        admin_note TEXT NULL,
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

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS airport_application_replies (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        application_id BIGINT UNSIGNED NOT NULL,
        to_email VARCHAR(255) NOT NULL,
        reply_body TEXT NOT NULL,
        sent_by VARCHAR(128) NOT NULL,
        sent_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_airport_application_replies_application_sent_at (application_id, sent_at DESC, id DESC),
        CONSTRAINT fk_airport_application_replies_application
          FOREIGN KEY (application_id) REFERENCES airport_applications(id)
          ON DELETE CASCADE
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
    await this.ensureColumn('streaming_support_json', 'JSON NULL AFTER has_trial');
    await this.ensureColumn('payment_methods_json', 'JSON NULL AFTER streaming_support_json');
    await this.ensureColumn('payment_crypto_other', 'VARCHAR(128) NULL AFTER payment_methods_json');
    await this.ensureColumn('airport_profile_json', 'JSON NULL AFTER payment_crypto_other');
    await this.ensureColumn('subscription_url', 'VARCHAR(1024) NULL AFTER airport_profile_json');
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
    await this.ensureColumn('admin_note', 'TEXT NULL AFTER review_note');
    await this.ensureColumn('reviewed_by', 'VARCHAR(128) NULL AFTER admin_note');
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
    await this.pool.query(
      `UPDATE airport_applications
          SET streaming_support_json = JSON_ARRAY()
        WHERE streaming_support_json IS NULL
           OR JSON_TYPE(streaming_support_json) != 'ARRAY'`,
    );
    await this.pool.query(
      `UPDATE airport_applications
          SET payment_methods_json = JSON_ARRAY()
        WHERE payment_methods_json IS NULL
           OR JSON_TYPE(payment_methods_json) != 'ARRAY'`,
    );
    await this.pool.query(
      `UPDATE airport_applications
          SET airport_profile_json = JSON_OBJECT()
        WHERE airport_profile_json IS NULL
           OR JSON_TYPE(airport_profile_json) != 'OBJECT'`,
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
        streaming_support_json,
        payment_methods_json,
        payment_crypto_other,
        airport_profile_json,
        subscription_url,
        applicant_email,
        applicant_telegram,
        founded_on,
        airport_intro,
        test_account,
        test_password,
        review_status,
        payment_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_payment', 'unpaid')`,
      [
        input.name,
        websites[0],
        JSON.stringify(websites),
        input.status,
        input.plan_price_month,
        input.has_trial ? 1 : 0,
        JSON.stringify(input.streaming_support || []),
        JSON.stringify(input.payment_methods || []),
        input.payment_crypto_other || null,
        JSON.stringify(normalizeAirportProfile(input.profile)),
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
    paymentStatus?: AirportApplicationPaymentStatus;
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

    if (query.paymentStatus) {
      where.push('payment_status = ?');
      args.push(query.paymentStatus);
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
         airport_applications.streaming_support_json,
         airport_applications.payment_methods_json,
         airport_applications.payment_crypto_other,
         airport_applications.airport_profile_json,
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
         airport_applications.admin_note,
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
         airport_applications.streaming_support_json,
         airport_applications.payment_methods_json,
         airport_applications.payment_crypto_other,
         airport_applications.airport_profile_json,
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
         airport_applications.admin_note,
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
    const application = toAirportApplicationEntity(rows[0]);
    return {
      ...application,
      email_replies: await this.listEmailReplies(id),
    };
  }

  async listEmailReplies(applicationId: number): Promise<AirportApplicationEmailReply[]> {
    const [rows] = await this.pool.query<AirportApplicationReplyRow[]>(
      `SELECT
         id,
         application_id,
         to_email,
         reply_body,
         sent_by,
         sent_at,
         created_at
       FROM airport_application_replies
       WHERE application_id = ?
       ORDER BY sent_at DESC, id DESC`,
      [applicationId],
    );

    return rows.map(toAirportApplicationReplyEntity);
  }

  async createEmailReply(input: CreateAirportApplicationReplyInput): Promise<number> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO airport_application_replies (
        application_id,
        to_email,
        reply_body,
        sent_by,
        sent_at
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        input.application_id,
        input.to_email,
        input.reply_body,
        input.sent_by,
        input.sent_at,
      ],
    );

    return result.insertId;
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

  async updateApplicantOperations(id: number, input: UpdateAirportApplicationOperationsInput): Promise<boolean> {
    const websites = normalizeWebsiteList(input.websites, input.website);
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE airport_applications
          SET name = ?,
              website = ?,
              websites_json = ?,
              plan_price_month = ?,
              has_trial = ?,
              streaming_support_json = ?,
              payment_methods_json = ?,
              payment_crypto_other = ?,
              airport_profile_json = ?,
              subscription_url = ?,
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
        JSON.stringify(input.streaming_support || []),
        JSON.stringify(input.payment_methods || []),
        input.payment_crypto_other || null,
        JSON.stringify(normalizeAirportProfile(input.profile)),
        input.subscription_url || null,
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

  async updateApplicantEmail(id: number, applicantEmail: string): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE airport_applications
          SET applicant_email = ?
        WHERE id = ?`,
      [applicantEmail, id],
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

  async updateAdminNote(id: number, adminNote: string | null): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE airport_applications
          SET admin_note = ?
        WHERE id = ?`,
      [adminNote, id],
    );

    return result.affectedRows > 0;
  }

  async deleteUnpaid(id: number): Promise<boolean> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [applications] = await connection.execute<RowDataPacket[]>(
        `SELECT id
           FROM airport_applications
          WHERE id = ?
            AND payment_status = 'unpaid'
          LIMIT 1
          FOR UPDATE`,
        [id],
      );
      if (applications.length === 0) {
        await connection.rollback();
        return false;
      }

      const [accounts] = await connection.execute<RowDataPacket[]>(
        `SELECT id
           FROM applicant_accounts
          WHERE application_id = ?`,
        [id],
      );
      const accountIds = accounts.map((account) => Number(account.id)).filter((accountId) => Number.isFinite(accountId));
      if (accountIds.length > 0) {
        await executeDeleteByIds(connection, 'applicant_x_oauth_flows', 'applicant_account_id', accountIds);
        await executeDeleteByIds(connection, 'applicant_recharge_orders', 'applicant_account_id', accountIds);
      }

      await connection.execute('DELETE FROM applicant_wallets WHERE application_id = ?', [id]);
      await connection.execute('DELETE FROM applicant_accounts WHERE application_id = ?', [id]);
      await connection.execute('DELETE FROM application_payment_orders WHERE application_id = ?', [id]);
      await connection.execute('DELETE FROM airport_application_replies WHERE application_id = ?', [id]);
      const [result] = await connection.execute<ResultSetHeader>(
        `DELETE FROM airport_applications
          WHERE id = ?
            AND payment_status = 'unpaid'`,
        [id],
      );

      await connection.commit();
      return result.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
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

async function executeDeleteByIds(
  connection: PoolConnection,
  tableName: string,
  columnName: string,
  ids: number[],
): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  const placeholders = ids.map(() => '?').join(', ');
  await connection.execute(
    `DELETE FROM ${tableName} WHERE ${columnName} IN (${placeholders})`,
    ids,
  );
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
    streaming_support: safeJsonArray(row.streaming_support_json) as AirportStreamingSupport[],
    payment_methods: safeJsonArray(row.payment_methods_json) as AirportPaymentMethod[],
    payment_crypto_other: row.payment_crypto_other,
    profile: normalizeAirportProfile(row.airport_profile_json),
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
    admin_note: row.admin_note,
    reviewed_by: row.reviewed_by,
    reviewed_at: toDateTimeString(row.reviewed_at),
    created_at: toDateTimeString(row.created_at),
    updated_at: toDateTimeString(row.updated_at),
  };
}

function toAirportApplicationReplyEntity(row: AirportApplicationReplyRow): AirportApplicationEmailReply {
  return {
    id: Number(row.id),
    application_id: Number(row.application_id),
    to_email: row.to_email,
    reply_body: row.reply_body,
    sent_by: row.sent_by,
    sent_at: toDateTimeString(row.sent_at),
    created_at: toDateTimeString(row.created_at),
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
