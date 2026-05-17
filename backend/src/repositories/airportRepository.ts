import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type {
  Airport,
  AirportProfile,
  AirportPaymentMethod,
  AirportStatus,
  AirportStreamingSupport,
} from '../types/domain';
import { mergeDisplayTags, normalizeTagList } from '../utils/tags';
import { normalizeAirportProfile } from '../utils/airportProfile';
import { buildAirportSlugCandidate, normalizeAirportSlug } from '../../../shared/publicSeo';

const AIRPORT_STREAMING_SUPPORT_VALUES: AirportStreamingSupport[] = [
  'netflix',
  'chatgpt',
  'disney_plus',
  'hbo_max',
  'youtube_premium',
  'tiktok',
  'spotify',
];
const AIRPORT_PAYMENT_METHOD_VALUES: AirportPaymentMethod[] = [
  'wechat',
  'alipay',
  'usdt_trc20',
  'usdt_erc20',
  'usdt_bep20',
  'stripe_card',
  'paypal',
  'crypto_other',
  'unionpay',
];

interface AirportRow extends RowDataPacket {
  id: number;
  application_id: number | null;
  slug: string | null;
  name: string;
  website: string;
  websites_json: unknown;
  status: AirportStatus;
  is_listed: number;
  plan_price_month: number;
  has_trial: number;
  streaming_support_json: unknown;
  payment_methods_json: unknown;
  payment_crypto_other: string | null;
  has_annual_plan: number | null;
  has_telegram_group: number | null;
  telegram_allows_speaking: number | null;
  has_lifetime_plan: number | null;
  airport_profile_json: unknown;
  subscription_url: string | null;
  applicant_email: string | null;
  applicant_account_email: string | null;
  applicant_telegram: string | null;
  telegram_bot_bound: number;
  founded_on: string | null;
  airport_intro: string | null;
  test_account: string | null;
  test_password: string | null;
  manual_tags_json: unknown;
  auto_tags_json: unknown;
  tags_json: unknown;
  paid_application_fee?: number;
  created_at: string;
}

export interface CreateAirportInput {
  slug?: string | null;
  name: string;
  website: string;
  websites?: string[];
  status?: AirportStatus;
  is_listed?: boolean;
  plan_price_month: number;
  has_trial: boolean;
  streaming_support?: AirportStreamingSupport[];
  payment_methods?: AirportPaymentMethod[];
  payment_crypto_other?: string | null;
  has_annual_plan?: boolean | null;
  has_telegram_group?: boolean | null;
  telegram_allows_speaking?: boolean | null;
  has_lifetime_plan?: boolean | null;
  profile?: AirportProfile;
  subscription_url?: string | null;
  applicant_email?: string | null;
  applicant_telegram?: string | null;
  founded_on?: string | null;
  airport_intro?: string | null;
  test_account?: string | null;
  test_password?: string | null;
  manual_tags?: string[];
  tags?: string[];
}

export interface UpdateAirportInput {
  slug?: string | null;
  name?: string;
  website?: string;
  websites?: string[];
  status?: AirportStatus;
  is_listed?: boolean;
  plan_price_month?: number;
  has_trial?: boolean;
  streaming_support?: AirportStreamingSupport[];
  payment_methods?: AirportPaymentMethod[];
  payment_crypto_other?: string | null;
  has_annual_plan?: boolean | null;
  has_telegram_group?: boolean | null;
  telegram_allows_speaking?: boolean | null;
  has_lifetime_plan?: boolean | null;
  profile?: AirportProfile;
  subscription_url?: string | null;
  applicant_email?: string | null;
  applicant_telegram?: string | null;
  founded_on?: string | null;
  airport_intro?: string | null;
  test_account?: string | null;
  test_password?: string | null;
  manual_tags?: string[];
  tags?: string[];
}

