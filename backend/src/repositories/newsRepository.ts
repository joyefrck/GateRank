import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import {
  DEFAULT_NEWS_CATEGORIES,
  DEFAULT_NEWS_TOPICS,
} from '../../../shared/newsTaxonomy';
import type {
  NewsArticle,
  NewsArticleListItem,
  NewsCategorySummary,
  NewsStatus,
  NewsTopicSummary,
} from '../types/domain';

interface NewsArticleRow extends RowDataPacket {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  cover_image_url: string;
  content_markdown: string;
  content_html: string;
  category_id: number | null;
  is_featured: number | boolean;
  is_recommended: number | boolean;
  recommend_weight: number;
  status: NewsStatus;
  published_at: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
  category_name: string | null;
  category_slug: string | null;
  category_description: string | null;
  category_sort_order: number | null;
}

interface NewsTaxonomyRow extends RowDataPacket {
  id: number;
  name: string;
  slug: string;
  description: string;
  seo_title?: string;
  seo_description?: string;
  h1?: string;
  intro?: string;
  cover_image_url?: string;
  accent_color?: string;
  faq_json?: string | null;
  sort_order: number;
  is_active?: number | boolean;
  updated_at?: string | null;
}

interface NewsArticleTopicRow extends NewsTaxonomyRow {
  article_id: number;
}

export interface CreateNewsArticleInput {
  title: string;
  slug: string;
  excerpt: string;
  cover_image_url: string;
  content_markdown: string;
  content_html: string;
  category_id?: number | null;
  topic_ids?: number[];
  is_featured?: boolean;
  is_recommended?: boolean;
  recommend_weight?: number;
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
  category_id?: number | null;
  topic_ids?: number[];
  is_featured?: boolean;
  is_recommended?: boolean;
  recommend_weight?: number;
  status?: NewsStatus;
  published_at?: string | null;
}

export interface NewsListQuery {
  keyword?: string;
  status?: NewsStatus;
  category_slug?: string;
  topic_slug?: string;
  exclude_ids?: number[];
  page?: number;
  pageSize?: number;
}

export interface NewsTopicFaqItem {
  question: string;
  answer: string;
}

export interface NewsTopicInput {
  name: string;
  slug: string;
  description: string;
  seo_title?: string;
  seo_description?: string;
  h1?: string;
  intro?: string;
  cover_image_url?: string;
  accent_color?: string;
  faq_items?: NewsTopicFaqItem[];
  sort_order?: number;
  is_active?: boolean;
  pinned_article_ids?: number[];
}

export type UpdateNewsTopicInput = Partial<NewsTopicInput>;

