import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { Airport, AirportStatus } from '../types/domain';

interface AirportRow extends RowDataPacket {
  id: number;
  name: string;
  website: string;
  websites_json: unknown;
  status: AirportStatus;
  plan_price_month: number;
  has_trial: number;
  subscription_url: string | null;
  applicant_email: string | null;
  applicant_telegram: string | null;
  founded_on: string | null;
  airport_intro: string | null;
  test_account: string | null;
  test_password: string | null;
  tags_json: unknown;
  created_at: string;
}

export interface CreateAirportInput {
  name: string;
  website: string;
  websites?: string[];
  status?: AirportStatus;
  plan_price_month: number;
  has_trial: boolean;
  subscription_url?: string | null;
  applicant_email?: string | null;
  applicant_telegram?: string | null;
  founded_on?: string | null;
  airport_intro?: string | null;
  test_account?: string | null;
  test_password?: string | null;
  tags?: string[];
}

export interface UpdateAirportInput {
  name?: string;
  website?: string;
  websites?: string[];
  status?: AirportStatus;
  plan_price_month?: number;
  has_trial?: boolean;
  subscription_url?: string | null;
  applicant_email?: string | null;
  applicant_telegram?: string | null;
  founded_on?: string | null;
  airport_intro?: string | null;
  test_account?: string | null;
  test_password?: string | null;
  tags?: string[];
}

export class AirportRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.ensureColumn('websites_json', 'JSON NULL AFTER website');
    await this.ensureColumn('tags_json', 'JSON NULL AFTER subscription_url');
    await this.ensureColumn('applicant_email', 'VARCHAR(255) NULL AFTER subscription_url');
    await this.ensureColumn('applicant_telegram', 'VARCHAR(128) NULL AFTER applicant_email');
    await this.ensureColumn('founded_on', 'DATE NULL AFTER applicant_telegram');
    await this.ensureColumn('airport_intro', 'TEXT NULL AFTER founded_on');
    await this.ensureColumn('test_account', 'VARCHAR(255) NULL AFTER airport_intro');
    await this.ensureColumn('test_password', 'VARCHAR(255) NULL AFTER test_account');

    await this.pool.query(
      `UPDATE airports
          SET websites_json = JSON_ARRAY(website)
        WHERE websites_json IS NULL
           OR JSON_TYPE(websites_json) != 'ARRAY'
           OR JSON_LENGTH(websites_json) = 0`,
    );

    await this.pool.query(
      `UPDATE airports
          SET tags_json = JSON_ARRAY()
        WHERE tags_json IS NULL
           OR JSON_TYPE(tags_json) != 'ARRAY'`,
    );
  }

  async listAll(): Promise<Airport[]> {
    const [rows] = await this.pool.query<AirportRow[]>(
      `SELECT
         id,
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
         tags_json,
         created_at
         FROM airports
        ORDER BY id ASC`,
    );

    return rows.map((row) => toAirportEntity(row));
  }

  async listByQuery(
    query: { keyword?: string; status?: AirportStatus; page?: number; pageSize?: number },
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
    if (query.keyword) {
      where.push('(name LIKE ? OR website LIKE ? OR websites_json LIKE ?)');
      const k = `%${query.keyword}%`;
      args.push(k, k, k);
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
         tags_json,
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
         tags_json,
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

  async create(input: CreateAirportInput): Promise<number> {
    const websites = normalizeWebsiteList(input.websites, input.website);
    const [result] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO airports (
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
         tags_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.name,
        websites[0],
        JSON.stringify(websites),
        input.status || 'normal',
        input.plan_price_month,
        input.has_trial ? 1 : 0,
        input.subscription_url || null,
        input.applicant_email || null,
        input.applicant_telegram || null,
        input.founded_on || null,
        input.airport_intro || null,
        input.test_account || null,
        input.test_password || null,
        JSON.stringify(input.tags || []),
      ],
    );

    return result.insertId;
  }

  async update(id: number, input: UpdateAirportInput): Promise<boolean> {
    const sets: string[] = [];
    const values: Array<string | number | null> = [];

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
    if (typeof input.plan_price_month === 'number') {
      sets.push('plan_price_month = ?');
      values.push(input.plan_price_month);
    }
    if (typeof input.has_trial === 'boolean') {
      sets.push('has_trial = ?');
      values.push(input.has_trial ? 1 : 0);
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
    if (Array.isArray(input.tags)) {
      sets.push('tags_json = ?');
      values.push(JSON.stringify(input.tags));
    }

    if (sets.length === 0) {
      return false;
    }

    values.push(id);
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE airports SET ${sets.join(', ')} WHERE id = ?`,
      values,
    );

    return result.affectedRows > 0;
  }

  async setTags(id: number, tags: string[]): Promise<void> {
    await this.pool.execute<ResultSetHeader>(
      'UPDATE airports SET tags_json = ? WHERE id = ?',
      [JSON.stringify(tags), id],
    );
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

function toAirportEntity(row: AirportRow): Airport {
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
    founded_on: row.founded_on ? toDateString(row.founded_on) : null,
    airport_intro: row.airport_intro,
    test_account: row.test_account,
    test_password: row.test_password,
    tags: safeJsonArray(row.tags_json),
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

function toDateString(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}