export class AirportRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.ensureColumn('slug', 'VARCHAR(160) NULL AFTER id');
    await this.ensureColumn('websites_json', 'JSON NULL AFTER website');
    await this.ensureColumn('is_listed', 'TINYINT(1) NOT NULL DEFAULT 1 AFTER status');
    await this.ensureColumn('streaming_support_json', 'JSON NULL AFTER has_trial');
    await this.ensureColumn('payment_methods_json', 'JSON NULL AFTER streaming_support_json');
    await this.ensureColumn('payment_crypto_other', 'VARCHAR(255) NULL AFTER payment_methods_json');
    await this.ensureColumn('has_annual_plan', 'TINYINT(1) NULL DEFAULT NULL AFTER payment_crypto_other');
    await this.ensureColumn('has_telegram_group', 'TINYINT(1) NULL DEFAULT NULL AFTER has_annual_plan');
    await this.ensureColumn('telegram_allows_speaking', 'TINYINT(1) NULL DEFAULT NULL AFTER has_telegram_group');
    await this.ensureColumn('has_lifetime_plan', 'TINYINT(1) NULL DEFAULT NULL AFTER telegram_allows_speaking');
    await this.ensureColumn('airport_profile_json', 'JSON NULL AFTER has_lifetime_plan');
    await this.ensureColumn('tags_json', 'JSON NULL AFTER subscription_url');
    await this.ensureColumn('manual_tags_json', 'JSON NULL AFTER tags_json');
    await this.ensureColumn('auto_tags_json', 'JSON NULL AFTER manual_tags_json');
    await this.ensureColumn('applicant_email', 'VARCHAR(255) NULL AFTER subscription_url');
    await this.ensureColumn('applicant_telegram', 'VARCHAR(128) NULL AFTER applicant_email');
    await this.ensureColumn('founded_on', 'DATE NULL AFTER applicant_telegram');
    await this.ensureColumn('airport_intro', 'TEXT NULL AFTER founded_on');
    await this.ensureColumn('test_account', 'VARCHAR(255) NULL AFTER airport_intro');
    await this.ensureColumn('test_password', 'VARCHAR(255) NULL AFTER test_account');

    await this.pool.query(
      `UPDATE airports
          SET is_listed = 1
        WHERE is_listed IS NULL`,
    );

    await this.pool.query(
      `UPDATE airports
          SET websites_json = JSON_ARRAY(website)
        WHERE websites_json IS NULL
           OR JSON_TYPE(websites_json) != 'ARRAY'
           OR JSON_LENGTH(websites_json) = 0`,
    );

    await this.pool.query(
      `UPDATE airports
          SET streaming_support_json = JSON_ARRAY()
        WHERE streaming_support_json IS NOT NULL
          AND JSON_TYPE(streaming_support_json) != 'ARRAY'`,
    );

    await this.pool.query(
      `UPDATE airports
          SET payment_methods_json = JSON_ARRAY()
        WHERE payment_methods_json IS NOT NULL
          AND JSON_TYPE(payment_methods_json) != 'ARRAY'`,
    );

    await this.pool.query(
      `UPDATE airports
          SET airport_profile_json = JSON_OBJECT()
        WHERE airport_profile_json IS NULL
           OR JSON_TYPE(airport_profile_json) != 'OBJECT'`,
    );

    await this.pool.query(
      `UPDATE airports
          SET tags_json = JSON_ARRAY()
        WHERE tags_json IS NULL
           OR JSON_TYPE(tags_json) != 'ARRAY'`,
    );

    await this.pool.query(
      `UPDATE airports
          SET manual_tags_json = tags_json
        WHERE manual_tags_json IS NULL
           OR JSON_TYPE(manual_tags_json) != 'ARRAY'`,
    );

    await this.pool.query(
      `UPDATE airports
          SET auto_tags_json = JSON_ARRAY()
        WHERE auto_tags_json IS NULL
           OR JSON_TYPE(auto_tags_json) != 'ARRAY'`,
    );

    await this.backfillSlugs();
    await this.ensureUniqueIndex('uk_airports_slug', 'slug');
  }

  async listAll(): Promise<Airport[]> {
    const [rows] = await this.pool.query<AirportRow[]>(
      `SELECT
         id,
         (
           SELECT application.id
             FROM airport_applications AS application
            WHERE application.approved_airport_id = airports.id
            ORDER BY application.id DESC
            LIMIT 1
         ) AS application_id,
         slug,
         name,
         website,
         websites_json,
         status,
         is_listed,
         plan_price_month,
         has_trial,
         streaming_support_json,
         payment_methods_json,
         payment_crypto_other,
         has_annual_plan,
         has_telegram_group,
         telegram_allows_speaking,
         has_lifetime_plan,
         airport_profile_json,
         subscription_url,
         applicant_email,
         (
           SELECT account.email
             FROM airport_applications AS application
             JOIN applicant_accounts AS account
               ON account.application_id = application.id
            WHERE application.approved_airport_id = airports.id
            ORDER BY application.id DESC
            LIMIT 1
         ) AS applicant_account_email,
         applicant_telegram,
         founded_on,
         airport_intro,
         test_account,
         test_password,
         manual_tags_json,
         auto_tags_json,
         tags_json,
         EXISTS (
           SELECT 1
             FROM airport_applications AS paid_application
            WHERE paid_application.approved_airport_id = airports.id
              AND paid_application.payment_status = 'paid'
              AND paid_application.payment_amount > 0
         ) AS paid_application_fee,
         created_at
         FROM airports
        ORDER BY id ASC`,
    );

    return rows.map((row) => toAirportEntity(row));
  }

  async listByQuery(
    query: { keyword?: string; status?: AirportStatus; isListed?: boolean; page?: number; pageSize?: number },
  ): Promise<{ items: Airport[]; total: number }> {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 20));
    const offset = (page - 1) * pageSize;
    const where: string[] = [];
    const args: Array<string | number> = [];

    if (query.status) {
      where.push('status = ?');
      args.push(query.status);
    }
    if (typeof query.isListed === 'boolean') {
      where.push('is_listed = ?');
      args.push(query.isListed ? 1 : 0);
    }
    if (query.keyword) {
      const applicationId = parseApplicationIdKeyword(query.keyword);
      const k = `%${query.keyword}%`;
      if (applicationId === null) {
        where.push('(name LIKE ? OR website LIKE ? OR websites_json LIKE ?)');
        args.push(k, k, k);
      } else {
        where.push(`(
          name LIKE ?
          OR website LIKE ?
          OR websites_json LIKE ?
          OR EXISTS (
            SELECT 1
              FROM airport_applications AS keyword_application
             WHERE keyword_application.approved_airport_id = airports.id
               AND keyword_application.id = ?
          )
        )`);
        args.push(k, k, k, applicationId);
      }
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [totalRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM airports ${whereSql}`,
      args,
    );
    const total = Number(totalRows[0]?.total || 0);

    const [rows] = await this.pool.query<AirportRow[]>(
      `SELECT
         id,
         (
           SELECT application.id
             FROM airport_applications AS application
            WHERE application.approved_airport_id = airports.id
            ORDER BY application.id DESC
            LIMIT 1
         ) AS application_id,
         slug,
         name,
         website,
         websites_json,
         status,
         is_listed,
         plan_price_month,
         has_trial,
         streaming_support_json,
         payment_methods_json,
         payment_crypto_other,
         has_annual_plan,
         has_telegram_group,
         telegram_allows_speaking,
         has_lifetime_plan,
         airport_profile_json,
         subscription_url,
         applicant_email,
         (
           SELECT account.email
             FROM airport_applications AS application
             JOIN applicant_accounts AS account
               ON account.application_id = application.id
            WHERE application.approved_airport_id = airports.id
           ORDER BY application.id DESC
           LIMIT 1
         ) AS applicant_account_email,
         applicant_telegram,
         EXISTS (
           SELECT 1
             FROM applicant_accounts AS bot_account
             JOIN applicant_telegram_bindings AS bot_binding
               ON bot_binding.applicant_account_id = bot_account.id
            WHERE bot_account.application_id = (
              SELECT bot_application.id
                FROM airport_applications AS bot_application
               WHERE bot_application.approved_airport_id = airports.id
               ORDER BY bot_application.id DESC
               LIMIT 1
            )
            LIMIT 1
         ) AS telegram_bot_bound,
         founded_on,
         airport_intro,
         test_account,
         test_password,
         manual_tags_json,
         auto_tags_json,
         tags_json,
         EXISTS (
           SELECT 1
             FROM airport_applications AS paid_application
            WHERE paid_application.approved_airport_id = airports.id
              AND paid_application.payment_status = 'paid'
              AND paid_application.payment_amount > 0
         ) AS paid_application_fee,
         created_at
         FROM airports
         ${whereSql}
        ORDER BY id DESC
        LIMIT ? OFFSET ?`,
      [...args, pageSize, offset],
    );

    return {
      total,
      items: rows.map((row) => toAirportEntity(row)),
    };
  }

  async getById(id: number): Promise<Airport | null> {
    const [rows] = await this.pool.query<AirportRow[]>(
      `SELECT
         id,
         (
           SELECT application.id
             FROM airport_applications AS application
            WHERE application.approved_airport_id = airports.id
            ORDER BY application.id DESC
            LIMIT 1
         ) AS application_id,
         slug,
         name,
         website,
         websites_json,
         status,
         is_listed,
         plan_price_month,
         has_trial,
         streaming_support_json,
         payment_methods_json,
         payment_crypto_other,
         has_annual_plan,
         has_telegram_group,
         telegram_allows_speaking,
         has_lifetime_plan,
         airport_profile_json,
         subscription_url,
         applicant_email,
         (
           SELECT account.email
             FROM airport_applications AS application
             JOIN applicant_accounts AS account
               ON account.application_id = application.id
            WHERE application.approved_airport_id = airports.id
            ORDER BY application.id DESC
            LIMIT 1
         ) AS applicant_account_email,
         applicant_telegram,
         founded_on,
         airport_intro,
         test_account,
         test_password,
         manual_tags_json,
         auto_tags_json,
         tags_json,
         EXISTS (
           SELECT 1
             FROM airport_applications AS paid_application
            WHERE paid_application.approved_airport_id = airports.id
              AND paid_application.payment_status = 'paid'
              AND paid_application.payment_amount > 0
         ) AS paid_application_fee,
         created_at
         FROM airports
        WHERE id = ?
        LIMIT 1`,
      [id],
    );

    if (rows.length === 0) {
      return null;
    }

    return toAirportEntity(rows[0]);
  }

  async getBySlug(slug: string): Promise<Airport | null> {
    const normalizedSlug = normalizeAirportSlug(slug);
    if (!normalizedSlug) {
      return null;
    }

    const [rows] = await this.pool.query<AirportRow[]>(
      `SELECT
         id,
         (
           SELECT application.id
             FROM airport_applications AS application
            WHERE application.approved_airport_id = airports.id
            ORDER BY application.id DESC
            LIMIT 1
         ) AS application_id,
         slug,
         name,
         website,
         websites_json,
         status,
         is_listed,
         plan_price_month,
         has_trial,
         streaming_support_json,
         payment_methods_json,
         payment_crypto_other,
         has_annual_plan,
         has_telegram_group,
         telegram_allows_speaking,
         has_lifetime_plan,
         airport_profile_json,
         subscription_url,
         applicant_email,
         (
           SELECT account.email
             FROM airport_applications AS application
             JOIN applicant_accounts AS account
               ON account.application_id = application.id
            WHERE application.approved_airport_id = airports.id
            ORDER BY application.id DESC
            LIMIT 1
         ) AS applicant_account_email,
         applicant_telegram,
         founded_on,
         airport_intro,
         test_account,
         test_password,
         manual_tags_json,
         auto_tags_json,
         tags_json,
         EXISTS (
           SELECT 1
             FROM airport_applications AS paid_application
            WHERE paid_application.approved_airport_id = airports.id
              AND paid_application.payment_status = 'paid'
              AND paid_application.payment_amount > 0
         ) AS paid_application_fee,
         created_at
         FROM airports
        WHERE slug = ?
        LIMIT 1`,
      [normalizedSlug],
    );

    if (rows.length === 0) {
      return null;
    }

    return toAirportEntity(rows[0]);
  }

  async getByIds(ids: number[]): Promise<Map<number, Airport>> {
    if (ids.length === 0) {
      return new Map();
    }

    const placeholders = ids.map(() => '?').join(', ');
    const [rows] = await this.pool.query<AirportRow[]>(
      `SELECT
         id,
         (
           SELECT application.id
             FROM airport_applications AS application
            WHERE application.approved_airport_id = airports.id
            ORDER BY application.id DESC
            LIMIT 1
         ) AS application_id,
         slug,
         name,
         website,
         websites_json,
         status,
         is_listed,
         plan_price_month,
         has_trial,
         streaming_support_json,
         payment_methods_json,
         payment_crypto_other,
         has_annual_plan,
         has_telegram_group,
         telegram_allows_speaking,
         has_lifetime_plan,
         airport_profile_json,
         subscription_url,
         applicant_email,
         (
           SELECT account.email
             FROM airport_applications AS application
             JOIN applicant_accounts AS account
               ON account.application_id = application.id
            WHERE application.approved_airport_id = airports.id
            ORDER BY application.id DESC
            LIMIT 1
         ) AS applicant_account_email,
         applicant_telegram,
         founded_on,
         airport_intro,
         test_account,
         test_password,
         manual_tags_json,
         auto_tags_json,
         tags_json,
         EXISTS (
           SELECT 1
             FROM airport_applications AS paid_application
            WHERE paid_application.approved_airport_id = airports.id
              AND paid_application.payment_status = 'paid'
              AND paid_application.payment_amount > 0
         ) AS paid_application_fee,
         created_at
         FROM airports
        WHERE id IN (${placeholders})`,
      ids,
    );

    return new Map(rows.map((row) => [row.id, toAirportEntity(row)]));
  }

  async listLatestApprovedApplicationAirports(limit: number): Promise<Airport[]> {
    const safeLimit = Math.max(0, Math.floor(limit));
    if (safeLimit === 0) {
      return [];
    }

    const [rows] = await this.pool.query<AirportRow[]>(
      `SELECT
         airports.id,
         application.id AS application_id,
         airports.slug,
         airports.name,
         airports.website,
         airports.websites_json,
         airports.status,
         airports.is_listed,
         airports.plan_price_month,
         airports.has_trial,
         airports.streaming_support_json,
         airports.payment_methods_json,
         airports.payment_crypto_other,
         airports.has_annual_plan,
         airports.has_telegram_group,
         airports.telegram_allows_speaking,
         airports.has_lifetime_plan,
         airports.airport_profile_json,
         airports.subscription_url,
         airports.applicant_email,
         account.email AS applicant_account_email,
         airports.applicant_telegram,
         airports.founded_on,
         airports.airport_intro,
         airports.test_account,
         airports.test_password,
         airports.manual_tags_json,
         airports.auto_tags_json,
         airports.tags_json,
         EXISTS (
           SELECT 1
             FROM airport_applications AS paid_application
            WHERE paid_application.approved_airport_id = airports.id
              AND paid_application.payment_status = 'paid'
              AND paid_application.payment_amount > 0
         ) AS paid_application_fee,
         airports.created_at
         FROM airport_applications AS application
         JOIN airports
           ON airports.id = application.approved_airport_id
         LEFT JOIN applicant_accounts AS account
           ON account.application_id = application.id
        WHERE application.review_status = 'reviewed'
          AND application.payment_status = 'paid'
          AND application.approved_airport_id IS NOT NULL
          AND airports.is_listed = 1
          AND airports.status <> 'down'
        ORDER BY COALESCE(application.reviewed_at, application.updated_at, application.created_at) DESC,
                 application.id DESC
        LIMIT ?`,
      [safeLimit],
    );

    const airportsById = new Map<number, Airport>();
    for (const row of rows) {
      if (!airportsById.has(row.id)) {
        airportsById.set(row.id, toAirportEntity(row));
      }
    }
    return Array.from(airportsById.values());
  }

  async create(input: CreateAirportInput): Promise<number> {
    const websites = normalizeWebsiteList(input.websites, input.website);
    const slug = await this.resolveAirportSlug({
      requestedSlug: input.slug,
      name: input.name,
      website: websites[0],
    });
    const manualTags = normalizeTagList(input.manual_tags ?? input.tags ?? []);
    const autoTags: string[] = [];
    const mergedTags = mergeDisplayTags(manualTags, autoTags);
    const [result] = await this.pool.execute<ResultSetHeader>(
       `INSERT INTO airports (
         slug,
         name,
         website,
         websites_json,
         status,
         is_listed,
         plan_price_month,
         has_trial,
         streaming_support_json,
         payment_methods_json,
         payment_crypto_other,
         has_annual_plan,
         has_telegram_group,
         telegram_allows_speaking,
         has_lifetime_plan,
         airport_profile_json,
         subscription_url,
         applicant_email,
         applicant_telegram,
         founded_on,
         airport_intro,
         test_account,
         test_password,
         manual_tags_json,
         auto_tags_json,
         tags_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        slug,
        input.name,
        websites[0],
        JSON.stringify(websites),
        input.status || 'normal',
        input.is_listed === undefined ? 1 : (input.is_listed ? 1 : 0),
        input.plan_price_month,
        input.has_trial ? 1 : 0,
        JSON.stringify(normalizeAirportStreamingSupport(input.streaming_support)),
        JSON.stringify(normalizeAirportPaymentMethods(input.payment_methods)),
        input.payment_crypto_other || null,
        nullableBooleanToDb(input.has_annual_plan),
        nullableBooleanToDb(input.has_telegram_group),
        nullableBooleanToDb(input.telegram_allows_speaking),
        nullableBooleanToDb(input.has_lifetime_plan),
        JSON.stringify(normalizeAirportProfile(input.profile)),
        input.subscription_url || null,
        input.applicant_email || null,
        input.applicant_telegram || null,
        input.founded_on || null,
        input.airport_intro || null,
        input.test_account || null,
        input.test_password || null,
        JSON.stringify(manualTags),
        JSON.stringify(autoTags),
        JSON.stringify(mergedTags),
      ],
    );

    return result.insertId;
  }

  async update(id: number, input: UpdateAirportInput): Promise<boolean> {
    const sets: string[] = [];
    const values: Array<string | number | null> = [];

    if (input.slug !== undefined) {
      const current = await this.getById(id);
      const nextSlug = await this.resolveAirportSlug({
        requestedSlug: input.slug,
        name: input.name ?? current?.name ?? '',
        website: input.website ?? input.websites?.[0] ?? current?.website ?? '',
        excludeId: id,
      });
      sets.push('slug = ?');
      values.push(nextSlug);
    }
    if (typeof input.name === 'string') {
      sets.push('name = ?');
      values.push(input.name);
    }
    if (Array.isArray(input.websites)) {
      const websites = normalizeWebsiteList(input.websites, input.website);
      sets.push('website = ?');
      values.push(websites[0]);
      sets.push('websites_json = ?');
      values.push(JSON.stringify(websites));
    } else if (typeof input.website === 'string') {
      const websites = normalizeWebsiteList(undefined, input.website);
      sets.push('website = ?');
      values.push(websites[0]);
      sets.push('websites_json = ?');
      values.push(JSON.stringify(websites));
    }
    if (typeof input.status === 'string') {
      sets.push('status = ?');
      values.push(input.status);
    }
    if (typeof input.is_listed === 'boolean') {
      sets.push('is_listed = ?');
      values.push(input.is_listed ? 1 : 0);
    }
    if (typeof input.plan_price_month === 'number') {
      sets.push('plan_price_month = ?');
      values.push(input.plan_price_month);
    }
    if (typeof input.has_trial === 'boolean') {
      sets.push('has_trial = ?');
      values.push(input.has_trial ? 1 : 0);
    }
    if (input.streaming_support !== undefined) {
      sets.push('streaming_support_json = ?');
      values.push(JSON.stringify(normalizeAirportStreamingSupport(input.streaming_support)));
    }
    if (input.payment_methods !== undefined) {
      sets.push('payment_methods_json = ?');
      values.push(JSON.stringify(normalizeAirportPaymentMethods(input.payment_methods)));
    }
    if (input.payment_crypto_other !== undefined) {
      sets.push('payment_crypto_other = ?');
      values.push(input.payment_crypto_other || null);
    }
    if (input.has_annual_plan !== undefined) {
      sets.push('has_annual_plan = ?');
      values.push(nullableBooleanToDb(input.has_annual_plan));
    }
    if (input.has_telegram_group !== undefined) {
      sets.push('has_telegram_group = ?');
      values.push(nullableBooleanToDb(input.has_telegram_group));
    }
    if (input.telegram_allows_speaking !== undefined) {
      sets.push('telegram_allows_speaking = ?');
      values.push(nullableBooleanToDb(input.telegram_allows_speaking));
    }
    if (input.has_lifetime_plan !== undefined) {
      sets.push('has_lifetime_plan = ?');
      values.push(nullableBooleanToDb(input.has_lifetime_plan));
    }
    if (input.profile !== undefined) {
      sets.push('airport_profile_json = ?');
      values.push(JSON.stringify(normalizeAirportProfile(input.profile)));
    }
    if (input.subscription_url !== undefined) {
      sets.push('subscription_url = ?');
      values.push(input.subscription_url || null);
    }
    if (input.applicant_email !== undefined) {
      sets.push('applicant_email = ?');
      values.push(input.applicant_email || null);
    }
    if (input.applicant_telegram !== undefined) {
      sets.push('applicant_telegram = ?');
      values.push(input.applicant_telegram || null);
    }
    if (input.founded_on !== undefined) {
      sets.push('founded_on = ?');
      values.push(input.founded_on || null);
    }
    if (input.airport_intro !== undefined) {
      sets.push('airport_intro = ?');
      values.push(input.airport_intro || null);
    }
    if (input.test_account !== undefined) {
      sets.push('test_account = ?');
      values.push(input.test_account || null);
    }
    if (input.test_password !== undefined) {
      sets.push('test_password = ?');
      values.push(input.test_password || null);
    }
    if (Array.isArray(input.manual_tags)) {
      sets.push('manual_tags_json = ?');
      values.push(JSON.stringify(normalizeTagList(input.manual_tags)));
    } else if (Array.isArray(input.tags)) {
      sets.push('manual_tags_json = ?');
      values.push(JSON.stringify(normalizeTagList(input.tags)));
    }

    if (sets.length === 0) {
      return false;
    }

    values.push(id);
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE airports SET ${sets.join(', ')} WHERE id = ?`,
      values,
    );

    if (result.affectedRows > 0 && (Array.isArray(input.manual_tags) || Array.isArray(input.tags))) {
      await this.rebuildMergedTags(id);
    }

    return result.affectedRows > 0;
  }

  async setManualTags(id: number, tags: string[]): Promise<void> {
    await this.pool.execute<ResultSetHeader>(
      'UPDATE airports SET manual_tags_json = ? WHERE id = ?',
      [JSON.stringify(normalizeTagList(tags)), id],
    );
    await this.rebuildMergedTags(id);
  }

  async setAutoTags(id: number, tags: string[]): Promise<void> {
    await this.pool.execute<ResultSetHeader>(
      'UPDATE airports SET auto_tags_json = ? WHERE id = ?',
      [JSON.stringify(normalizeTagList(tags)), id],
    );
    await this.rebuildMergedTags(id);
  }

  private async ensureColumn(columnName: string, definition: string): Promise<void> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT 1
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
        LIMIT 1`,
      ['airports', columnName],
    );

    if (rows.length === 0) {
      await this.pool.query(`ALTER TABLE airports ADD COLUMN ${columnName} ${definition}`);
    }
  }

  private async ensureUniqueIndex(indexName: string, columnName: string): Promise<void> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT 1
         FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND INDEX_NAME = ?
        LIMIT 1`,
      ['airports', indexName],
    );

    if (rows.length === 0) {
      await this.pool.query(`ALTER TABLE airports ADD UNIQUE KEY ${indexName} (${columnName})`);
    }
  }

  private async backfillSlugs(): Promise<void> {
    const [rows] = await this.pool.query<Array<RowDataPacket & {
      id: number;
      name: string;
      website: string;
      slug: string | null;
    }>>(
      `SELECT id, name, website, slug
         FROM airports
        WHERE slug IS NULL
           OR slug = ''
        ORDER BY id ASC`,
    );

    for (const row of rows) {
      const slug = await this.resolveAirportSlug({
        requestedSlug: null,
        name: row.name,
        website: row.website,
        excludeId: Number(row.id),
        fallbackSlug: `airport-${Number(row.id)}`,
      });
      await this.pool.execute<ResultSetHeader>(
        'UPDATE airports SET slug = ? WHERE id = ?',
        [slug, Number(row.id)],
      );
    }
  }

  private async resolveAirportSlug(input: {
    requestedSlug?: string | null;
    name: string;
    website: string;
    excludeId?: number;
    fallbackSlug?: string;
  }): Promise<string> {
    const requestedSlug = input.requestedSlug === undefined ? undefined : normalizeAirportSlug(String(input.requestedSlug || ''));
    if (requestedSlug) {
      const ownerId = await this.findSlugOwnerId(requestedSlug, input.excludeId);
      if (ownerId) {
        const error = new Error('airport slug already exists') as Error & { code?: string };
        error.code = 'AIRPORT_SLUG_CONFLICT';
        throw error;
      }
      return requestedSlug;
    }

    const baseSlug = buildAirportSlugCandidate({ name: input.name, website: input.website })
      || input.fallbackSlug
      || 'airport';
    return this.buildUniqueSlug(baseSlug, input.excludeId);
  }

  private async buildUniqueSlug(baseSlug: string, excludeId?: number): Promise<string> {
    const normalizedBase = normalizeAirportSlug(baseSlug) || 'airport';
    for (let index = 0; index < 1000; index += 1) {
      const suffix = index === 0 ? '' : `-${index + 1}`;
      const maxBaseLength = 160 - suffix.length;
      const candidate = `${normalizedBase.slice(0, maxBaseLength).replace(/-+$/g, '')}${suffix}`;
      const ownerId = await this.findSlugOwnerId(candidate, excludeId);
      if (!ownerId) {
        return candidate;
      }
    }
    return `airport-${Date.now()}`;
  }

  private async findSlugOwnerId(slug: string, excludeId?: number): Promise<number | null> {
    const [rows] = await this.pool.query<Array<RowDataPacket & { id: number }>>(
      `SELECT id
         FROM airports
        WHERE slug = ?
          ${excludeId ? 'AND id <> ?' : ''}
        LIMIT 1`,
      excludeId ? [slug, excludeId] : [slug],
    );
    return rows.length > 0 ? Number(rows[0].id) : null;
  }

  private async rebuildMergedTags(id: number): Promise<void> {
    const [rows] = await this.pool.query<Array<RowDataPacket & {
      manual_tags_json: unknown;
      auto_tags_json: unknown;
    }>>(
      `SELECT manual_tags_json, auto_tags_json
         FROM airports
        WHERE id = ?
        LIMIT 1`,
      [id],
    );

    if (rows.length === 0) {
      return;
    }

    const manualTags = normalizeTagList(rows[0].manual_tags_json);
    const autoTags = normalizeTagList(rows[0].auto_tags_json);
    const mergedTags = mergeDisplayTags(manualTags, autoTags);

    await this.pool.execute<ResultSetHeader>(
      'UPDATE airports SET tags_json = ? WHERE id = ?',
      [JSON.stringify(mergedTags), id],
    );
  }
}

function toAirportEntity(row: AirportRow): Airport {
  const legacyTags = normalizeTagList(row.tags_json);
  const manualTags = normalizeTagList(row.manual_tags_json ?? legacyTags);
  const autoTags = normalizeTagList(row.auto_tags_json);
  const websites = normalizeWebsiteList(normalizeTagList(row.websites_json), row.website);
  return {
    id: row.id,
    application_id: row.application_id == null ? null : Number(row.application_id),
    slug: row.slug || buildAirportSlugCandidate({ name: row.name, website: row.website }) || `airport-${row.id}`,
    name: row.name,
    website: websites[0],
    websites,
    status: row.status,
    is_listed: !!row.is_listed,
    plan_price_month: Number(row.plan_price_month),
    has_trial: !!row.has_trial,
    streaming_support: normalizeAirportStreamingSupport(row.streaming_support_json),
    payment_methods: normalizeAirportPaymentMethods(row.payment_methods_json),
    payment_crypto_other: row.payment_crypto_other,
    has_annual_plan: nullableDbBoolean(row.has_annual_plan),
    has_telegram_group: nullableDbBoolean(row.has_telegram_group),
    telegram_allows_speaking: nullableDbBoolean(row.telegram_allows_speaking),
    has_lifetime_plan: nullableDbBoolean(row.has_lifetime_plan),
    profile: normalizeAirportProfile(row.airport_profile_json),
    subscription_url: row.subscription_url,
    applicant_email: row.applicant_email,
    applicant_account_email: row.applicant_account_email,
    applicant_telegram: row.applicant_telegram,
    telegram_bot_bound: Number(row.telegram_bot_bound || 0) > 0,
    founded_on: row.founded_on ? toDateString(row.founded_on) : null,
    airport_intro: row.airport_intro,
    test_account: row.test_account,
    test_password: row.test_password,
    tags: mergeDisplayTags(manualTags, autoTags),
    manual_tags: manualTags,
    auto_tags: autoTags,
    paid_application_fee: Number(row.paid_application_fee || 0) > 0,
    created_at: toDateString(row.created_at),
  };
}

function normalizeWebsiteList(websites?: string[], primaryWebsite?: string): string[] {
  const ordered = [primaryWebsite || '', ...(websites || [])]
    .map((value) => value.trim())
    .filter(Boolean);
  const unique = [...new Set(ordered)];
  return unique.length > 0 ? unique : [''];
}

function normalizeAirportStreamingSupport(value: unknown): AirportStreamingSupport[] {
  return normalizeAirportEnumList(value, AIRPORT_STREAMING_SUPPORT_VALUES);
}

function normalizeAirportPaymentMethods(value: unknown): AirportPaymentMethod[] {
  return normalizeAirportEnumList(value, AIRPORT_PAYMENT_METHOD_VALUES, { usdt: 'usdt_trc20' });
}

function normalizeAirportEnumList<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  aliases: Partial<Record<string, T>> = {},
): T[] {
  const values = Array.isArray(value) ? value : safeJsonArray(value);
  const allowed = new Set(allowedValues);
  const normalized = values
    .map((item) => aliases[String(item).trim()] ?? String(item).trim())
    .filter((item): item is T => allowed.has(item as T));
  return [...new Set(normalized)];
}

function safeJsonArray(value: unknown): unknown[] {
  if (typeof value !== 'string' || value.trim() === '') {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function nullableBooleanToDb(value: boolean | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  return value ? 1 : 0;
}

function nullableDbBoolean(value: number | null | undefined): boolean | null {
  if (value === null || value === undefined) {
    return null;
  }
  return Number(value) === 1;
}

function parseApplicationIdKeyword(keyword: string): number | null {
  const trimmed = keyword.trim();
  const match = trimmed.match(/^#?(\d+)$/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function toDateString(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}