export class NewsRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS news_categories (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        name VARCHAR(120) NOT NULL,
        slug VARCHAR(160) NOT NULL,
        description TEXT NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_news_categories_slug (slug),
        INDEX idx_news_categories_active_sort (is_active, sort_order, id)
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS news_topics (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        name VARCHAR(160) NOT NULL,
        slug VARCHAR(180) NOT NULL,
        description TEXT NOT NULL,
        seo_title VARCHAR(255) NOT NULL DEFAULT '',
        seo_description TEXT NULL,
        h1 VARCHAR(255) NOT NULL DEFAULT '',
        intro TEXT NULL,
        cover_image_url VARCHAR(1024) NOT NULL DEFAULT '',
        accent_color VARCHAR(16) NOT NULL DEFAULT '#d43d31',
        faq_json JSON NULL,
        sort_order INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_news_topics_slug (slug),
        INDEX idx_news_topics_active_sort (is_active, sort_order, id)
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS news_topic_pinned_articles (
        topic_id BIGINT UNSIGNED NOT NULL,
        article_id BIGINT UNSIGNED NOT NULL,
        position INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (topic_id, article_id),
        INDEX idx_news_topic_pinned_articles_topic_position (topic_id, position, article_id),
        INDEX idx_news_topic_pinned_articles_article (article_id)
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS news_articles (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        excerpt TEXT NOT NULL,
        cover_image_url VARCHAR(1024) NOT NULL,
        content_markdown MEDIUMTEXT NOT NULL,
        content_html MEDIUMTEXT NOT NULL,
        category_id BIGINT UNSIGNED NULL,
        is_featured TINYINT(1) NOT NULL DEFAULT 0,
        is_recommended TINYINT(1) NOT NULL DEFAULT 0,
        recommend_weight INT NOT NULL DEFAULT 0,
        status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
        published_at DATETIME NULL,
        view_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_news_articles_slug (slug),
        INDEX idx_news_articles_status_published_at (status, published_at DESC),
        INDEX idx_news_articles_category_status (category_id, status, published_at DESC),
        INDEX idx_news_articles_recommended (status, is_recommended, recommend_weight, published_at DESC),
        INDEX idx_news_articles_updated_at (updated_at DESC)
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS news_article_topics (
        article_id BIGINT UNSIGNED NOT NULL,
        topic_id BIGINT UNSIGNED NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (article_id, topic_id),
        INDEX idx_news_article_topics_topic (topic_id, article_id)
      )
    `);

    await this.ensureColumn('news_articles', 'excerpt', 'TEXT NOT NULL AFTER slug');
    await this.ensureColumn('news_articles', 'cover_image_url', 'VARCHAR(1024) NOT NULL AFTER excerpt');
    await this.ensureColumn('news_articles', 'content_markdown', 'MEDIUMTEXT NOT NULL AFTER cover_image_url');
    await this.ensureColumn('news_articles', 'content_html', 'MEDIUMTEXT NOT NULL AFTER content_markdown');
    await this.ensureColumn('news_articles', 'category_id', 'BIGINT UNSIGNED NULL AFTER content_html');
    await this.ensureColumn('news_articles', 'is_featured', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER category_id');
    await this.ensureColumn('news_articles', 'is_recommended', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER is_featured');
    await this.ensureColumn('news_articles', 'recommend_weight', 'INT NOT NULL DEFAULT 0 AFTER is_recommended');
    await this.ensureColumn(
      'news_articles',
      'status',
      "ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft' AFTER recommend_weight",
    );
    await this.ensureColumn('news_articles', 'published_at', 'DATETIME NULL AFTER status');
    await this.ensureColumn('news_articles', 'view_count', 'BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER published_at');
    await this.ensureColumn(
      'news_articles',
      'updated_at',
      'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at',
    );
    await this.ensureColumn('news_topics', 'seo_title', "VARCHAR(255) NOT NULL DEFAULT '' AFTER description");
    await this.ensureColumn('news_topics', 'seo_description', 'TEXT NULL AFTER seo_title');
    await this.ensureColumn('news_topics', 'h1', "VARCHAR(255) NOT NULL DEFAULT '' AFTER seo_description");
    await this.ensureColumn('news_topics', 'intro', 'TEXT NULL AFTER h1');
    await this.ensureColumn('news_topics', 'cover_image_url', "VARCHAR(1024) NOT NULL DEFAULT '' AFTER intro");
    await this.ensureColumn('news_topics', 'accent_color', "VARCHAR(16) NOT NULL DEFAULT '#d43d31' AFTER cover_image_url");
    await this.ensureColumn('news_topics', 'faq_json', 'JSON NULL AFTER accent_color');
    await this.ensureIndex(
      'news_articles',
      'idx_news_articles_category_status',
      'CREATE INDEX idx_news_articles_category_status ON news_articles (category_id, status, published_at DESC)',
    );
    await this.ensureIndex(
      'news_articles',
      'idx_news_articles_recommended',
      'CREATE INDEX idx_news_articles_recommended ON news_articles (status, is_recommended, recommend_weight, published_at DESC)',
    );
    await this.normalizeArticleTopicsForSingleTopic();
    await this.ensureIndex(
      'news_article_topics',
      'uk_news_article_topics_article',
      'CREATE UNIQUE INDEX uk_news_article_topics_article ON news_article_topics (article_id)',
    );
    await this.ensureDefaultTaxonomy();
  }

  async listCategories(): Promise<NewsCategorySummary[]> {
    const [rows] = await this.pool.query<NewsTaxonomyRow[]>(
      `SELECT id, name, slug, description, sort_order
         FROM news_categories
        WHERE is_active = 1
        ORDER BY sort_order ASC, id ASC`,
    );
    return rows.map(toTaxonomySummary);
  }

  async listTopics(options: { includeInactive?: boolean } = {}): Promise<NewsTopicSummary[]> {
    const where = options.includeInactive ? '' : 'WHERE is_active = 1';
    const [rows] = await this.pool.query<NewsTaxonomyRow[]>(
      `SELECT ${topicSelectColumns()}
         FROM news_topics
        ${where}
        ORDER BY sort_order ASC, id ASC`,
    );
    return rows.map(toTopicSummary);
  }

  async getCategoryBySlug(slug: string): Promise<NewsCategorySummary | null> {
    const [rows] = await this.pool.query<NewsTaxonomyRow[]>(
      `SELECT id, name, slug, description, sort_order
         FROM news_categories
        WHERE slug = ?
          AND is_active = 1
        LIMIT 1`,
      [slug],
    );
    return rows[0] ? toTaxonomySummary(rows[0]) : null;
  }

  async getTopicBySlug(slug: string): Promise<NewsTopicSummary | null> {
    const [rows] = await this.pool.query<NewsTaxonomyRow[]>(
      `SELECT ${topicSelectColumns()}
         FROM news_topics
        WHERE slug = ?
          AND is_active = 1
        LIMIT 1`,
      [slug],
    );
    return rows[0] ? toTopicSummary(rows[0]) : null;
  }

  async getTopicById(id: number): Promise<NewsTopicSummary | null> {
    const [rows] = await this.pool.query<NewsTaxonomyRow[]>(
      `SELECT ${topicSelectColumns()}
         FROM news_topics
        WHERE id = ?
        LIMIT 1`,
      [id],
    );
    return rows[0] ? toTopicSummary(rows[0]) : null;
  }

  async createTopic(input: NewsTopicInput): Promise<number> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO news_topics (
         name,
         slug,
         description,
         seo_title,
         seo_description,
         h1,
         intro,
         cover_image_url,
         accent_color,
         faq_json,
         sort_order,
         is_active
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.name,
        input.slug,
        input.description,
        input.seo_title || '',
        input.seo_description || '',
        input.h1 || '',
        input.intro || '',
        input.cover_image_url || '',
        input.accent_color || '#d43d31',
        JSON.stringify(input.faq_items || []),
        input.sort_order || 0,
        input.is_active === false ? 0 : 1,
      ],
    );
    const id = Number(result.insertId);
    if (input.pinned_article_ids) {
      await this.setTopicPinnedArticleIds(id, input.pinned_article_ids);
    }
    return id;
  }

  async updateTopic(id: number, input: UpdateNewsTopicInput): Promise<boolean> {
    const updates: string[] = [];
    const params: Array<string | number | null> = [];
    const pushString = (column: string, value: string | undefined): void => {
      if (value !== undefined) {
        updates.push(`${column} = ?`);
        params.push(value);
      }
    };
    pushString('name', input.name);
    pushString('slug', input.slug);
    pushString('description', input.description);
    pushString('seo_title', input.seo_title);
    pushString('seo_description', input.seo_description);
    pushString('h1', input.h1);
    pushString('intro', input.intro);
    pushString('cover_image_url', input.cover_image_url);
    pushString('accent_color', input.accent_color);
    if (input.faq_items !== undefined) {
      updates.push('faq_json = ?');
      params.push(JSON.stringify(input.faq_items));
    }
    if (input.sort_order !== undefined) {
      updates.push('sort_order = ?');
      params.push(input.sort_order);
    }
    if (input.is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(input.is_active ? 1 : 0);
    }

    let changed = false;
    if (updates.length > 0) {
      params.push(id);
      const [result] = await this.pool.execute<ResultSetHeader>(
        `UPDATE news_topics
            SET ${updates.join(', ')},
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        params,
      );
      changed = result.affectedRows > 0;
    }

    if (input.pinned_article_ids !== undefined) {
      await this.setTopicPinnedArticleIds(id, input.pinned_article_ids);
      changed = true;
    }
    return changed;
  }

  async archiveTopic(id: number): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      'UPDATE news_topics SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id],
    );
    return result.affectedRows > 0;
  }

  async getTopicPinnedArticleIds(topicId: number): Promise<number[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT article_id
         FROM news_topic_pinned_articles
        WHERE topic_id = ?
        ORDER BY position ASC, article_id ASC`,
      [topicId],
    );
    return rows.map((row) => Number(row.article_id)).filter((id) => id > 0);
  }

  async setTopicPinnedArticleIds(topicId: number, articleIds: number[]): Promise<void> {
    await this.pool.execute('DELETE FROM news_topic_pinned_articles WHERE topic_id = ?', [topicId]);
    const cleanIds = Array.from(new Set(articleIds.map((id) => Math.floor(Number(id))).filter((id) => id > 0)));
    if (cleanIds.length === 0) {
      return;
    }
    const placeholders = cleanIds.map(() => '(?, ?, ?)').join(', ');
    const params = cleanIds.flatMap((articleId, index) => [topicId, articleId, index + 1]);
    await this.pool.execute(
      `INSERT INTO news_topic_pinned_articles (topic_id, article_id, position) VALUES ${placeholders}`,
      params,
    );
  }

  async validateTopicPinnedArticleIds(topicId: number, articleIds: number[]): Promise<boolean> {
    const cleanIds = Array.from(new Set(articleIds.map((id) => Math.floor(Number(id))).filter((id) => id > 0)));
    if (cleanIds.length === 0) {
      return true;
    }
    const placeholders = cleanIds.map(() => '?').join(', ');
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT DISTINCT a.id
         FROM news_articles a
         INNER JOIN news_article_topics nat ON nat.article_id = a.id
        WHERE nat.topic_id = ?
          AND a.id IN (${placeholders})
          AND a.status = 'published'
          AND a.published_at IS NOT NULL`,
      [topicId, ...cleanIds],
    );
    return rows.length === cleanIds.length;
  }

  async listByQuery(query: NewsListQuery): Promise<{ items: NewsArticleListItem[]; total: number }> {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 20));
    const offset = (page - 1) * pageSize;
    const filters = buildListFilters(query);

    const [totalRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT a.id) AS total
         FROM news_articles a
         LEFT JOIN news_categories nc ON nc.id = a.category_id
         ${filters.joinSql}
        ${filters.whereSql}`,
      filters.args,
    );

    const [rows] = await this.pool.query<NewsArticleRow[]>(
      `${baseSelectSql()}
       ${filters.joinSql}
       ${filters.whereSql}
       ORDER BY
         CASE WHEN a.published_at IS NULL THEN 1 ELSE 0 END ASC,
         a.published_at DESC,
         a.updated_at DESC
       LIMIT ? OFFSET ?`,
      [...filters.args, pageSize, offset],
    );

    const articles = await this.attachTopics(rows.map((row) => toNewsArticle(row)));
    return {
      total: Number(totalRows[0]?.total || 0),
      items: articles.map(toNewsArticleListItem),
    };
  }

  async listPublished(options: NewsListQuery): Promise<{
    items: NewsArticleListItem[];
    total: number;
  }> {
    const detailed = await this.listPublishedDetailed(options);
    return {
      total: detailed.total,
      items: detailed.items.map(toNewsArticleListItem),
    };
  }

  async listPublishedDetailed(options: NewsListQuery): Promise<{
    items: NewsArticle[];
    total: number;
  }> {
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(50, Math.max(1, options.pageSize || 12));
    const offset = (page - 1) * pageSize;
    const filters = buildListFilters({ ...options, status: 'published' });
    filters.where.push('a.published_at IS NOT NULL');
    filters.rebuildWhereSql();

    const [totalRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT a.id) AS total
         FROM news_articles a
         LEFT JOIN news_categories nc ON nc.id = a.category_id
         ${filters.joinSql}
        ${filters.whereSql}`,
      filters.args,
    );
    const [rows] = await this.pool.query<NewsArticleRow[]>(
      `${baseSelectSql()}
       ${filters.joinSql}
       ${filters.whereSql}
       ORDER BY a.published_at DESC, a.id DESC
       LIMIT ? OFFSET ?`,
      [...filters.args, pageSize, offset],
    );

    return {
      total: Number(totalRows[0]?.total || 0),
      items: await this.attachTopics(rows.map((row) => toNewsArticle(row))),
    };
  }

  async listPublishedPinnedByTopic(topicId: number): Promise<NewsArticle[]> {
    const [rows] = await this.pool.query<NewsArticleRow[]>(
      `${baseSelectSql()}
       INNER JOIN news_topic_pinned_articles ntpa ON ntpa.article_id = a.id
       WHERE ntpa.topic_id = ?
         AND a.status = 'published'
         AND a.published_at IS NOT NULL
       ORDER BY ntpa.position ASC, ntpa.article_id ASC`,
      [topicId],
    );
    return this.attachTopics(rows.map((row) => toNewsArticle(row)));
  }

  async getFeaturedPublished(options: Pick<NewsListQuery, 'category_slug' | 'topic_slug' | 'keyword'> = {}): Promise<NewsArticle | null> {
    const filters = buildListFilters({ ...options, status: 'published' });
    filters.where.push('a.published_at IS NOT NULL');
    filters.where.push('a.is_featured = 1');
    filters.rebuildWhereSql();
    const [rows] = await this.pool.query<NewsArticleRow[]>(
      `${baseSelectSql()}
       ${filters.joinSql}
       ${filters.whereSql}
       ORDER BY a.recommend_weight DESC, a.published_at DESC, a.id DESC
       LIMIT 1`,
      filters.args,
    );
    const articles = await this.attachTopics(rows.map((row) => toNewsArticle(row)));
    return articles[0] || null;
  }

  async listRecommendedPublished(limit = 6): Promise<NewsArticleListItem[]> {
    const [rows] = await this.pool.query<NewsArticleRow[]>(
      `${baseSelectSql()}
       WHERE a.status = 'published'
         AND a.published_at IS NOT NULL
         AND a.is_recommended = 1
       ORDER BY a.recommend_weight DESC, a.published_at DESC, a.id DESC
       LIMIT ?`,
      [Math.min(20, Math.max(1, limit))],
    );
    const articles = await this.attachTopics(rows.map((row) => toNewsArticle(row)));
    return articles.map(toNewsArticleListItem);
  }

  async listLatestByCategory(categorySlug: string, limit = 3): Promise<NewsArticleListItem[]> {
    const result = await this.listPublishedDetailed({
      category_slug: categorySlug,
      page: 1,
      pageSize: Math.min(12, Math.max(1, limit)),
    });
    return result.items.map(toNewsArticleListItem);
  }

  async listPublishedForSitemap(limit = 500): Promise<NewsArticleListItem[]> {
    const [rows] = await this.pool.query<NewsArticleRow[]>(
      `${baseSelectSql()}
       WHERE a.status = 'published'
         AND a.published_at IS NOT NULL
       ORDER BY a.published_at DESC, a.id DESC
       LIMIT ?`,
      [limit],
    );
    const articles = await this.attachTopics(rows.map((row) => toNewsArticle(row)));
    return articles.map(toNewsArticleListItem);
  }

  async getById(id: number): Promise<NewsArticle | null> {
    const [rows] = await this.pool.query<NewsArticleRow[]>(
      `${baseSelectSql()}
       WHERE a.id = ?
       LIMIT 1`,
      [id],
    );
    const articles = await this.attachTopics(rows.map((row) => toNewsArticle(row)));
    return articles[0] || null;
  }

  async getBySlug(slug: string): Promise<NewsArticle | null> {
    const [rows] = await this.pool.query<NewsArticleRow[]>(
      `${baseSelectSql()}
       WHERE a.slug = ?
       LIMIT 1`,
      [slug],
    );
    const articles = await this.attachTopics(rows.map((row) => toNewsArticle(row)));
    return articles[0] || null;
  }

  async getPublishedBySlug(slug: string): Promise<NewsArticle | null> {
    const [rows] = await this.pool.query<NewsArticleRow[]>(
      `${baseSelectSql()}
       WHERE a.slug = ?
         AND a.status = 'published'
         AND a.published_at IS NOT NULL
       LIMIT 1`,
      [slug],
    );
    const articles = await this.attachTopics(rows.map((row) => toNewsArticle(row)));
    return articles[0] || null;
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
         category_id,
         is_featured,
         is_recommended,
         recommend_weight,
         status,
         published_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.title,
        input.slug,
        input.excerpt,
        input.cover_image_url,
        input.content_markdown,
        input.content_html,
        input.category_id ?? null,
        input.is_featured ? 1 : 0,
        input.is_recommended ? 1 : 0,
        input.recommend_weight || 0,
        input.status || 'draft',
        input.published_at || null,
      ],
    );
    const id = Number(result.insertId);
    if (input.topic_ids) {
      await this.syncArticleTopics(id, input.topic_ids);
    }
    return id;
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
    if (input.category_id !== undefined) {
      updates.push('category_id = ?');
      params.push(input.category_id);
    }
    if (input.is_featured !== undefined) {
      updates.push('is_featured = ?');
      params.push(input.is_featured ? 1 : 0);
    }
    if (input.is_recommended !== undefined) {
      updates.push('is_recommended = ?');
      params.push(input.is_recommended ? 1 : 0);
    }
    if (input.recommend_weight !== undefined) {
      updates.push('recommend_weight = ?');
      params.push(input.recommend_weight);
    }
    if (input.status !== undefined) {
      updates.push('status = ?');
      params.push(input.status);
    }
    if (input.published_at !== undefined) {
      updates.push('published_at = ?');
      params.push(input.published_at);
    }

    let changed = false;
    if (updates.length > 0) {
      params.push(id);
      const [result] = await this.pool.execute<ResultSetHeader>(
        `UPDATE news_articles
            SET ${updates.join(', ')},
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        params,
      );
      changed = result.affectedRows > 0;
    }

    if (input.topic_ids !== undefined) {
      await this.syncArticleTopics(id, input.topic_ids);
      if (updates.length === 0) {
        const [result] = await this.pool.execute<ResultSetHeader>(
          'UPDATE news_articles SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [id],
        );
        changed = result.affectedRows > 0;
      } else {
        changed = true;
      }
    }

    return changed;
  }

  async incrementViewCount(articleId: number): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE news_articles
          SET view_count = view_count + 1,
              updated_at = updated_at
        WHERE id = ?`,
      [articleId],
    );
    return result.affectedRows > 0;
  }

  async deleteById(id: number): Promise<boolean> {
    await this.pool.execute('DELETE FROM news_article_topics WHERE article_id = ?', [id]);
    const [result] = await this.pool.execute<ResultSetHeader>(
      'DELETE FROM news_articles WHERE id = ?',
      [id],
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
       WHERE a.status = 'published'
         AND a.published_at IS NOT NULL
         AND (a.published_at > ? OR (a.published_at = ? AND a.id > ?))
       ORDER BY a.published_at ASC, a.id ASC
       LIMIT 1`,
      [publishedAt, publishedAt, article.id],
    );

    const [nextRows] = await this.pool.query<NewsArticleRow[]>(
      `${baseSelectSql()}
       WHERE a.status = 'published'
         AND a.published_at IS NOT NULL
         AND (a.published_at < ? OR (a.published_at = ? AND a.id < ?))
       ORDER BY a.published_at DESC, a.id DESC
       LIMIT 1`,
      [publishedAt, publishedAt, article.id],
    );

    const [previous, next] = await Promise.all([
      this.attachTopics(previousRows.map((row) => toNewsArticle(row))),
      this.attachTopics(nextRows.map((row) => toNewsArticle(row))),
    ]);

    return {
      previous: previous[0] ? toNewsArticleListItem(previous[0]) : null,
      next: next[0] ? toNewsArticleListItem(next[0]) : null,
    };
  }

  async resolveCategoryId(slug: string): Promise<number | null> {
    const category = await this.getCategoryBySlug(slug);
    return category?.id || null;
  }

  async resolveTopicIds(slugs: string[]): Promise<number[]> {
    const cleanSlugs = Array.from(new Set(slugs.map((slug) => slug.trim()).filter(Boolean)));
    if (cleanSlugs.length === 0) {
      return [];
    }
    const placeholders = cleanSlugs.map(() => '?').join(', ');
    const [rows] = await this.pool.query<NewsTaxonomyRow[]>(
      `SELECT id, name, slug, description, sort_order
         FROM news_topics
        WHERE slug IN (${placeholders})
          AND is_active = 1`,
      cleanSlugs,
    );
    return rows.map((row) => Number(row.id));
  }

  private async syncArticleTopics(articleId: number, topicIds: number[]): Promise<void> {
    await this.pool.execute('DELETE FROM news_article_topics WHERE article_id = ?', [articleId]);
    const cleanIds = Array.from(new Set(topicIds.map((id) => Math.floor(Number(id))).filter((id) => id > 0)));
    if (cleanIds.length === 0) {
      return;
    }
    const placeholders = cleanIds.map(() => '(?, ?)').join(', ');
    const params = cleanIds.flatMap((topicId) => [articleId, topicId]);
    await this.pool.execute(
      `INSERT IGNORE INTO news_article_topics (article_id, topic_id) VALUES ${placeholders}`,
      params,
    );
  }

  private async attachTopics<T extends NewsArticle>(articles: T[]): Promise<T[]> {
    if (articles.length === 0) {
      return articles;
    }
    const ids = articles.map((article) => article.id);
    const placeholders = ids.map(() => '?').join(', ');
    const [rows] = await this.pool.query<NewsArticleTopicRow[]>(
      `SELECT
         nat.article_id,
         nt.id,
         nt.name,
         nt.slug,
         nt.description,
         nt.sort_order
       FROM news_article_topics nat
       INNER JOIN news_topics nt ON nt.id = nat.topic_id
       WHERE nat.article_id IN (${placeholders})
         AND nt.is_active = 1
       ORDER BY nt.sort_order ASC, nt.id ASC`,
      ids,
    );
    const topicsByArticle = new Map<number, NewsTopicSummary[]>();
    rows.forEach((row) => {
      const current = topicsByArticle.get(row.article_id) || [];
      current.push(toTaxonomySummary(row));
      topicsByArticle.set(row.article_id, current);
    });
    return articles.map((article) => ({
      ...article,
      topics: topicsByArticle.get(article.id) || [],
    }));
  }

  private async normalizeArticleTopicsForSingleTopic(): Promise<void> {
    await this.pool.execute(`
      DELETE candidate
        FROM news_article_topics candidate
        INNER JOIN news_topics candidate_topic ON candidate_topic.id = candidate.topic_id
        INNER JOIN news_article_topics preferred
                ON preferred.article_id = candidate.article_id
               AND preferred.topic_id <> candidate.topic_id
        INNER JOIN news_topics preferred_topic ON preferred_topic.id = preferred.topic_id
       WHERE preferred_topic.is_active > candidate_topic.is_active
          OR (
            preferred_topic.is_active = candidate_topic.is_active
            AND preferred_topic.sort_order < candidate_topic.sort_order
          )
          OR (
            preferred_topic.is_active = candidate_topic.is_active
            AND preferred_topic.sort_order = candidate_topic.sort_order
            AND preferred_topic.id < candidate_topic.id
          )
    `);
  }

  private async ensureColumn(tableName: string, columnName: string, definition: string): Promise<void> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT 1
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
        LIMIT 1`,
      [tableName, columnName],
    );

    if (rows.length === 0) {
      await this.pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    }
  }

  private async ensureIndex(tableName: string, indexName: string, createSql: string): Promise<void> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT 1
         FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND INDEX_NAME = ?
        LIMIT 1`,
      [tableName, indexName],
    );
    if (rows.length === 0) {
      await this.pool.query(createSql);
    }
  }

  private async ensureDefaultTaxonomy(): Promise<void> {
    for (const category of DEFAULT_NEWS_CATEGORIES) {
      await this.pool.execute(
        `INSERT INTO news_categories (name, slug, description, sort_order)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           description = VALUES(description),
           sort_order = VALUES(sort_order),
           is_active = 1`,
        [category.name, category.slug, category.description, category.sort_order],
      );
    }

    for (const topic of DEFAULT_NEWS_TOPICS) {
      await this.pool.execute(
        `INSERT IGNORE INTO news_topics (name, slug, description, sort_order)
         VALUES (?, ?, ?, ?)`,
        [topic.name, topic.slug, topic.description, topic.sort_order],
      );
    }
  }
}

function buildListFilters(query: NewsListQuery): {
  joinSql: string;
  where: string[];
  whereSql: string;
  args: Array<string | number>;
  rebuildWhereSql: () => void;
} {
  const join: string[] = [];
  const where: string[] = [];
  const args: Array<string | number> = [];
  const filters = {
    joinSql: '',
    where,
    whereSql: '',
    args,
    rebuildWhereSql: () => {
      filters.whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    },
  };

  if (query.topic_slug) {
    join.push('INNER JOIN news_article_topics filter_nat ON filter_nat.article_id = a.id');
    join.push('INNER JOIN news_topics filter_nt ON filter_nt.id = filter_nat.topic_id');
    where.push('filter_nt.slug = ?');
    where.push('filter_nt.is_active = 1');
    args.push(query.topic_slug);
  }
  if (query.status) {
    where.push('a.status = ?');
    args.push(query.status);
  }
  if (query.category_slug) {
    where.push('nc.slug = ?');
    where.push('nc.is_active = 1');
    args.push(query.category_slug);
  }
  if (query.keyword) {
    where.push('(a.title LIKE ? OR a.slug LIKE ? OR a.excerpt LIKE ? OR a.content_markdown LIKE ?)');
    const keyword = `%${query.keyword}%`;
    args.push(keyword, keyword, keyword, keyword);
  }
  if (query.exclude_ids && query.exclude_ids.length > 0) {
    const excludeIds = Array.from(new Set(query.exclude_ids.map((id) => Math.floor(Number(id))).filter((id) => id > 0)));
    if (excludeIds.length > 0) {
      where.push(`a.id NOT IN (${excludeIds.map(() => '?').join(', ')})`);
      args.push(...excludeIds);
    }
  }

  filters.joinSql = join.join('\n');
  filters.rebuildWhereSql();
  return filters;
}

function baseSelectSql(): string {
  return `SELECT
            a.id,
            a.title,
            a.slug,
            a.excerpt,
            a.cover_image_url,
            a.content_markdown,
            a.content_html,
            a.category_id,
            a.is_featured,
            a.is_recommended,
            a.recommend_weight,
            a.status,
            DATE_FORMAT(a.published_at, '%Y-%m-%d %H:%i:%s') AS published_at,
            a.view_count,
            DATE_FORMAT(a.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
            DATE_FORMAT(a.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
            nc.name AS category_name,
            nc.slug AS category_slug,
            nc.description AS category_description,
            nc.sort_order AS category_sort_order
          FROM news_articles a
          LEFT JOIN news_categories nc ON nc.id = a.category_id`;
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
    category_id: row.category_id === null || row.category_id === undefined ? null : Number(row.category_id),
    is_featured: toBoolean(row.is_featured),
    is_recommended: toBoolean(row.is_recommended),
    recommend_weight: Number(row.recommend_weight || 0),
    status: row.status,
    published_at: row.published_at,
    view_count: Number(row.view_count || 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
    category: row.category_id && row.category_slug
      ? {
          id: Number(row.category_id),
          name: row.category_name || '',
          slug: row.category_slug,
          description: row.category_description || '',
          sort_order: Number(row.category_sort_order || 0),
        }
      : null,
    topics: [],
  };
}

function toNewsArticleListItem(article: NewsArticle): NewsArticleListItem {
  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt,
    cover_image_url: article.cover_image_url,
    category_id: article.category_id,
    is_featured: article.is_featured,
    is_recommended: article.is_recommended,
    recommend_weight: article.recommend_weight,
    status: article.status,
    published_at: article.published_at,
    view_count: article.view_count,
    created_at: article.created_at,
    updated_at: article.updated_at,
    category: article.category,
    topics: article.topics,
  };
}

function topicSelectColumns(): string {
  return `id,
          name,
          slug,
          description,
          seo_title,
          seo_description,
          h1,
          intro,
          cover_image_url,
          accent_color,
          faq_json,
          sort_order,
          is_active,
          DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at`;
}

function toTaxonomySummary(row: NewsTaxonomyRow): NewsCategorySummary {
  return {
    id: Number(row.id),
    name: row.name,
    slug: row.slug,
    description: row.description,
    sort_order: Number(row.sort_order || 0),
  };
}

function toTopicSummary(row: NewsTaxonomyRow): NewsTopicSummary {
  return {
    id: Number(row.id),
    name: row.name,
    slug: row.slug,
    description: row.description,
    seo_title: row.seo_title || '',
    seo_description: row.seo_description || '',
    h1: row.h1 || '',
    intro: row.intro || '',
    cover_image_url: row.cover_image_url || '',
    accent_color: row.accent_color || '#d43d31',
    faq_items: parseFaqItems(row.faq_json),
    sort_order: Number(row.sort_order || 0),
    is_active: row.is_active === undefined ? true : toBoolean(row.is_active),
    updated_at: row.updated_at || null,
  };
}

function parseFaqItems(value: unknown): NewsTopicFaqItem[] {
  if (!value) {
    return [];
  }
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const record = item as Record<string, unknown>;
      const question = String(record.question || '').trim();
      const answer = String(record.answer || '').trim();
      return question && answer ? { question, answer } : null;
    })
    .filter((item): item is NewsTopicFaqItem => Boolean(item));
}

function toBoolean(value: number | boolean): boolean {
  return value === true || value === 1;
}
