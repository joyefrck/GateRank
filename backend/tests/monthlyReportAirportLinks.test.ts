import test from 'node:test';
import assert from 'node:assert/strict';
import type { Airport, MonthlyReport } from '../src/types/domain';
import {
  enhanceMonthlyReportAirportLinks,
  MonthlyReportPublicService,
} from '../src/services/monthlyReportPublicService';

test('enhanceMonthlyReportAirportLinks links listed airport names in text nodes', () => {
  const html = '<table><tbody><tr><td>测试机场 A</td><td>18.00</td></tr></tbody></table>';

  const enhanced = enhanceMonthlyReportAirportLinks(html, [
    createAirport({ name: '测试机场 A', slug: 'xiaomi', is_listed: true }),
  ]);

  assert.match(
    enhanced,
    /<a class="news-link" href="\/airports\/xiaomi" target="_blank" rel="noreferrer noopener">测试机场 A<\/a>/,
  );
});

test('enhanceMonthlyReportAirportLinks does not rewrite existing anchor content', () => {
  const html = '<p><a href="/airports/existing">测试机场 A</a> 和 测试机场 A</p>';

  const enhanced = enhanceMonthlyReportAirportLinks(html, [
    createAirport({ name: '测试机场 A', slug: 'xiaomi', is_listed: true }),
  ]);

  assert.equal(
    enhanced,
    '<p><a href="/airports/existing">测试机场 A</a> 和 <a class="news-link" href="/airports/xiaomi" target="_blank" rel="noreferrer noopener">测试机场 A</a></p>',
  );
});

test('enhanceMonthlyReportAirportLinks ignores hidden airports', () => {
  const html = '<p>隐藏机场 和 上架机场</p>';

  const enhanced = enhanceMonthlyReportAirportLinks(html, [
    createAirport({ name: '隐藏机场', slug: 'hidden', is_listed: false }),
    createAirport({ name: '上架机场', slug: 'listed', is_listed: true }),
  ]);

  assert.doesNotMatch(enhanced, /\/airports\/hidden/);
  assert.match(enhanced, /href="\/airports\/listed"/);
});

test('enhanceMonthlyReportAirportLinks matches longer airport names first', () => {
  const html = '<p>测试机场 A Pro 对比 测试机场 A</p>';

  const enhanced = enhanceMonthlyReportAirportLinks(html, [
    createAirport({ name: '测试机场 A', slug: 'airport-a', is_listed: true }),
    createAirport({ name: '测试机场 A Pro', slug: 'airport-a-pro', is_listed: true }),
  ]);

  assert.match(enhanced, /href="\/airports\/airport-a-pro"[^>]*>测试机场 A Pro<\/a> 对比/);
  assert.match(enhanced, /对比 <a class="news-link" href="\/airports\/airport-a"/);
});

test('MonthlyReportPublicService enhances published report content without changing stored markdown', async () => {
  const report = createMonthlyReport({
    content_markdown: '| 机场 |\n| --- |\n| 测试机场 A |',
    content_html: '<table><tbody><tr><td>测试机场 A</td></tr></tbody></table>',
  });
  const service = new MonthlyReportPublicService({
    listByQuery: async () => ({ items: [], total: 0 }),
    getPublishedBySlug: async () => report,
    listPublishedForSitemap: async () => [],
  } as never, {
    listAll: async () => [createAirport({ name: '测试机场 A', slug: 'xiaomi', is_listed: true })],
  });

  const view = await service.getBySlug('2026-06-airport-vpn-ranking-report');

  assert.ok(view);
  assert.equal(view.content_markdown, report.content_markdown);
  assert.match(view.content_html, /href="\/airports\/xiaomi" target="_blank" rel="noreferrer noopener"/);
});

function createAirport(input: { name: string; slug: string; is_listed: boolean }): Airport {
  return {
    id: Math.floor(Math.random() * 100000),
    slug: input.slug,
    name: input.name,
    website: `https://${input.slug}.example.com`,
    websites: [`https://${input.slug}.example.com`],
    status: 'normal',
    is_listed: input.is_listed,
    plan_price_month: 20,
    has_trial: true,
    tags: [],
    created_at: '2026-07-01T00:00:00+08:00',
  };
}

function createMonthlyReport(input: Partial<MonthlyReport> = {}): MonthlyReport {
  return {
    id: 1,
    year: 2026,
    month: 6,
    slug: '2026-06-airport-vpn-ranking-report',
    title: '2026年6月机场 VPN 月度报告',
    h1: '2026年6月机场 VPN 月度报告',
    excerpt: '6 月机场推荐、机场排名与跑路风险观察。',
    content_markdown: '## 本月摘要',
    content_html: '<p>本月摘要</p>',
    seo_title: '',
    seo_description: '',
    seo_keywords: '',
    cover_image_url: '',
    og_image_url: '',
    og_image_alt: '',
    status: 'published',
    published_at: '2026-07-01 10:00:00',
    created_at: '2026-07-01 09:00:00',
    updated_at: '2026-07-01 10:30:00',
    ...input,
  };
}
