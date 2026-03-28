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
        return [schemaChecks <= 7 ? [] : [{ 1: 1 }]];
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
    calls.some((call) => call.sql.includes('ALTER TABLE news_articles ADD COLUMN excerpt TEXT NOT NULL AFTER slug')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes("ALTER TABLE news_articles ADD COLUMN status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft' AFTER content_html")),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE news_articles ADD COLUMN published_at DATETIME NULL AFTER status')),
  );
});
