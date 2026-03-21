import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { Airport, AirportStatus } from '../types/domain';

interface AirportRow extends RowDataPacket {
  id: number;
  name: string;
  website: string;
  status: AirportStatus;
  plan_price_month: number;
  has_trial: number;
  tags_json: string | null;
  created_at: string;
}

export interface CreateAirportInput {
  name: string;
  website: string;
  status?: AirportStatus;
  plan_price_month: number;
  has_trial: boolean;
  tags?: string[];
}

export interface UpdateAirportInput {
  name?: string;
  website?: string;
  status?: AirportStatus;
  plan_price_month?: number;
  has_trial?: boolean;
  tags?: string[];
}

export class AirportRepository {
  constructor(private readonly pool: Pool) {}

  async listAll(): Promise<Airport[]> {
    const [rows] = await this.pool.query<AirportRow[]>(
      `SELECT id, name, website, status, plan_price_month, has_trial, tags_json, created_at
         FROM airports
        ORDER BY id ASC`,
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      website: row.website,
      status: row.status,
      plan_price_month: Number(row.plan_price_month),
      has_trial: !!row.has_trial,
      tags: safeJsonArray(row.tags_json),
      created_at: toDateString(row.created_at),
    }));
  }

  async getById(id: number): Promise<Airport | null> {
    const [rows] = await this.pool.query<AirportRow[]>(
      `SELECT id, name, website, status, plan_price_month, has_trial, tags_json, created_at
         FROM airports
        WHERE id = ?
        LIMIT 1`,
      [id],
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      id: row.id,
      name: row.name,
      website: row.website,
      status: row.status,
      plan_price_month: Number(row.plan_price_month),
      has_trial: !!row.has_trial,
      tags: safeJsonArray(row.tags_json),
      created_at: toDateString(row.created_at),
    };
  }

  async create(input: CreateAirportInput): Promise<number> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO airports (name, website, status, plan_price_month, has_trial, tags_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.name,
        input.website,
        input.status || 'normal',
        input.plan_price_month,
        input.has_trial ? 1 : 0,
        JSON.stringify(input.tags || []),
      ],
    );

    return result.insertId;
  }

  async update(id: number, input: UpdateAirportInput): Promise<boolean> {
    const sets: string[] = [];
    const values: Array<string | number> = [];

    if (typeof input.name === 'string') {
      sets.push('name = ?');
      values.push(input.name);
    }
    if (typeof input.website === 'string') {
      sets.push('website = ?');
      values.push(input.website);
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
}

function safeJsonArray(value: string | null): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function toDateString(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}
