import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { AddressInfo } from 'node:net';
import { createMonthlyReportAdminRoutes } from '../src/routes/monthlyReportAdminRoutes';
import { NewsContentService } from '../src/services/newsContentService';
import { NewsCoverImageService } from '../src/services/newsCoverImageService';
import { errorHandler } from '../src/middleware/errorHandler';

test('POST /monthly-reports/:id/publish rejects incomplete report body', async () => {
  const app = express();
  app.use(express.json());
  app.use(createMonthlyReportAdminRoutes({
    auditRepository: { log: async () => undefined } as never,
    newsContentService: new NewsContentService(),
    newsCoverImageService: new NewsCoverImageService(),
    monthlyReportRepository: {
      getById: async () => ({
        id: 1,
        year: 2026,
        month: 6,
        slug: '2026-06-airport-vpn-ranking-report',
        title: '2026年6月机场 VPN 月度报告',
        h1: '2026年6月机场 VPN 月度报告',
        excerpt: '',
        content_markdown: '',
        content_html: '',
        seo_title: '',
        seo_description: '',
        seo_keywords: '',
        cover_image_url: '',
        og_image_url: '',
        og_image_alt: '',
        status: 'draft',
        published_at: null,
        created_at: '2026-07-01 00:00:00',
        updated_at: '2026-07-01 00:00:00',
      }),
      update: async () => true,
    } as never,
  }));
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/monthly-reports/1/publish`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 400);
    assert.match(await response.text(), /正文不能为空/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /monthly-reports/upload-markdown renders sanitized markdown', async () => {
  const app = express();
  app.use(createMonthlyReportAdminRoutes({
    auditRepository: { log: async () => undefined } as never,
    newsContentService: new NewsContentService(),
    newsCoverImageService: new NewsCoverImageService(),
    monthlyReportRepository: {} as never,
  }));
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const body = new FormData();
    body.append('file', new Blob(['# 标题\n\n<script>alert(1)</script>\n\n正文 **加粗**'], { type: 'text/markdown' }), 'report.md');
    const response = await fetch(`http://127.0.0.1:${port}/monthly-reports/upload-markdown`, {
      method: 'POST',
      body,
    });
    assert.equal(response.status, 201);
    const data = await response.json() as { content_markdown: string; content_html: string; excerpt: string };
    assert.doesNotMatch(data.content_markdown, /^# 标题/);
    assert.doesNotMatch(data.content_html, /<script>/);
    assert.match(data.content_html, /<strong>加粗<\/strong>/);
    assert.match(data.excerpt, /正文/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /monthly-reports/generate creates draft report and logs audit event', async () => {
  const auditActions: string[] = [];
  const generatedReport = {
    year: 2026,
    month: 6,
    slug: '2026-06-airport-vpn-ranking-report',
    title: '2026年6月机场 VPN 月度报告',
    h1: '2026年6月机场 VPN 月度报告',
    excerpt: '自动生成摘要',
    content_markdown: '## 一、执行摘要',
    content_html: '<h2>一、执行摘要</h2>',
    seo_title: '2026年6月机场 VPN 月度报告',
    seo_description: '自动生成 SEO 描述',
    seo_keywords: '机场VPN月度报告',
    cover_image_url: '',
    og_image_url: '',
    og_image_alt: '',
    status: 'draft' as const,
    published_at: null,
  };
  const app = express();
  app.use(express.json());
  app.use(createMonthlyReportAdminRoutes({
    auditRepository: { log: async (action: string) => { auditActions.push(action); } } as never,
    newsContentService: new NewsContentService(),
    newsCoverImageService: new NewsCoverImageService(),
    monthlyReportGenerationService: {
      generate: async (period: { year: number; month: number }) => ({ ...generatedReport, ...period }),
      buildPeriodOptions: async () => ({ years: [] }),
    } as never,
    monthlyReportRepository: {
      create: async () => 42,
      getById: async () => ({
        id: 42,
        ...generatedReport,
        created_at: '2026-07-02 12:00:00',
        updated_at: '2026-07-02 12:00:00',
      }),
    } as never,
  }));
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/monthly-reports/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ year: 2026, month: 6 }),
    });
    const data = await response.json() as { id: number; year: number; month: number; status: string };

    assert.equal(response.status, 201);
    assert.equal(data.id, 42);
    assert.equal(data.year, 2026);
    assert.equal(data.month, 6);
    assert.equal(data.status, 'draft');
    assert.deepEqual(auditActions, ['generate_monthly_report']);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /monthly-reports/generate rejects current and future months before generation', async () => {
  const current = getCurrentShanghaiYearMonth();
  let called = false;
  const app = express();
  app.use(express.json());
  app.use(createMonthlyReportAdminRoutes({
    auditRepository: { log: async () => undefined } as never,
    newsContentService: new NewsContentService(),
    newsCoverImageService: new NewsCoverImageService(),
    monthlyReportGenerationService: {
      generate: async () => {
        called = true;
        throw new Error('should not call generator');
      },
      buildPeriodOptions: async () => ({ years: [] }),
    } as never,
    monthlyReportRepository: {} as never,
  }));
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const currentResponse = await fetch(`http://127.0.0.1:${port}/monthly-reports/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ year: current.year, month: current.month }),
    });
    const futureMonth = current.month === 12 ? 1 : current.month + 1;
    const futureYear = current.month === 12 ? current.year + 1 : current.year;
    const futureResponse = await fetch(`http://127.0.0.1:${port}/monthly-reports/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ year: futureYear, month: futureMonth }),
    });

    assert.equal(currentResponse.status, 400);
    assert.equal(futureResponse.status, 400);
    assert.equal(called, false);
    assert.match(await currentResponse.text(), /已经完成的月份/);
    assert.match(await futureResponse.text(), /已经完成的月份/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /monthly-reports/period-options marks duplicate and current periods unavailable', async () => {
  const app = express();
  app.use(createMonthlyReportAdminRoutes({
    auditRepository: { log: async () => undefined } as never,
    newsContentService: new NewsContentService(),
    newsCoverImageService: new NewsCoverImageService(),
    monthlyReportGenerationService: {
      buildPeriodOptions: async () => ({
        years: [{
          year: 2026,
          months: [
            { year: 2026, month: 5, label: '5 月', available: false, reason: '该月份已经存在报告' },
            { year: 2026, month: 6, label: '6 月', available: true, reason: null },
            { year: 2026, month: 7, label: '7 月', available: false, reason: '当前月尚未结束' },
          ],
        }],
      }),
    } as never,
    monthlyReportRepository: {} as never,
  }));
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/monthly-reports/period-options`);
    const data = await response.json() as { years: Array<{ year: number; months: Array<{ month: number; available: boolean; reason: string | null }> }> };

    assert.equal(response.status, 200);
    assert.equal(data.years[0].months.find((item) => item.month === 5)?.available, false);
    assert.equal(data.years[0].months.find((item) => item.month === 6)?.available, true);
    assert.match(data.years[0].months.find((item) => item.month === 7)?.reason || '', /尚未结束/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

function getCurrentShanghaiYearMonth(): { year: number; month: number } {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date());
  const [year, month] = formatted.split('-').map((part) => Number(part));
  return { year, month };
}
