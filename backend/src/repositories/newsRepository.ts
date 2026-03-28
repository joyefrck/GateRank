import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { NewsArticle, NewsArticleListItem, NewsStatus } from '../types/domain';

interface NewsArticleRow extends RowDataPacket {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  cover_image_url: string;
  content_markdown: string;
  content_html: string;
  status: NewsStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateNewsArticleInput {
  title: string;
  slug: string;
  excerpt: string;
  cover_image_url: string;
  content_markdown: string;
  content_html: string;
  status?: NewsStatus;
  published_at?: string | null;
}

export interface UpdateNewsArticleInput {
  title?: string;
  slug?: string;
  excerpt?: string;
  cover_image_url?: string;
  content_markdown?: string;
  content_html?: string;
  status?: NewsStatus;
  published_at?: string | null;
}

export class NewsRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS news_articles (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        excerpt TEXT NOT NULL,
        cover_image_url VARCHAR(1024) NOT NULL,
        content_markdown MEDIUMTEXT NOT NULL,
        content_html MEDIUMTEXT NOT NULL,
        status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
        published_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_news_articles_slug (slug),
        INDEX idx_news_articles_status_published_at (status, published_at DESC),
        INDEX idx_news_articles_updated_at (updated_at DESC)
      )
    `);

    await this.ensureColumn('excerpt', 'TEXT NOT NULL AFTER slug');
    await this.ensureColumn('cover_image_url', 'VARCHAR(1024) NOT NULL AFTER excerpt');
    await this.ensureColumn('content_markdown', 'MEDIUMTEXT NOT NULL AFTER cover_image_url');
    await this.ensureColumn('content_html', 'MEDIUMTEXT NOT NULL AFTER content_markdown');
    await this.ensureColumn(
      'status',
      "ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft' AFTER content_html",
    );
    await this.ensureColumn('published_at', 'DATETIME NULL AFTER status');
    await this.ensureColumn(
      'updated_at',
      'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at',
    );
  }

  async listByQuery(query: {
    keyword?: string;
    status?: NewsStatus;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: NewsArticleListItem[]; total: number }> {
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
      where.push('(title LIKE ? OR slug LIKE ?)');
      const keyword = `%${query.keyword}%`;
      args.push(keyword, keyword);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [totalRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM news_articles ${whereSql}`,
      args,
    );

    const [rows] = await this.pool.query<NewsArticleRow[]>(
      `${baseSelectSql()}
       ${whereSql}
       ORDER BY
         CASE WHEN published_at IS NULL THEN 1 ELSE 0 END ASC,
         published_at DESC,
         updated_at DESC
       LIMIT ? OFFSET ?`,
      [...args, pageSize, offset],
    );

    return {
      total: Number(totalRows[0]?.total || 0),
      items: rows.map((row) => toNewsArticleListItem(row)),
    };
  }

  async listPublished(options: { page?: number; pageSize?: number }): Promise<{
    items: NewsArticleListItem[];
    total: number;
  }> {
    const detailed = await this.listPublishedDetailed(options);
    return {
      total: detailed.total,
      items: detailed.items.map((item) => ({
        id: item.id,
        title: item.title,
        slug: item.slug,
        excerpt: item.excerpt,
        cover_image_url: item.cover_image_url,
        status: item.status,
        published_at: item.published_at,
        created_at: item.created_at,
        updated_at: item.updated_at,
      })),
    };
  }

  async listPublishedDetailed(options: { page?: number; pageSize?: number }): Promise<{
    items: NewsArticle[];
    total: number;
  }> {
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(50, Math.max(1, options.pageSize || 12));
    const offset = (page - 1) * pageSize;
    const [totalRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
         FROM news_articles
        WHERE status = 'published'
          AND published_at IS NOT NULL`,
    );
    const [rows] = await this.pool.query<NewsArticleRow[]>(
      `${baseSelectSql()}
       WHERE status = 'published'
         AND published_at IS NOT NULL
       ORDER BY published_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [pageSize, offset],
    );

    return {
      total: Number(totalRows[0]?.total || 0),
      items: rows.map((row) => toNewsArticle(row)),
    };
  }

  async listPublishedForSitemap(limit = 500): Promise<NewsArticleListItem[]> {
    const [rows] = await this.pool.query<NewsArticleRow[]>(
      `${baseSelectSql()}
       WHERE status = 'published'
         AND published_at IS NOT NULL
       ORDER BY published_at DESC, id DESC
       LIMIT ?`,
      [limit],
    );
    return rows.map((row) => toNewsArticleListItem(row));
  }

  async getById(id: number): Promise<NewsArticle | null> {
    const [rows] = await this.pool.query<NewsArticleRow[]>(
      `${baseSelectSql()}
       WHERE id = ?
       LIMIT 1`,
      [id],
    );
    if (rows.length === 0) {
      return null;
    }
    return toNewsArticle(rows[0]);
  }

  async getBySlug(slug: string): Promise<NewsArticle | null> {
    const [rows] = await this.pool.query<NewsArticleRow[]>(
      `${baseSelectSql()}
       WHERE slug = ?
       LIMIT 1`,
      [slug],
    );
    if (rows.length === 0) {
      return null;
    }
    return toNewsArticle(rows[0]);
  }

  async getPublishedBySlug(slug: string): Promise<NewsArticle | null> {
    const [rows] = await this.pool.query<NewsArticleRow[]>(
      `${baseSelectSql()}
       WHERE slug = ?
         AND status = 'published'
         AND published_at IS NOT NULL
       LIMIT 1`,
      [slug],
    );
    if (rows.length === 0) {
      return null;
    }
    return toNewsArticle(rows[0]);
  }

  async create(input: CreateNewsArticleInput): Promise<number> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO news_articles (
         title,
         slug,
         excerpt,
         cover_image_url,
         content_markdown,
         content_html,
         status,
         published_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.title,
        input.slug,
        input.excerpt,
        input.cover_image_url,
        input.content_markdown,
        input.content_html,
        input.status || 'draft',
        input.published_at || null,
      ],
    );
    return Number(result.insertId);
  }

  async update(id: number, input: UpdateNewsArticleInput): Promise<boolean> {
    const updates: string[] = [];
    const params: Array<string | number | null> = [];

    if (input.title !== undefined) {
      updates.push('title = ?');
      params.push(input.title);
    }
    if (input.slug !== undefined) {
      updates.push('slug = ?');
      params.push(input.slug);
    }
    if (input.excerpt !== undefined) {
      updates.push('excerpt = ?');
      params.push(input.excerpt);
    }
    if (input.cover_image_url !== undefined) {
      updates.push('cover_image_url = ?');
      params.push(input.cover_image_url);
    }
    if (input.content_markdown !== undefined) {
      updates.push('content_markdown = ?');
      params.push(input.content_markdown);
    }
    if (input.content_html !== undefined) {
      updates.push('content_html = ?');
      params.push(input.content_html);
    }
    if (input.status !== undefined) {
      updates.push('status = ?');
      params.push(input.status);
    }
    if (input.published_at !== undefined) {
      updates.push('published_at = ?');
      params.push(input.published_at);
    }

    if (updates.length === 0) {
      return false;
    }

    params.push(id);

    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE news_articles
          SET ${updates.join(', ')},
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      params,
    );
    return result.affectedRows > 0;
  }

  async findAdjacentPublished(article: NewsArticle): Promise<{
    previous: NewsArticleListItem | null;
    next: NewsArticleListItem | null;
  }> {
    const publishedAt = article.published_at;
    if (!publishedAt) {
      return { previous: null, next: null };
    }

    const [previousRows] = await this.pool.query<NewsArticleRow[]>(
      `${baseSelectSql()}
       WHERE status = 'published'
         AND published_at IS NOT NULL
         AND (published_at > ? OR (published_at = ? AND id > ?))
       ORDER BY published_at ASC, id ASC
       LIMIT 1`,
      [publishedAt, publishedAt, article.id],
    );

    const [nextRows] = await this.pool.query<NewsArticleRow[]>(
      `${baseSelectSql()}
       WHERE status = 'published'
         AND published_at IS NOT NULL
         AND (published_at < ? OR (published_at = ? AND id < ?))
       ORDER BY published_at DESC, id DESC
       LIMIT 1`,
      [publishedAt, publishedAt, article.id],
    );

    return {
      previous: previousRows[0] ? toNewsArticleListItem(previousRows[0]) : null,
      next: nextRows[0] ? toNewsArticleListItem(nextRows[0]) : null,
    };
  }

  private async ensureColumn(columnName: string, definition: string): Promise<void> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT 1
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
        LIMIT 1`,
      ['news_articles', columnName],
    );

    if (rows.length === 0) {
      await this.pool.query(`ALTER TABLE news_articles ADD COLUMN ${columnName} ${definition}`);
    }
  }
}

function baseSelectSql(): string {
  return `SELECT
            id,
            title,
            slug,
            excerpt,
            cover_image_url,
            content_markdown,
            content_html,
            status,
            DATE_FORMAT(published_at, '%Y-%m-%d %H:%i:%s') AS published_at,
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
          FROM news_articles`;
}

function toNewsArticle(row: NewsArticleRow): NewsArticle {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    cover_image_url: row.cover_image_url,
    content_markdown: row.content_markdown,
    content_html: row.content_html,
    status: row.status,
    published_at: row.published_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toNewsArticleListItem(row: NewsArticleRow): NewsArticleListItem {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    cover_image_url: row.cover_image_url,
    status: row.status,
    published_at: row.published_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
