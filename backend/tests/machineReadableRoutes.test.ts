import test from 'node:test';
import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import express from 'express';
import { createMachineReadableRoutes } from '../src/routes/machineReadableRoutes';
import type { FullRankingView, HomePageView, MonthlyReport, ReportView, RiskMonitorView } from '../src/types/domain';
import type { AirportDealView } from '../../shared/airportAds';
import type { MarketingEventInsertRecord } from '../src/utils/marketing';

test('GET /llms.txt and /llms-full.txt return plain text AI entrypoints', async () => {
  const { baseUrl, close } = await startMachineReadableServer();
  try {
    for (const path of ['/llms.txt', '/llms-full.txt']) {
      const response = await fetch(`${baseUrl}${path}`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type') || '', /text\/plain; charset=utf-8/);
      assert.equal(
        response.headers.get('cache-control'),
        'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
      );
      const body = await response.text();
      assert.doesNotMatch(body, /<!doctype html/i);
      assert.match(body, /# 机场榜GateRank/);
      assert.match(body, /https?:\/\/127\.0\.0\.1:\d+\/rankings\/all/);
      assert.match(body, /https?:\/\/127\.0\.0\.1:\d+\/monthly-reports/);
      assert.match(body, /https?:\/\/127\.0\.0\.1:\d+\/deals/);
      assert.match(body, /机场推荐/);
      assert.match(body, /Preferred citation/);
    }
  } finally {
    await close();
  }
});

test('GET /robots.txt returns explicit crawl policy and content signals', async () => {
  const { baseUrl, close } = await startMachineReadableServer();
  try {
    const response = await fetch(`${baseUrl}/robots.txt`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /text\/plain; charset=utf-8/);
    assert.equal(
      response.headers.get('cache-control'),
      'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
    );
    const body = await response.text();
    assert.match(body, /^User-agent: \*/m);
    assert.match(body, /^Disallow: \/admin$/m);
    assert.match(body, /^Disallow: \/api\/v1\/admin$/m);
    assert.match(body, /^Disallow: \/portal$/m);
    assert.match(body, /^Disallow: \/api\/v1\/portal$/m);
    assert.match(body, /^Allow: \/$/m);
    assert.match(body, new RegExp(`^Sitemap: ${baseUrl.replace(/\//g, '\\/')}/sitemap\\.xml$`, 'm'));
    assert.match(body, new RegExp(`^Sitemap: ${baseUrl.replace(/\//g, '\\/')}/sitemap-ai\\.xml$`, 'm'));
    assert.match(body, /^Content-Signal: search=yes, ai-input=yes, ai-train=no$/m);
  } finally {
    await close();
  }
});

test('GET /sitemap-ai.xml returns curated machine-readable and dynamic Markdown URLs', async () => {
  const { baseUrl, close } = await startMachineReadableServer();
  try {
    const response = await fetch(`${baseUrl}/sitemap-ai.xml`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /application\/xml/);
    assert.equal(
      response.headers.get('cache-control'),
      'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
    );
    const xml = await response.text();
    const locations = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), (match) => match[1]);
    assert.equal(new Set(locations).size, locations.length);
    for (const path of [
      '/llms.txt',
      '/llms-full.txt',
      '/for-ai',
      '/data/rankings.json',
      '/data/rankings.md',
      '/data/risk-monitor.json',
      '/data/risk-monitor.md',
      '/deals.md',
      '/monthly-reports.md',
      '/tools',
      '/tools/download',
      '/airports/nebula.md',
      '/monthly-reports/2026-06-airport-vpn-ranking-report.md',
    ]) {
      assert.ok(locations.includes(`${baseUrl}${path}`), path);
    }
  } finally {
    await close();
  }
});

