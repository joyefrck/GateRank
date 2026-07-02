import test from 'node:test';
import assert from 'node:assert/strict';
import { MonthlyReportRepository } from '../src/repositories/monthlyReportRepository';

test('MonthlyReportRepository.ensureSchema creates table and SEO columns', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const pool = {
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('information_schema.COLUMNS') || sql.includes('information_schema.STATISTICS')) {
        return [[{ count: 0 }], []];
      }
      return [[], []];
    },
  };

  const repository = new MonthlyReportRepository(pool as never);
  await repository.ensureSchema();

  assert.ok(calls.some((call) => call.sql.includes('CREATE TABLE IF NOT EXISTS monthly_reports')));
  assert.ok(calls.some((call) => call.sql.includes('ALTER TABLE monthly_reports ADD COLUMN seo_title')));
  assert.ok(calls.some((call) => call.sql.includes('ALTER TABLE monthly_reports ADD COLUMN seo_description')));
  assert.ok(calls.some((call) => call.sql.includes('ALTER TABLE monthly_reports ADD COLUMN seo_keywords')));
  assert.ok(calls.some((call) => call.sql.includes('ALTER TABLE monthly_reports ADD COLUMN og_image_url')));
  assert.ok(calls.some((call) => call.sql.includes('CREATE INDEX idx_monthly_reports_status_published_at')));
  assert.ok(calls.some((call) => call.sql.includes('CREATE UNIQUE INDEX uk_monthly_reports_year_month')));
});

test('MonthlyReportRepository.create rejects duplicate active period', async () => {
  const pool = {
    query: async (sql: string) => {
      if (sql.includes('FROM monthly_reports') && sql.includes('year = ?')) {
        return [[{ id: 7 }], []];
      }
      return [[], []];
    },
    execute: async () => [{ insertId: 1, affectedRows: 1 }, []],
  };
  const repository = new MonthlyReportRepository(pool as never);

  await assert.rejects(
    () => repository.create({
      year: 2026,
      month: 6,
      slug: '2026-06-airport-vpn-ranking-report',
      title: '2026年6月机场 VPN 月度报告',
      h1: '2026年6月机场 VPN 月度报告',
      excerpt: '摘要',
      content_markdown: '正文',
      content_html: '<p>正文</p>',
      seo_title: '',
      seo_description: '',
      seo_keywords: '',
      cover_image_url: '',
      og_image_url: '',
      og_image_alt: '',
      status: 'draft',
    }),
    /MONTHLY_REPORT_PERIOD_CONFLICT/,
  );
});
