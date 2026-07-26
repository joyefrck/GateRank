import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import {
  isToolDownloadPlatform,
  type ToolDownloadItem,
  type ToolDownloadPlatform,
  type ToolDownloadPlatformVersions,
  type ToolDownloadPrimaryAction,
  type ToolDownloadStatus,
} from '../../../shared/toolDownloads';

interface ToolDownloadRow extends RowDataPacket {
  id: number;
  slug: string;
  name: string;
  summary: string;
  description: string;
  platforms_json: unknown;
  platform_versions_json: unknown;
  icon_url: string;
  local_file_url: string;
  official_url: string;
  primary_action: ToolDownloadPrimaryAction;
  version: string;
  file_size_label: string;
  download_count: number;
  is_hot: number;
  sort_order: number;
  status: ToolDownloadStatus;
  published_at: string | null;
  content_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ToolDownloadInput {
  slug: string;
  name: string;
  summary: string;
  description?: string;
  platforms: ToolDownloadPlatform[];
  platform_versions?: ToolDownloadPlatformVersions;
  icon_url?: string;
  local_file_url?: string;
  official_url?: string;
  primary_action?: ToolDownloadPrimaryAction;
  version?: string;
  file_size_label?: string;
  is_hot?: boolean;
  sort_order?: number;
  status?: ToolDownloadStatus;
  published_at?: string | null;
  content_updated_at?: string | null;
}

export type UpdateToolDownloadInput = Partial<ToolDownloadInput>;

export interface ToolDownloadListQuery {
  status?: ToolDownloadStatus;
  platform?: ToolDownloadPlatform;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export class ToolDownloadRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS tool_download_items (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        slug VARCHAR(128) NOT NULL,
        name VARCHAR(255) NOT NULL,
        summary VARCHAR(500) NOT NULL DEFAULT '',
        description TEXT NULL,
        platforms_json JSON NOT NULL,
        platform_versions_json JSON NULL,
        icon_url VARCHAR(1024) NOT NULL DEFAULT '',
        local_file_url VARCHAR(1024) NOT NULL DEFAULT '',
        official_url VARCHAR(1024) NOT NULL DEFAULT '',
        primary_action ENUM('official', 'local') NOT NULL DEFAULT 'official',
        version VARCHAR(128) NOT NULL DEFAULT '',
        file_size_label VARCHAR(128) NOT NULL DEFAULT '',
        download_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
        is_hot TINYINT(1) NOT NULL DEFAULT 0,
        sort_order INT NOT NULL DEFAULT 0,
        status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
        published_at DATETIME NULL,
        content_updated_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_tool_download_items_slug (slug),
        INDEX idx_tool_download_items_status_sort (status, sort_order, id),
        INDEX idx_tool_download_items_hot_sort (is_hot, status, sort_order, id)
      )
    `);

    await this.ensureColumn('slug', 'VARCHAR(128) NOT NULL AFTER id');
    await this.ensureColumn('summary', "VARCHAR(500) NOT NULL DEFAULT '' AFTER name");
    await this.ensureColumn('description', 'TEXT NULL AFTER summary');
    await this.ensureColumn('platforms_json', 'JSON NOT NULL AFTER description');
    await this.ensureColumn('platform_versions_json', 'JSON NULL AFTER platforms_json');
    await this.ensureColumn('icon_url', "VARCHAR(1024) NOT NULL DEFAULT '' AFTER platform_versions_json");
    await this.ensureColumn('local_file_url', "VARCHAR(1024) NOT NULL DEFAULT '' AFTER icon_url");
    await this.ensureColumn('official_url', "VARCHAR(1024) NOT NULL DEFAULT '' AFTER local_file_url");
    await this.ensureColumn('primary_action', "ENUM('official', 'local') NOT NULL DEFAULT 'official' AFTER official_url");
    await this.ensureColumn('version', "VARCHAR(128) NOT NULL DEFAULT '' AFTER primary_action");
    await this.ensureColumn('file_size_label', "VARCHAR(128) NOT NULL DEFAULT '' AFTER version");
    await this.ensureColumn('download_count', 'BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER file_size_label');
    await this.ensureColumn('is_hot', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER download_count');
    await this.ensureColumn('sort_order', 'INT NOT NULL DEFAULT 0 AFTER is_hot');
    await this.ensureColumn('status', "ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft' AFTER sort_order");
    await this.ensureColumn('published_at', 'DATETIME NULL AFTER status');
    await this.ensureColumn('content_updated_at', 'DATETIME NULL AFTER published_at');
    await this.ensureIndex('uk_tool_download_items_slug', 'CREATE UNIQUE INDEX uk_tool_download_items_slug ON tool_download_items (slug)');
    await this.ensureIndex('idx_tool_download_items_status_sort', 'CREATE INDEX idx_tool_download_items_status_sort ON tool_download_items (status, sort_order, id)');
    await this.ensureIndex('idx_tool_download_items_hot_sort', 'CREATE INDEX idx_tool_download_items_hot_sort ON tool_download_items (is_hot, status, sort_order, id)');
  }

  async listByQuery(query: ToolDownloadListQuery = {}): Promise<{ items: ToolDownloadItem[]; total: number }> {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 20));
    const offset = (page - 1) * pageSize;
    const filters = buildListFilters(query);

    const [totalRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM tool_download_items ${filters.whereSql}`,
      filters.args,
    );
    const [rows] = await this.pool.query<ToolDownloadRow[]>(
      `${selectSql()}
       ${filters.whereSql}
       ORDER BY is_hot DESC, sort_order ASC, id DESC
       LIMIT ? OFFSET ?`,
      [...filters.args, pageSize, offset],
    );

