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
        return [schemaChecks <= 12 ? [] : [{ 1: 1 }]];
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
    calls.some((call) => call.sql.includes('INSERT INTO news_topics')),
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
      sql: 'UPDATE news_articles SET view_count = view_count + 1 WHERE id = ?',
      params: [42],
    },
  ]);
});
