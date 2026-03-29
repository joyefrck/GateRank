import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { AccessTokenScope } from '../utils/accessToken';

interface AccessTokenRow extends RowDataPacket {
  id: number;
  name: string;
  description: string;
  token_hash: string;
  token_masked: string;
  scopes_json: unknown;
  status: 'active' | 'revoked';
  expires_at: string | null;
  last_used_at: string | null;
  last_used_ip: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AccessTokenRecord {
  id: number;
  name: string;
  description: string;
  token_hash: string;
  token_masked: string;
  scopes: AccessTokenScope[];
  status: 'active' | 'revoked';
  expires_at: string | null;
  last_used_at: string | null;
  last_used_ip: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAccessTokenInput {
  name: string;
  description: string;
  token_hash: string;
  token_masked: string;
  scopes: AccessTokenScope[];
  expires_at: string | null;
  created_by: string;
}

export class AccessTokenRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS admin_access_tokens (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        name VARCHAR(128) NOT NULL,
        description TEXT NOT NULL,
        token_hash CHAR(64) NOT NULL,
        token_masked VARCHAR(64) NOT NULL,
        scopes_json JSON NOT NULL,
        status ENUM('active', 'revoked') NOT NULL DEFAULT 'active',
        expires_at DATETIME NULL,
        last_used_at DATETIME NULL,
        last_used_ip VARCHAR(64) NULL,
        created_by VARCHAR(128) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_admin_access_tokens_hash (token_hash),
        INDEX idx_admin_access_tokens_status (status),
        INDEX idx_admin_access_tokens_last_used_at (last_used_at),
        INDEX idx_admin_access_tokens_expires_at (expires_at)
      )
    `);

    await this.ensureColumn('description', 'TEXT NOT NULL AFTER name');
    await this.ensureColumn('token_hash', 'CHAR(64) NOT NULL AFTER description');
    await this.ensureColumn('token_masked', 'VARCHAR(64) NOT NULL AFTER token_hash');
    await this.ensureColumn('scopes_json', 'JSON NOT NULL AFTER token_masked');
    await this.ensureColumn(
      'status',
      "ENUM('active', 'revoked') NOT NULL DEFAULT 'active' AFTER scopes_json",
    );
    await this.ensureColumn('expires_at', 'DATETIME NULL AFTER status');
    await this.ensureColumn('last_used_at', 'DATETIME NULL AFTER expires_at');
    await this.ensureColumn('last_used_ip', 'VARCHAR(64) NULL AFTER last_used_at');
    await this.ensureColumn('created_by', 'VARCHAR(128) NOT NULL AFTER last_used_ip');
    await this.ensureColumn(
      'updated_at',
      'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at',
    );
  }

  async listAll(): Promise<AccessTokenRecord[]> {
    const [rows] = await this.pool.query<AccessTokenRow[]>(
      `${baseSelectSql()}
       ORDER BY created_at DESC, id DESC`,
    );
    return rows.map((row) => toAccessTokenRecord(row));
  }

  async getById(id: number): Promise<AccessTokenRecord | null> {
    const [rows] = await this.pool.query<AccessTokenRow[]>(
      `${baseSelectSql()}
       WHERE id = ?
       LIMIT 1`,
      [id],
    );
    return rows[0] ? toAccessTokenRecord(rows[0]) : null;
  }

  async getByHash(tokenHash: string): Promise<AccessTokenRecord | null> {
    const [rows] = await this.pool.query<AccessTokenRow[]>(
      `${baseSelectSql()}
       WHERE token_hash = ?
       LIMIT 1`,
      [tokenHash],
    );
    return rows[0] ? toAccessTokenRecord(rows[0]) : null;
  }

  async create(input: CreateAccessTokenInput): Promise<number> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO admin_access_tokens (
         name,
         description,
         token_hash,
         token_masked,
         scopes_json,
         status,
         expires_at,
         created_by
       ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
      [
        input.name,
        input.description,
        input.token_hash,
        input.token_masked,
        JSON.stringify(input.scopes),
        input.expires_at,
        input.created_by,
      ],
    );
    return Number(result.insertId);
  }

  async revoke(id: number): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE admin_access_tokens
          SET status = 'revoked',
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND status <> 'revoked'`,
      [id],
    );
    return result.affectedRows > 0;
  }

  async touchLastUsed(id: number, ip: string | null): Promise<void> {
    await this.pool.execute<ResultSetHeader>(
      `UPDATE admin_access_tokens
          SET last_used_at = CURRENT_TIMESTAMP,
              last_used_ip = ?,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [ip, id],
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
      ['admin_access_tokens', columnName],
    );

    if (rows.length === 0) {
      await this.pool.query(`ALTER TABLE admin_access_tokens ADD COLUMN ${columnName} ${definition}`);
    }
  }
}

function baseSelectSql(): string {
  return `SELECT
            id,
            name,
            description,
            token_hash,
            token_masked,
            scopes_json,
            status,
            DATE_FORMAT(expires_at, '%Y-%m-%d %H:%i:%s') AS expires_at,
            DATE_FORMAT(last_used_at, '%Y-%m-%d %H:%i:%s') AS last_used_at,
            last_used_ip,
            created_by,
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
          FROM admin_access_tokens`;
}

function toAccessTokenRecord(row: AccessTokenRow): AccessTokenRecord {
  return {
    id: Number(row.id),
    name: row.name,
    description: row.description,
    token_hash: row.token_hash,
    token_masked: row.token_masked,
    scopes: normalizeScopes(row.scopes_json),
    status: row.status,
    expires_at: row.expires_at,
    last_used_at: row.last_used_at,
    last_used_ip: row.last_used_ip,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeScopes(value: unknown): AccessTokenScope[] {
  if (Array.isArray(value)) {
    return value.map((scope) => String(scope)) as AccessTokenScope[];
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((scope) => String(scope)) as AccessTokenScope[] : [];
    } catch {
      return [];
    }
  }

  return [];
}