test('GET /for-ai returns an indexable HTML guide for AI applications', async () => {
  const { baseUrl, close } = await startMachineReadableServer();
  try {
    const response = await fetch(`${baseUrl}/for-ai`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /text\/html/);
    assert.equal(
      response.headers.get('cache-control'),
      'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
    );
    const html = await response.text();
    assert.match(html, /<h1>GateRank for AI：机场榜数据、引用方式与机器可读入口<\/h1>/);
    assert.match(html, /<meta name="robots" content="index,follow,max-image-preview:large"/);
    assert.match(html, new RegExp(`<link rel="canonical" href="${baseUrl.replace(/\//g, '\\/')}/for-ai"`));
    assert.match(html, new RegExp(`<meta property="og:image" content="${baseUrl.replace(/\//g, '\\/')}/og/for-ai\\.png" />`));
    assert.match(html, new RegExp(`<meta property="og:image:secure_url" content="${baseUrl.replace(/\//g, '\\/')}/og/for-ai\\.png" />`));
    assert.match(html, /<meta property="og:image:alt" content="GateRank for AI 数据入口分享图" \/>/);
    assert.match(html, new RegExp(`<meta name="twitter:image" content="${baseUrl.replace(/\//g, '\\/')}/og/for-ai\\.png" />`));
    assert.match(html, /\/data\/summary\.json/);
    assert.match(html, /\/data\/rankings\.json/);
    assert.match(html, /\/data\/risk-monitor\.json/);
    assert.match(html, /\/sitemap\.xml/);
    assert.match(html, /\/rankings\/payment\/alipay/);
    assert.match(html, /\/rankings\/unlock\/chatgpt/);
    assert.match(html, /\/tools\/ip-check/);
    assert.match(html, /\/tools\/dns-leak-test/);
    assert.doesNotMatch(html, /\/rankings\/all\?payment=alipay/);
  } finally {
    await close();
  }
});

test('GET /for-ai records one page view while machine-readable routes record none', async () => {
  const records: MarketingEventInsertRecord[] = [];
  const marketingRepository = {
    insertMany: async (items: MarketingEventInsertRecord[]) => {
      records.push(...items);
    },
  };
  const { baseUrl, close } = await startMachineReadableServer({ marketingRepository });
  try {
    assert.equal((await fetch(`${baseUrl}/for-ai`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/llms.txt`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/data/summary.json`)).status, 200);
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(
      records.map(({ page_kind, page_path }) => ({ page_kind, page_path })),
      [{ page_kind: 'for_ai', page_path: '/for-ai' }],
    );
  } finally {
    await close();
  }
});

test('GET /for-ai error response records no page view', async () => {
  const records: MarketingEventInsertRecord[] = [];
  const publicViewService = {
    ...createPublicViewServiceStub(),
    getHomePageView: async (): Promise<HomePageView> => {
      throw new Error('summary unavailable');
    },
  };
  const { baseUrl, close } = await startMachineReadableServer({
    publicViewService,
    marketingRepository: {
      insertMany: async (items: MarketingEventInsertRecord[]) => {
        records.push(...items);
      },
    },
  });
  try {
    assert.equal((await fetch(`${baseUrl}/for-ai`)).status, 500);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(records, []);
  } finally {
    await close();
  }
});

test('GET /openapi.json and /.well-known/ai-plugin.json return JSON 404 instead of HTML fallback', async () => {
  const { baseUrl, close } = await startMachineReadableServer();
  try {
    for (const path of ['/openapi.json', '/.well-known/ai-plugin.json']) {
      const response = await fetch(`${baseUrl}${path}`);
      assert.equal(response.status, 404);
      assert.match(response.headers.get('content-type') || '', /application\/json/);
      const body = await response.text();
      assert.doesNotMatch(body, /<!doctype html/i);
      const payload = JSON.parse(body) as { error: { code: string } };
      assert.equal(payload.error.code, 'NOT_FOUND');
    }
  } finally {
    await close();
  }
});

