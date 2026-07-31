import test from 'node:test';
import assert from 'node:assert/strict';
import { NewsRepository } from '../src/repositories/newsRepository';

test('NewsRepository.ensureSchema creates news_articles table and missing columns', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  let schemaChecks = 0;

  const repository = new NewsRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('FROM information_schema.COLUMNS')) {
        schemaChecks += 1;
        return [schemaChecks <= 19 ? [] : [{ 1: 1 }]];
      }
      return [[]];
    },
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return [{}];
    },
  } as never);

  await repository.ensureSchema();

  assert.ok(
    calls.some((call) => call.sql.includes('CREATE TABLE IF NOT EXISTS news_articles')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('CREATE TABLE IF NOT EXISTS news_categories')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('CREATE TABLE IF NOT EXISTS news_topics')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE news_articles ADD COLUMN excerpt TEXT NOT NULL AFTER slug')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE news_articles ADD COLUMN category_id BIGINT UNSIGNED NULL AFTER content_html')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes("ALTER TABLE news_articles ADD COLUMN status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft' AFTER recommend_weight")),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE news_articles ADD COLUMN published_at DATETIME NULL AFTER status')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE news_articles ADD COLUMN view_count BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER published_at')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('INSERT INTO news_categories')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('INSERT IGNORE INTO news_topics')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('CREATE TABLE IF NOT EXISTS news_topic_pinned_articles')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE news_topics ADD COLUMN seo_title VARCHAR(255) NOT NULL DEFAULT')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE news_topics ADD COLUMN faq_json JSON NULL')),
  );
  assert.ok(
    calls.some((call) => (
      call.sql.includes('DELETE candidate')
      && call.sql.includes('preferred_topic.is_active > candidate_topic.is_active')
    )),
  );
  assert.ok(
    calls.some((call) => (
      call.sql.includes('CREATE UNIQUE INDEX uk_news_article_topics_article')
      && call.sql.includes('news_article_topics (article_id)')
    )),
  );
  const topicSeedCalls = calls.filter((call) => call.sql.includes('INSERT INTO news_topics'));
  assert.ok(topicSeedCalls.every((call) => call.sql.includes('INSERT IGNORE INTO news_topics')));
});

test('NewsRepository.update touches article timestamp for topic-only changes', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const repository = new NewsRepository({
    query: async () => [[]],
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return [{ affectedRows: 1 }];
    },
  } as never);

  const changed = await repository.update(42, { topic_ids: [7] });

  assert.equal(changed, true);
  assert.ok(
    calls.some((call) => (
      call.sql.includes('DELETE FROM news_article_topics WHERE article_id = ?')
      && JSON.stringify(call.params) === JSON.stringify([42])
    )),
  );
  assert.ok(
    calls.some((call) => (
      call.sql.includes('UPDATE news_articles SET updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      && JSON.stringify(call.params) === JSON.stringify([42])
    )),
  );
});

test('NewsRepository.incrementViewCount increments article view count by id', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];

  const repository = new NewsRepository({
    query: async () => [[]],
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return [{ affectedRows: 1 }];
    },
  } as never);

  const changed = await repository.incrementViewCount(42);

  assert.equal(changed, true);
  assert.deepEqual(calls, [
    {
      sql: `UPDATE news_articles
          SET view_count = view_count + 1,
              updated_at = updated_at
        WHERE id = ?`,
      params: [42],
    },
  ]);
});

test('NewsRepository.createTopic stores SEO, FAQ and pinned article fields', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const repository = new NewsRepository({
    query: async () => [[]],
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('INSERT INTO news_topics')) {
        return [{ insertId: 88, affectedRows: 1 }];
      }
      return [{ affectedRows: 1 }];
    },
  } as never);

  const id = await repository.createTopic({
    name: '年度推荐专题',
    slug: 'annual-recommendations',
    description: '专题描述',
    seo_title: '年度推荐专题 SEO 标题',
    seo_description: '年度推荐专题 SEO 描述',
    h1: '年度推荐专题 H1',
    intro: '专题导语',
    cover_image_url: '/uploads/news/topic.webp',
    accent_color: '#d43d31',
    faq_items: [{ question: '怎么选？', answer: '看稳定性。' }],
    sort_order: 15,
    is_active: true,
    pinned_article_ids: [3, 1],
  });

  assert.equal(id, 88);
  assert.ok(calls.some((call) => call.sql.includes('INSERT INTO news_topics')));
  assert.ok(
    calls.some((call) => call.sql.includes('INSERT INTO news_topic_pinned_articles') && JSON.stringify(call.params) === JSON.stringify([88, 3, 1, 88, 1, 2])),
  );
});
