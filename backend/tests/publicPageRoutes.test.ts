import test from 'node:test';
import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import express from 'express';
import { createPublicPageRoutes } from '../src/routes/publicPageRoutes';
import type { FullRankingView, HomePageView, ReportView, RiskMonitorView } from '../src/types/domain';
import { getDateInTimezone } from '../src/utils/time';

test('public SEO routes return crawlable HTML with unique head and H1 content', async () => {
  const app = express();
  app.use(createPublicPageRoutes({ publicViewService: createPublicViewServiceStub() }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const checks = [
      ['/', /<h1>机场榜：机场 VPN 推荐与可靠性榜单<\/h1>/, /机场 VPN 推荐、科学上网机场测评与可靠性榜单/],
      ['/rankings/all', /<h1>全量机场榜单<\/h1>/, /全量机场榜单 \| 全部已上线机场评分排名/],
      ['/methodology', /<h1>机场测评方法：评分规则、测速标准与风险扣分<\/h1>/, /机场测评方法/],
      ['/apply', /<h1>申请入驻 GateRank 机场测试<\/h1>/, /申请入驻测试/],
      ['/risk-monitor', /<h1>高风险机场监测列表<\/h1>/, /跑路监测 \| 已跑路与风险观察机场列表/],
    ] as const;

    for (const [path, h1Pattern, titlePattern] of checks) {
      const response = await fetch(`${baseUrl}${path}`, { headers: { host: `127.0.0.1:${port}` } });
      assert.equal(response.status, 200, path);
      assert.match(response.headers.get('content-type') || '', /text\/html/);
      const html = await response.text();
      assert.match(html, titlePattern);
      assert.match(html, /<meta name="description" content="[^"]+"/);
      assert.match(html, /<link rel="canonical" href="http:\/\/127\.0\.0\.1:\d+\//);
      assert.match(html, h1Pattern);
      assert.match(html, /<script type="application\/ld\+json">/);
      assert.match(html, /<script type="module" src="\/assets\/index\.js\?v=20260515-ranking-url-clean"><\/script>/);
      assert.match(html, /\.topbar nav a\.active \{ background: #fff1f2; color: #e11d48;/);
      assert.match(html, /\.topbar nav a\.apply-link \{ background: #111111; color: #fff;/);
      assert.match(html, /\.topbar nav a\.apply-link\.active \{ background: #111111; color: #fff;/);
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /rankings/all includes ranking items and report links in raw HTML', async () => {
  const app = express();
  app.use(createPublicPageRoutes({ publicViewService: createPublicViewServiceStub() }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/rankings/all?date=2026-03-23&page=1`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /星云机场/);
    assert.match(html, /#1/);
    assert.match(html, /98\.6/);
    assert.match(html, /href="\/airports\/nebula">测评报告<\/a>/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('public data routes embed initial payload for React takeover', async () => {
  const app = express();
  app.use(createPublicPageRoutes({ publicViewService: createPublicViewServiceStub() }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/rankings/all?date=2026-03-23&page=1`);
    assert.equal(response.status, 200);
    const html = await response.text();
    const matched = html.match(/<script id="__GATERANK_INITIAL_DATA__" type="application\/json">([^<]+)<\/script>/);
    assert.ok(matched);

    const initialData = JSON.parse(matched[1]) as {
      kind: string;
      params: { date: string | null; page: number };
      payload: { items: Array<{ name: string }> };
    };
    assert.equal(initialData.kind, 'full_ranking');
    assert.deepEqual(initialData.params, { date: '2026-03-23', page: 1 });
    assert.equal(initialData.payload.items[0].name, '星云机场');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('public data routes reuse prerender view within ttl', async () => {
  let fullRankingCalls = 0;
  const app = express();
  app.use(createPublicPageRoutes({
    publicViewService: {
      ...createPublicViewServiceStub(),
      getFullRankingView: async (): Promise<FullRankingView> => {
        fullRankingCalls += 1;
        return fullRankingView;
      },
    },
  }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const [first, second] = await Promise.all([
      fetch(`http://127.0.0.1:${port}/rankings/all?date=2026-03-23&page=1`),
      fetch(`http://127.0.0.1:${port}/rankings/all?date=2026-03-23&page=1`),
    ]);

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(fullRankingCalls, 1);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /rankings/all redirects default date query to clean paginated URL', async () => {
  const app = express();
  app.use(createPublicPageRoutes({ publicViewService: createPublicViewServiceStub() }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const today = getDateInTimezone();
    const response = await fetch(`http://127.0.0.1:${port}/rankings/all?date=${today}&page=2`, {
      redirect: 'manual',
    });
    assert.equal(response.status, 301);
    assert.equal(response.headers.get('location'), '/rankings/all?page=2');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /airports/:slug renders report HTML and legacy reports redirect to stable URL', async () => {
  const app = express();
  app.use(createPublicPageRoutes({ publicViewService: createPublicViewServiceStub() }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const okResponse = await fetch(`http://127.0.0.1:${port}/airports/nebula`);
    assert.equal(okResponse.status, 200);
    const okHtml = await okResponse.text();
    assert.match(okHtml, /<h1>星云机场 测评报告<\/h1>/);
    assert.match(okHtml, /评分拆解/);
    assert.match(okHtml, /30 天可用率/);
    assert.match(okHtml, /<link rel="canonical" href="http:\/\/127\.0\.0\.1:\d+\/airports\/nebula"/);

    const legacyResponse = await fetch(`http://127.0.0.1:${port}/reports/7?date=2026-03-23`, {
      redirect: 'manual',
    });
    assert.equal(legacyResponse.status, 301);
    assert.equal(legacyResponse.headers.get('location'), '/airports/nebula');

    const missingResponse = await fetch(`http://127.0.0.1:${port}/reports/404`);
    assert.equal(missingResponse.status, 404);
    const missingHtml = await missingResponse.text();
    assert.match(missingHtml, /<h1>报告不存在<\/h1>/);
    assert.match(missingHtml, /<meta name="robots" content="index,follow,max-image-preview:large"/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /risk-watch redirects permanently to /risk-monitor', async () => {
  const app = express();
  app.use(createPublicPageRoutes({ publicViewService: createPublicViewServiceStub() }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/risk-watch?date=2026-03-23`, {
      redirect: 'manual',
    });
    assert.equal(response.status, 301);
    assert.equal(response.headers.get('location'), '/risk-monitor?date=2026-03-23');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

function createPublicViewServiceStub() {
  return {
    getHomePageView: async (): Promise<HomePageView> => homeView,
    getFullRankingView: async (): Promise<FullRankingView> => fullRankingView,
    getRiskMonitorView: async (): Promise<RiskMonitorView> => riskMonitorView,
    getReportView: async (airportId: number): Promise<ReportView | null> => (airportId === 7 ? reportView : null),
    getReportViewBySlug: async (slug: string): Promise<ReportView | null> => (slug === 'nebula' ? reportView : null),
  };
}

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
  sections: {
    today_pick: {
      title: '今日推荐机场',
      subtitle: "Today's Top Pick",
      items: [
        {
          type: 'stable',
          airport_id: 7,
          name: '星云机场',
          website: 'https://nebula.example.com',
          tags: ['稳定', '高速'],
          score: 98.6,
          score_delta_vs_yesterday: { label: '对比昨天', value: 1.2 },
          stability_tier: 'stable',
          details: [
            { label: '30 天可用率', value: '99.90%' },
            { label: '中位延迟', value: '88 ms' },
          ],
          conclusion: '适合作为今日推荐参考。',
          report_url: '/airports/nebula',
        },
      ],
    },
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
  page_size: 20,
  total: 1,
  total_pages: 1,
  items: [
    {
      airport_id: 7,
      rank: 1,
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
    },
  ],
};

const riskMonitorView: RiskMonitorView = {
  ...fullRankingView,
  total: 1,
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
    score_30d: [],
    uptime_30d: [],
    latency_30d: [],
    download_30d: [],
  },
};
