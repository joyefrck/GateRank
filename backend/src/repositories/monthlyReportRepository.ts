import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type {
  MonthlyReport,
  MonthlyReportListItem,
  MonthlyReportStatus,
} from '../types/domain';

interface MonthlyReportRow extends RowDataPacket {
  id: number;
  year: number;
  month: number;
  slug: string;
  title: string;
  h1: string;
  excerpt: string;
  content_markdown: string;
  content_html: string;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  cover_image_url: string;
  og_image_url: string;
  og_image_alt: string;
  status: MonthlyReportStatus;
  published_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface MonthlyReportInput {
  year: number;
  month: number;
  slug: string;
  title: string;
  h1: string;
  excerpt: string;
  content_markdown: string;
  content_html: string;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  cover_image_url: string;
  og_image_url: string;
  og_image_alt: string;
  status?: MonthlyReportStatus;
  published_at?: string | null;
}

export type UpdateMonthlyReportInput = Partial<MonthlyReportInput>;

export interface MonthlyReportListQuery {
  year?: number;
  status?: MonthlyReportStatus;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export class MonthlyReportRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS monthly_reports (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        year SMALLINT UNSIGNED NOT NULL,
        month TINYINT UNSIGNED NOT NULL,
        slug VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        h1 VARCHAR(255) NOT NULL DEFAULT '',
        excerpt TEXT NOT NULL,
        content_markdown MEDIUMTEXT NOT NULL,
        content_html MEDIUMTEXT NOT NULL,
        seo_title VARCHAR(255) NOT NULL DEFAULT '',
        seo_description TEXT NULL,
        seo_keywords TEXT NULL,
        cover_image_url VARCHAR(1024) NOT NULL DEFAULT '',
        og_image_url VARCHAR(1024) NOT NULL DEFAULT '',
        og_image_alt VARCHAR(255) NOT NULL DEFAULT '',
        status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
        published_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_monthly_reports_slug (slug),
        UNIQUE KEY uk_monthly_reports_year_month (year, month),
        INDEX idx_monthly_reports_status_published_at (status, published_at DESC),
        INDEX idx_monthly_reports_year_month (year, month),
        INDEX idx_monthly_reports_updated_at (updated_at DESC)
      )
    `);

    await this.ensureColumn('monthly_reports', 'h1', "VARCHAR(255) NOT NULL DEFAULT '' AFTER title");
    await this.ensureColumn('monthly_reports', 'seo_title', "VARCHAR(255) NOT NULL DEFAULT '' AFTER content_html");
    await this.ensureColumn('monthly_reports', 'seo_description', 'TEXT NULL AFTER seo_title');
    await this.ensureColumn('monthly_reports', 'seo_keywords', 'TEXT NULL AFTER seo_description');
    await this.ensureColumn('monthly_reports', 'cover_image_url', "VARCHAR(1024) NOT NULL DEFAULT '' AFTER seo_keywords");
    await this.ensureColumn('monthly_reports', 'og_image_url', "VARCHAR(1024) NOT NULL DEFAULT '' AFTER cover_image_url");
    await this.ensureColumn('monthly_reports', 'og_image_alt', "VARCHAR(255) NOT NULL DEFAULT '' AFTER og_image_url");
    await this.ensureIndex(
      'monthly_reports',
      'idx_monthly_reports_status_published_at',
      'CREATE INDEX idx_monthly_reports_status_published_at ON monthly_reports (status, published_at DESC)',
    );
    await this.ensureIndex(
      'monthly_reports',
      'idx_monthly_reports_year_month',
      'CREATE INDEX idx_monthly_reports_year_month ON monthly_reports (year, month)',
    );
    await this.ensureIndex(
      'monthly_reports',
      'uk_monthly_reports_year_month',
      'CREATE UNIQUE INDEX uk_monthly_reports_year_month ON monthly_reports (year, month)',
    );
  }

  async listByQuery(query: MonthlyReportListQuery): Promise<{ items: MonthlyReportListItem[]; total: number }> {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 20));
    const offset = (page - 1) * pageSize;
    const filters = buildListFilters(query);

    const [totalRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM monthly_reports ${filters.whereSql}`,
      filters.args,
    );
    const [rows] = await this.pool.query<MonthlyReportRow[]>(
      `${listSelectSql()}
       ${filters.whereSql}
       ORDER BY year DESC, month DESC, updated_at DESC
       LIMIT ? OFFSET ?`,
      [...filters.args, pageSize, offset],
    );