test('GET /data/*.json returns stable public machine-readable fields', async () => {
  const { baseUrl, close } = await startMachineReadableServer();
  try {
    const summaryResponse = await fetch(`${baseUrl}/data/summary.json`);
    assert.equal(summaryResponse.status, 200);
    assert.match(summaryResponse.headers.get('content-type') || '', /application\/json/);
    assert.equal(
      summaryResponse.headers.get('cache-control'),
      'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
    );
    const summary = await summaryResponse.json() as {
      site: string;
      airport_count: number;
      speed_test_count: number;
      risk_count: number;
      data_files: { rankings_json: string };
    };
    assert.equal(summary.site, '机场榜GateRank');
    assert.equal(summary.airport_count, 12);
    assert.equal(summary.speed_test_count, 345);
    assert.equal(summary.risk_count, 1);
    assert.match(summary.data_files.rankings_json, /\/data\/rankings\.json$/);

    const rankingsResponse = await fetch(`${baseUrl}/data/rankings.json`);
    assert.equal(rankingsResponse.status, 200);
    const rankings = await rankingsResponse.json() as {
      total: number;
      items: Array<{
        rank: number;
        name: string;
        slug: string;
        status: string;
        score: number;
        monthly_price: number;
        payment_methods: string[];
        clients: string[];
        node_regions: string[];
        report_url: string;
        score_delta_vs_yesterday: { label: string; value: number };
        updated_at: string;
      }>;
    };
    assert.equal(rankings.total, 1);
    assert.deepEqual(rankings.items[0], {
      rank: 2,
      name: '星云机场',
      slug: 'nebula',
      status: 'normal',
      score: 98.6,
      monthly_price: 18,
      payment_methods: ['支付宝', 'USDT-TRC20'],
      clients: ['Clash', 'Shadowrocket'],
      node_regions: ['香港'],
      report_url: '/airports/nebula',
      score_delta_vs_yesterday: { label: '对比昨天', value: 1.2 },
      updated_at: '2026-03-23',
    });

    const riskResponse = await fetch(`${baseUrl}/data/risk-monitor.json`);
    assert.equal(riskResponse.status, 200);
    const risk = await riskResponse.json() as {
      items: Array<{
        monitor_reason: string;
        risk_penalty: number;
        risk_reasons: string[];
        risk_reason_summary: string;
      }>;
    };
    assert.equal(risk.items[0].monitor_reason, 'risk_watch');
    assert.equal(risk.items[0].risk_penalty, 12);
    assert.deepEqual(risk.items[0].risk_reasons, ['domain']);
    assert.equal(risk.items[0].risk_reason_summary, '域名或证书风险');
  } finally {
    await close();
  }
});