    return {
      total: Number(totalRows[0]?.total || 0),
      items: rows.map(toToolDownloadItem),
    };
  }

  async listPublished(query: Omit<ToolDownloadListQuery, 'status'> = {}): Promise<{ items: ToolDownloadItem[]; total: number }> {
    return this.listByQuery({ ...query, status: 'published', pageSize: query.pageSize || 100 });
  }

  async getById(id: number): Promise<ToolDownloadItem | null> {
    const [rows] = await this.pool.query<ToolDownloadRow[]>(`${selectSql()} WHERE id = ? LIMIT 1`, [id]);
    return rows[0] ? toToolDownloadItem(rows[0]) : null;
  }

  async getBySlug(slug: string): Promise<ToolDownloadItem | null> {
    const [rows] = await this.pool.query<ToolDownloadRow[]>(`${selectSql()} WHERE slug = ? LIMIT 1`, [slug]);
    return rows[0] ? toToolDownloadItem(rows[0]) : null;
  }

  async create(input: ToolDownloadInput): Promise<number> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO tool_download_items (
         slug, name, summary, description, platforms_json, platform_versions_json, icon_url, local_file_url, official_url,
         primary_action, version, file_size_label, is_hot, sort_order, status, published_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.slug,
        input.name,
        input.summary,
        input.description || '',
        JSON.stringify(input.platforms),
        JSON.stringify(input.platform_versions || {}),
        input.icon_url || '',
        input.local_file_url || '',
        input.official_url || '',
        input.primary_action || 'official',
        input.version || '',
        input.file_size_label || '',
        input.is_hot ? 1 : 0,
        input.sort_order || 0,
        input.status || 'draft',
        input.published_at || null,
      ],
    );
    return Number(result.insertId);
  }

  async update(id: number, input: UpdateToolDownloadInput): Promise<boolean> {
    const updates: string[] = [];
    const params: Array<string | number | null> = [];
    const push = (column: string, value: string | number | null | undefined) => {
      if (value !== undefined) {
        updates.push(`${column} = ?`);
        params.push(value);
      }
    };

    push('slug', input.slug);
    push('name', input.name);
    push('summary', input.summary);
    push('description', input.description);
    if (input.platforms !== undefined) push('platforms_json', JSON.stringify(input.platforms));
    if (input.platform_versions !== undefined) push('platform_versions_json', JSON.stringify(input.platform_versions));
    push('icon_url', input.icon_url);
    push('local_file_url', input.local_file_url);
    push('official_url', input.official_url);
    push('primary_action', input.primary_action);
    push('version', input.version);
    push('file_size_label', input.file_size_label);
    if (input.is_hot !== undefined) push('is_hot', input.is_hot ? 1 : 0);
    push('sort_order', input.sort_order);
    push('status', input.status);
    push('published_at', input.published_at);
    push('content_updated_at', input.content_updated_at);

    if (updates.length === 0) {
      return true;
    }

    params.push(id);
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE tool_download_items SET ${updates.join(', ')} WHERE id = ?`,
      params,
    );
    return result.affectedRows > 0;
  }

  async incrementDownloadCount(id: number): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      'UPDATE tool_download_items SET download_count = download_count + 1 WHERE id = ?',
      [id],
    );
    return result.affectedRows > 0;
  }

  async countByLocalFileUrl(localFileUrl: string): Promise<number> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS total FROM tool_download_items WHERE local_file_url = ?',
      [localFileUrl],
    );
    return Number(rows[0]?.total || 0);
  }

  private async ensureColumn(columnName: string, definition: string): Promise<void> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT 1
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = ?
       LIMIT 1`,
      ['tool_download_items', columnName],
    );
    if (rows.length === 0 || Number(rows[0]?.count) === 0) {
      await this.pool.query(`ALTER TABLE tool_download_items ADD COLUMN ${columnName} ${definition}`);
    }
  }

  private async ensureIndex(indexName: string, createSql: string): Promise<void> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT 1
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND INDEX_NAME = ?
       LIMIT 1`,
      ['tool_download_items', indexName],
    );
    if (rows.length === 0 || Number(rows[0]?.count) === 0) {
      await this.pool.query(createSql);
    }
  }
}

function buildListFilters(query: ToolDownloadListQuery): { whereSql: string; args: unknown[] } {
  const where: string[] = [];
  const args: unknown[] = [];
  if (query.status) {
    where.push('status = ?');
    args.push(query.status);
  }
  if (query.platform) {
    where.push('JSON_CONTAINS(platforms_json, JSON_QUOTE(?))');
    args.push(query.platform);
  }
  if (query.keyword) {
    where.push('(name LIKE ? OR slug LIKE ? OR summary LIKE ?)');
    const keyword = `%${query.keyword}%`;
    args.push(keyword, keyword, keyword);
  }
  return {
    whereSql: where.length > 0 ? `WHERE ${where.join(' AND ')}` : '',
    args,
  };
}

function selectSql(): string {
  return `SELECT
    id, slug, name, summary, description, platforms_json, platform_versions_json, icon_url, local_file_url,
    official_url, primary_action, version, file_size_label, download_count, is_hot, sort_order, status,
    DATE_FORMAT(published_at, '%Y-%m-%d %H:%i:%s') AS published_at,
    DATE_FORMAT(content_updated_at, '%Y-%m-%d %H:%i:%s') AS content_updated_at,
    DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
    DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
    FROM tool_download_items`;
}

function toToolDownloadItem(row: ToolDownloadRow): ToolDownloadItem {
  return {
    id: Number(row.id),
    slug: row.slug,
    name: row.name,
    summary: row.summary || '',
    description: row.description || '',
    platforms: parsePlatforms(row.platforms_json),
    platform_versions: parsePlatformVersions(row.platform_versions_json),
    icon_url: row.icon_url || '',
    local_file_url: row.local_file_url || '',
    official_url: row.official_url || '',
    primary_action: row.primary_action === 'local' ? 'local' : 'official',
    version: row.version || '',
    file_size_label: row.file_size_label || '',
    download_count: Number(row.download_count || 0),
    is_hot: Boolean(row.is_hot),
    sort_order: Number(row.sort_order || 0),
    status: row.status,
    published_at: row.published_at || null,
    content_updated_at: row.content_updated_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function parsePlatforms(value: unknown): ToolDownloadPlatform[] {
  const parsed = typeof value === 'string' ? safeJsonParse(value) : value;
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter(isToolDownloadPlatform);
}

function parsePlatformVersions(value: unknown): ToolDownloadPlatformVersions {
  const parsed = typeof value === 'string' ? safeJsonParse(value) : value;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }
  const output: ToolDownloadPlatformVersions = {};
  for (const platform of Object.keys(parsed) as ToolDownloadPlatform[]) {
    if (!isToolDownloadPlatform(platform)) continue;
    const version = String((parsed as Record<string, unknown>)[platform] || '').trim();
    if (version) {
      output[platform] = version;
    }
  }
  return output;
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