    return {
      total: Number(totalRows[0]?.total || 0),
      items: rows.map(toMonthlyReportListItem),
    };
  }

  async listPublished(page = 1, pageSize = 12): Promise<{ items: MonthlyReportListItem[]; total: number }> {
    return this.listByQuery({
      status: 'published',
      page,
      pageSize,
    });
  }

  async listPublishedForSitemap(limit = 200): Promise<MonthlyReportListItem[]> {
    const [rows] = await this.pool.query<MonthlyReportRow[]>(
      `${listSelectSql()}
       WHERE status = 'published'
         AND published_at IS NOT NULL
       ORDER BY year DESC, month DESC
       LIMIT ?`,
      [limit],
    );
    return rows.map(toMonthlyReportListItem);
  }

  async listPeriods(): Promise<Array<{ id: number; year: number; month: number; status: MonthlyReportStatus }>> {
    const [rows] = await this.pool.query<Array<RowDataPacket & { id: number; year: number; month: number; status: MonthlyReportStatus }>>(
      `SELECT id, year, month, status
         FROM monthly_reports
        ORDER BY year DESC, month DESC`,
    );
    return rows.map((row) => ({
      id: Number(row.id),
      year: Number(row.year),
      month: Number(row.month),
      status: row.status,
    }));
  }

  async getById(id: number): Promise<MonthlyReport | null> {
    const [rows] = await this.pool.query<MonthlyReportRow[]>(
      `${detailSelectSql()} WHERE id = ? LIMIT 1`,
      [id],
    );
    return rows[0] ? toMonthlyReport(rows[0]) : null;
  }

  async getPublishedBySlug(slug: string): Promise<MonthlyReport | null> {
    const [rows] = await this.pool.query<MonthlyReportRow[]>(
      `${detailSelectSql()}
       WHERE slug = ?
         AND status = 'published'
         AND published_at IS NOT NULL
       LIMIT 1`,
      [slug],
    );
    return rows[0] ? toMonthlyReport(rows[0]) : null;
  }

  async create(input: MonthlyReportInput): Promise<number> {
    await this.assertYearMonthAvailable(input.year, input.month, null, input.status || 'draft');
    const [result] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO monthly_reports (
         year,
         month,
         slug,
         title,
         h1,
         excerpt,
         content_markdown,
         content_html,
         seo_title,
         seo_description,
         seo_keywords,
         cover_image_url,
         og_image_url,
         og_image_alt,
         status,
         published_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.year,
        input.month,
        input.slug,
        input.title,
        input.h1,
        input.excerpt,
        input.content_markdown,
        input.content_html,
        input.seo_title,
        input.seo_description,
        input.seo_keywords,
        input.cover_image_url,
        input.og_image_url,
        input.og_image_alt,
        input.status || 'draft',
        input.published_at || null,
      ],
    );
    return Number(result.insertId);
  }

  async update(id: number, input: UpdateMonthlyReportInput): Promise<boolean> {
    const current = await this.getById(id);
    if (!current) {
      return false;
    }
    const nextYear = input.year ?? current.year;
    const nextMonth = input.month ?? current.month;
    const nextStatus = input.status ?? current.status;
    await this.assertYearMonthAvailable(nextYear, nextMonth, id, nextStatus);

    const updates: string[] = [];
    const params: Array<string | number | null> = [];
    const push = (column: string, value: string | number | null | undefined): void => {
      if (value !== undefined) {
        updates.push(`${column} = ?`);
        params.push(value);
      }
    };
    push('year', input.year);
    push('month', input.month);
    push('slug', input.slug);
    push('title', input.title);
    push('h1', input.h1);
    push('excerpt', input.excerpt);
    push('content_markdown', input.content_markdown);
    push('content_html', input.content_html);
    push('seo_title', input.seo_title);
    push('seo_description', input.seo_description);
    push('seo_keywords', input.seo_keywords);
    push('cover_image_url', input.cover_image_url);
    push('og_image_url', input.og_image_url);
    push('og_image_alt', input.og_image_alt);
    push('status', input.status);
    if (input.published_at !== undefined) {
      updates.push('published_at = ?');
      params.push(input.published_at);
    }

    if (updates.length === 0) {
      return true;
    }
    params.push(id);
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE monthly_reports
          SET ${updates.join(', ')},
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      params,
    );
    return result.affectedRows > 0;
  }

  async publish(id: number, publishedAt: string): Promise<boolean> {
    const current = await this.getById(id);
    if (!current) {
      return false;
    }
    await this.assertYearMonthAvailable(current.year, current.month, id, 'published');
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE monthly_reports
          SET status = 'published',
              published_at = ?,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [publishedAt, id],
    );
    return result.affectedRows > 0;
  }

  async archive(id: number): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE monthly_reports
          SET status = 'archived',
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [id],
    );
    return result.affectedRows > 0;
  }

  private async assertYearMonthAvailable(
    year: number,
    month: number,
    currentId: number | null,
    status: MonthlyReportStatus,
  ): Promise<void> {
    void status;
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT id
         FROM monthly_reports
        WHERE year = ?
          AND month = ?
          ${currentId ? 'AND id <> ?' : ''}
        LIMIT 1`,
      currentId ? [year, month, currentId] : [year, month],
    );
    if (rows.length > 0) {
      throw new Error('MONTHLY_REPORT_PERIOD_CONFLICT');
    }
  }

  private async ensureColumn(table: string, columnName: string, definition: string): Promise<void> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS count
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?`,
      [table, columnName],
    );
    if (Number(rows[0]?.count || 0) === 0) {
      await this.pool.query(`ALTER TABLE ${table} ADD COLUMN ${columnName} ${definition}`);
    }
  }

  private async ensureIndex(table: string, indexName: string, createSql: string): Promise<void> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS count
         FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND INDEX_NAME = ?`,
      [table, indexName],
    );
    if (Number(rows[0]?.count || 0) === 0) {
      await this.pool.query(createSql);
    }
  }
}

function buildListFilters(query: MonthlyReportListQuery): { whereSql: string; args: Array<string | number> } {
  const where: string[] = [];
  const args: Array<string | number> = [];
  if (query.year) {
    where.push('year = ?');
    args.push(query.year);
  }
  if (query.status) {
    where.push('status = ?');
    args.push(query.status);
  }
  const keyword = String(query.keyword || '').trim();
  if (keyword) {
    where.push('(title LIKE ? OR slug LIKE ? OR excerpt LIKE ?)');
    const pattern = `%${keyword}%`;
    args.push(pattern, pattern, pattern);
  }
  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    args,
  };
}

function listSelectSql(): string {
  return `SELECT id, year, month, slug, title, h1, excerpt, seo_title, seo_description, seo_keywords,
                 cover_image_url, og_image_url, og_image_alt, status, published_at, created_at, updated_at
            FROM monthly_reports`;
}

function detailSelectSql(): string {
  return `SELECT id, year, month, slug, title, h1, excerpt, content_markdown, content_html,
                 seo_title, seo_description, seo_keywords, cover_image_url, og_image_url, og_image_alt,
                 status, published_at, created_at, updated_at
            FROM monthly_reports`;
}

function toMonthlyReport(row: MonthlyReportRow): MonthlyReport {
  return {
    ...toMonthlyReportListItem(row),
    content_markdown: row.content_markdown || '',
    content_html: row.content_html || '',
  };
}

function toMonthlyReportListItem(row: MonthlyReportRow): MonthlyReportListItem {
  return {
    id: Number(row.id),
    year: Number(row.year),
    month: Number(row.month),
    slug: row.slug,
    title: row.title,
    h1: row.h1 || row.title,
    excerpt: row.excerpt || '',
    seo_title: row.seo_title || '',
    seo_description: row.seo_description || '',
    seo_keywords: row.seo_keywords || '',
    cover_image_url: row.cover_image_url || '',
    og_image_url: row.og_image_url || '',
    og_image_alt: row.og_image_alt || '',
    status: row.status,
    published_at: row.published_at ? toIsoString(row.published_at) : null,
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

function toIsoString(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}