test('GET /data/*.md and /airports/:slug.md return Markdown facts and citations', async () => {
  const { baseUrl, close } = await startMachineReadableServer();
  try {
    const dataIndexResponse = await fetch(`${baseUrl}/data`);
    assert.equal(dataIndexResponse.status, 200);
    assert.match(dataIndexResponse.headers.get('content-type') || '', /text\/markdown; charset=utf-8/);
    const dataIndexMarkdown = await dataIndexResponse.text();
    assert.match(dataIndexMarkdown, /^# 机场榜GateRank machine-readable data/m);
    assert.match(dataIndexMarkdown, /summary\.json/);
    assert.match(dataIndexMarkdown, /rankings\.json/);
    assert.match(dataIndexMarkdown, /risk-monitor\.json/);
    assert.match(dataIndexMarkdown, /deals\.json/);
    assert.match(dataIndexMarkdown, /monthly-reports\.json/);

    const summaryResponse = await fetch(`${baseUrl}/data/summary.md`);
    assert.equal(summaryResponse.status, 200);
    assert.match(summaryResponse.headers.get('content-type') || '', /text\/markdown; charset=utf-8/);
    assert.match(await summaryResponse.text(), /^# 机场榜GateRank 数据摘要/m);

    const rankingsResponse = await fetch(`${baseUrl}/data/rankings.md`);
    assert.equal(rankingsResponse.status, 200);
    const rankingsMarkdown = await rankingsResponse.text();
    assert.match(rankingsMarkdown, /^# 机场榜GateRank 全量机场榜单/m);
    assert.match(rankingsMarkdown, /\| 2 \| 星云机场 \| 正常 \| 98\.6 \| ¥18 \| 支付宝、USDT-TRC20 \| Clash、Shadowrocket \| 香港 \| \/airports\/nebula \|/);

    const riskResponse = await fetch(`${baseUrl}/data/risk-monitor.md`);
    assert.equal(riskResponse.status, 200);
    assert.match(await riskResponse.text(), /风险观察/);

    const airportResponse = await fetch(`${baseUrl}/airports/nebula.md`);
    assert.equal(airportResponse.status, 200);
    assert.match(airportResponse.headers.get('content-type') || '', /text\/markdown; charset=utf-8/);
    const airportMarkdown = await airportResponse.text();
    assert.doesNotMatch(airportMarkdown, /<!doctype html/i);
    assert.match(airportMarkdown, /^# 星云机场 事实卡/m);
    assert.match(airportMarkdown, /- GateRank 公开评分：98\.6\/100/);
    assert.match(airportMarkdown, /- 当前排名：#2/);
    assert.match(airportMarkdown, /- 支持支付方式：支付宝、USDT-TRC20/);
    assert.match(airportMarkdown, /- 节点地区：香港 6 节点 IEPL/);
    assert.match(airportMarkdown, /https:\/\/nebula\.example\.com/);

    const missingResponse = await fetch(`${baseUrl}/airports/missing.md`);
    assert.equal(missingResponse.status, 404);
    assert.match(missingResponse.headers.get('content-type') || '', /text\/plain; charset=utf-8/);
    assert.doesNotMatch(await missingResponse.text(), /<!doctype html/i);
  } finally {
    await close();
  }
});

test('GET deal and monthly report machine-readable endpoints return stable public payloads', async () => {
  const { baseUrl, close } = await startMachineReadableServer();
  try {
    const dealsMarkdownResponse = await fetch(`${baseUrl}/deals.md`);
    assert.equal(dealsMarkdownResponse.status, 200);
    assert.match(dealsMarkdownResponse.headers.get('content-type') || '', /text\/markdown; charset=utf-8/);
    assert.equal(
      dealsMarkdownResponse.headers.get('cache-control'),
      'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
    );
    const dealsMarkdown = await dealsMarkdownResponse.text();
    assert.doesNotMatch(dealsMarkdown, /<!doctype html/i);
    assert.match(dealsMarkdown, /^# GateRank deals and coupons/m);
    assert.match(dealsMarkdown, /星云机场/);
    assert.match(dealsMarkdown, /NEW220/);
    assert.match(dealsMarkdown, /\/airports\/nebula/);

    const dealsJsonResponse = await fetch(`${baseUrl}/data/deals.json`);
    assert.equal(dealsJsonResponse.status, 200);
    assert.match(dealsJsonResponse.headers.get('content-type') || '', /application\/json/);
    const dealsJson = await dealsJsonResponse.json() as {
      total: number;
      items: Array<{ airport_name: string; coupon_code: string; report_url: string }>;
    };
    assert.equal(dealsJson.total, 1);
    assert.deepEqual(dealsJson.items[0], {
      airport_name: '星云机场',
      coupon_code: 'NEW220',
      report_url: '/airports/nebula',
    });

    const monthlyMarkdownResponse = await fetch(`${baseUrl}/monthly-reports.md`);
    assert.equal(monthlyMarkdownResponse.status, 200);
    assert.match(monthlyMarkdownResponse.headers.get('content-type') || '', /text\/markdown; charset=utf-8/);
    const monthlyMarkdown = await monthlyMarkdownResponse.text();
    assert.doesNotMatch(monthlyMarkdown, /<!doctype html/i);
    assert.match(monthlyMarkdown, /^# GateRank monthly reports/m);
    assert.match(monthlyMarkdown, /2026年6月机场 VPN 月度报告/);
    assert.match(monthlyMarkdown, /\/monthly-reports\/2026-06-airport-vpn-ranking-report/);

    const monthlyJsonResponse = await fetch(`${baseUrl}/data/monthly-reports.json`);
    assert.equal(monthlyJsonResponse.status, 200);
    assert.match(monthlyJsonResponse.headers.get('content-type') || '', /application\/json/);
    const monthlyJson = await monthlyJsonResponse.json() as {
      total: number;
      reports: Array<{ month: string; title: string; url: string; sample_size: number; top_airports: string[]; topics: string[] }>;
    };
    assert.equal(monthlyJson.total, 1);
    assert.deepEqual(monthlyJson.reports[0], {
      month: '2026-06',
      title: '2026年6月机场 VPN 月度报告',
      url: `${baseUrl}/monthly-reports/2026-06-airport-vpn-ranking-report`,
      sample_size: 61,
      top_airports: ['大象网络', 'Now加速', '仙踪湾'],
      topics: ['机场推荐', '机场排行榜', '机场测评', '风险观察'],
    });

    const detailMarkdownResponse = await fetch(`${baseUrl}/monthly-reports/2026-06-airport-vpn-ranking-report.md`);
    assert.equal(detailMarkdownResponse.status, 200);
    assert.match(detailMarkdownResponse.headers.get('content-type') || '', /text\/markdown; charset=utf-8/);
    const detailMarkdown = await detailMarkdownResponse.text();
    assert.doesNotMatch(detailMarkdown, /<!doctype html/i);
    assert.match(detailMarkdown, /^# 2026年6月机场 VPN 月度报告/m);
    assert.match(detailMarkdown, /## 本月摘要/);

    const missingDetailResponse = await fetch(`${baseUrl}/monthly-reports/missing.md`);
    assert.equal(missingDetailResponse.status, 404);
    assert.match(missingDetailResponse.headers.get('content-type') || '', /text\/plain; charset=utf-8/);
    assert.doesNotMatch(await missingDetailResponse.text(), /<!doctype html/i);
  } finally {
    await close();
  }
});

test('mounted machine-readable routes do not fall through to app 404 fallback', async () => {
  const app = express();
  app.use(createMachineReadableRoutes(createMachineReadableDeps()));
  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'APP_NOT_FOUND' } });
  });

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;
    for (const path of [
      '/robots.txt',
      '/sitemap-ai.xml',
      '/llms.txt',
      '/llms-full.txt',
      '/for-ai',
      '/data',
      '/data/summary.json',
      '/data/rankings.json',
      '/data/risk-monitor.json',
      '/data/rankings.md',
      '/data/risk-monitor.md',
      '/deals.md',
      '/data/deals.json',
      '/monthly-reports.md',
      '/data/monthly-reports.json',
      '/monthly-reports/2026-06-airport-vpn-ranking-report.md',
    ]) {
      const response = await fetch(`${baseUrl}${path}`);
      assert.notEqual(response.status, 404, path);
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

async function startMachineReadableServer(
  overrides: Record<string, unknown> = {},
) {
  const app = express();
  const defaultDeps = createMachineReadableDeps() as unknown as Record<string, unknown>;
  app.use(createMachineReadableRoutes({
    ...defaultDeps,
    ...overrides,
  } as never));
  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

function createMachineReadableDeps() {
  return {
    publicViewService: createPublicViewServiceStub(),
    airportAdCampaignRepository: {
      listActiveDeals: async (): Promise<AirportDealView[]> => [dealView],
    },
    monthlyReportPublicService: {
      getListView: async () => ({
        page: 1,
        page_size: 12,
        total: 1,
        total_pages: 1,
        items: [monthlyReportListItem],
      }),
      getBySlug: async (slug: string): Promise<MonthlyReport | null> => (
        slug === monthlyReport.slug ? monthlyReport : null
      ),
      getSitemapItems: async () => [monthlyReportListItem],
    },
  } as never;
}

function createPublicViewServiceStub() {
  return {
    getHomePageView: async (): Promise<HomePageView> => homeView,
    getFullRankingView: async (): Promise<FullRankingView> => fullRankingView,
    getRiskMonitorView: async (): Promise<RiskMonitorView> => riskMonitorView,
    getReportViewBySlug: async (slug: string): Promise<ReportView | null> => (slug === 'nebula' ? reportView : null),
  };
}

const dealView: AirportDealView = {
  campaign_id: 1,
  airport_id: 7,
  airport_name: '星云机场',
  airport_slug: 'nebula',
  website: 'https://nebula.example.com',
  report_url: '/airports/nebula',
  coupon_code: 'NEW220',
  discount_title: '新用户优惠',
  discount_description: '新用户首单 8 折，部分月付套餐可用',
  applicable_plan: '月付 / 季付',
  starts_at: '2026-05-24T10:00:00+08:00',
  ends_at: '2026-06-24T10:00:00+08:00',
  purchased_months: 1,
  billed_amount: 1000,
  is_stackable: false,
  refund_supported: false,
  supports_trial: true,
  supports_usdt: true,
  supports_streaming: true,
  supports_ai: true,
  low_price_plan: true,
  discount_percent: 20,
  created_at: '2026-05-24T10:00:00+08:00',
};

const monthlyReportListItem = {
  id: 1,
  year: 2026,
  month: 6,
  slug: '2026-06-airport-vpn-ranking-report',
  title: '2026年6月机场 VPN 月度报告',
  h1: '2026年6月机场 VPN 月度报告',
  excerpt: '6 月机场推荐、机场排名与跑路风险观察。',
  seo_title: '',
  seo_description: '',
  seo_keywords: '',
  cover_image_url: '',
  og_image_url: '',
  og_image_alt: '',
  status: 'published' as const,
  published_at: '2026-07-01 10:00:00',
  created_at: '2026-07-01 09:00:00',
  updated_at: '2026-07-01 10:30:00',
};

const monthlyReport: MonthlyReport = {
  ...monthlyReportListItem,
  content_markdown: '## 本月摘要\n\n样本数：61。\n\nTop 3 机场：大象网络、Now加速、仙踪湾。',
  content_html: '<h2>本月摘要</h2><p>样本数：61。</p>',
};

const homeView: HomePageView = {
  requested_date: '2026-03-23',
  date: '2026-03-23',
  resolved_from_fallback: false,
  fallback_notice: null,
  generated_at: '2026-03-23T10:00:00+08:00',
  hero: {
    report_time_at: '2026-03-23T08:00:00+08:00',
    report_time_text: '2 小时前',
    monitored_airports: 12,
    realtime_tests: 345,
  },
  tool_download_cta: {
    href: '/tools/download',
    title: '翻墙工具客户端下载',
    description: 'Android、macOS、Windows、Linux 常用客户端集中下载，覆盖 v2rayN、Karing、Clash Meta 等订阅工具。',
    platforms: ['Android', 'macOS', 'Windows', 'Linux'],
    items: [],
  },
  sections: {
    today_pick: { title: '今日推荐机场', subtitle: "Today's Top Pick", items: [] },
    most_stable: { title: '长期稳定机场', subtitle: 'Most Stable', items: [] },
    best_value: { title: '性价比最佳', subtitle: 'Best Value', items: [] },
    new_entries: { title: '新入榜潜力', subtitle: 'New Entries', items: [] },
    risk_alerts: { title: '风险预警', subtitle: 'Risk Alerts', items: [] },
  },
};

const fullRankingView: FullRankingView = {
  date: '2026-03-23',
  generated_at: '2026-03-23T10:00:00+08:00',
  page: 1,
  page_size: 100,
  total: 1,
  total_pages: 1,
  tool_download_cta: {
    href: '/tools/download',
    title: '翻墙工具客户端下载',
    description: '常用客户端集中下载。',
    platforms: ['Android', 'macOS', 'Windows', 'Linux'],
    items: [],
  },
  items: [
    {
      airport_id: 7,
      rank: 2,
      name: '星云机场',
      website: 'https://nebula.example.com',
      status: 'normal',
      tags: ['稳定', '高速'],
      founded_on: '2025-01-01',
      plan_price_month: 18,
      has_trial: true,
      airport_intro: '适合日常使用。',
      created_at: '2025-01-01',
      score: 98.6,
      score_delta_vs_yesterday: { label: '对比昨天', value: 1.2 },
      score_date: '2026-03-23',
      report_url: '/airports/nebula',
      capabilities: {
        payment_methods: [
          { key: 'alipay', label: '支付宝' },
          { key: 'usdt_trc20', label: 'USDT-TRC20' },
        ],
        streaming: [{ key: 'netflix', label: 'Netflix' }],
        clients: [
          { key: 'clash', label: 'Clash' },
          { key: 'shadowrocket', label: 'Shadowrocket' },
        ],
        import_methods: [{ key: 'one_click_import', label: '一键导入' }],
        regions: [
          {
            key: 'hong_kong',
            label: '香港',
            line_types: [{ key: 'iepl', label: 'IEPL' }],
            has_residential: false,
            has_native_ip: true,
          },
        ],
        plan: {
          supports_annual: true,
          has_lifetime_plan: false,
        },
        telegram: {
          has_group: true,
          group_allows_speaking: false,
        },
      },
    },
  ],
};

const riskMonitorView: RiskMonitorView = {
  ...fullRankingView,
  items: [
    {
      ...fullRankingView.items[0],
      status: 'risk',
      monitor_reason: 'risk_watch',
      risk_penalty: 12,
      risk_reasons: ['domain'],
      risk_reason_summary: '域名或证书风险',
      snapshot_is_stale: false,
    },
  ],
};

const reportView: ReportView = {
  requested_date: '2026-03-23',
  date: '2026-03-23',
  resolved_from_fallback: false,
  fallback_notice: null,
  tool_download_cta: {
    href: '/tools/download',
    title: '翻墙工具客户端下载',
    description: '常用客户端集中下载。',
    platforms: ['Android', 'macOS', 'Windows', 'Linux'],
    items: [],
  },
  airport: {
    id: 7,
    slug: 'nebula',
    name: '星云机场',
    website: 'https://nebula.example.com',
    status: 'normal',
    tags: ['稳定', '高速'],
  },
  summary_card: {
    type: 'stable',
    name: '星云机场',
    tags: ['稳定', '高速'],
    score: 98.6,
    stability_tier: 'stable',
    details: [
      { label: '30 天可用率', value: '99.90%' },
      { label: '中位延迟', value: '88 ms' },
    ],
    conclusion: '适合作为今日推荐参考。',
  },
  ranking: {
    today_pick_rank: 1,
    most_stable_rank: 2,
    best_value_rank: null,
    new_entries_rank: null,
    risk_alerts_rank: null,
  },
  score_breakdown: {
    s: 99,
    p: 98,
    c: 90,
    r: 95,
    final_score: 98.6,
    risk_penalty: 0,
    domain_penalty: 0,
    ssl_penalty: 0,
    complaint_penalty: 0,
    history_penalty: 0,
  },
  metrics: {
    uptime_percent_30d: 99.9,
    median_latency_ms: 88,
    median_download_mbps: 320,
    packet_loss_percent: 0.1,
    stable_days_streak: 20,
    healthy_days_streak: 20,
    stability_tier: 'stable',
    recent_complaints_count: 0,
    history_incidents: 0,
  },
  trends: {
    score_30d: [
      { date: '2026-03-22', value: 97.4 },
      { date: '2026-03-23', value: 98.6 },
    ],
    uptime_30d: [],
    latency_30d: [],
    download_30d: [],
    packet_loss_30d: [],
  },
  capabilities: {
    plan: {
      supports_monthly: true,
      supports_quarterly: true,
      supports_half_yearly: false,
      supports_annual: true,
      lowest_monthly_price: 18,
      lowest_annual_monthly_price: 15,
      has_trial_plan: true,
      has_lifetime_plan: false,
    },
    streaming: [{ key: 'netflix', label: 'Netflix' }],
    payment_methods: [
      { key: 'alipay', label: '支付宝' },
      { key: 'usdt_trc20', label: 'USDT-TRC20' },
    ],
    telegram: {
      items: [{ key: 'group', label: 'Telegram 群组' }],
      has_group: true,
      group_url: 'https://t.me/nebula_group',
      has_channel: true,
      channel_url: 'https://t.me/nebula_channel',
      group_allows_speaking: false,
      group_member_count: 1200,
      recent_active_at: '2026-03-23',
      has_customer_service_bot: true,
      has_ticket_system: false,
    },
    clients: [
      { key: 'clash', label: 'Clash' },
      { key: 'shadowrocket', label: 'Shadowrocket' },
    ],
    import_methods: [{ key: 'one_click_import', label: '一键导入' }],
    regions: [
      {
        key: 'hong_kong',
        label: '香港',
        node_count: 6,
        line_types: ['IEPL'],
        has_residential: false,
        has_native_ip: true,
      },
    ],
  },
};
