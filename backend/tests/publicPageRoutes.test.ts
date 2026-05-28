import test from 'node:test';
import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import express from 'express';
import { createPublicPageRoutes } from '../src/routes/publicPageRoutes';
import type { FullRankingView, HomePageView, ReportView, RiskMonitorView } from '../src/types/domain';
import type { AirportDealView } from '../../shared/airportAds';
import { getDateInTimezone } from '../src/utils/time';

const TEST_FRONTEND_ASSETS = {
  script: '/assets/index-CkG9aP2q.js',
  stylesheet: '/assets/index-BzS9fL3m.css',
};

test('public SEO routes return crawlable HTML with unique head and H1 content', async () => {
  const app = express();
  app.use(createPublicPageRoutes({
    publicViewService: createPublicViewServiceStub(),
    frontendAssets: TEST_FRONTEND_ASSETS,
  }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const checks = [
      ['/', /<h1>机场榜：机场 VPN 推荐与可靠性榜单<\/h1>/, /机场 VPN 推荐、科学上网机场测评与可靠性榜单/],
      ['/rankings/all', /<h1>机场排行榜：全量机场 VPN 评分排名<\/h1>/, /全量机场榜单 \| 全部已上线机场评分排名/],
      ['/methodology', /<h1>机场测评方法：评分规则、测速标准、风险扣分与推荐依据<\/h1>/, /机场测评方法/],
      ['/apply', /<h1>申请入驻 GateRank 机场测试<\/h1>/, /申请入驻测试/],
      ['/risk-monitor', /<h1>跑路机场监测：高风险机场名单与机场跑路预警<\/h1>/, /跑路监测 \| 已跑路与风险观察机场列表/],
    ] as const;

    for (const [path, h1Pattern, titlePattern] of checks) {
      const response = await fetch(`${baseUrl}${path}`, { headers: { host: `127.0.0.1:${port}` } });
      assert.equal(response.status, 200, path);
      assert.match(response.headers.get('content-type') || '', /text\/html/);
      assert.equal(
        response.headers.get('cache-control'),
        'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
      );
      const html = await response.text();
      assert.match(html, titlePattern);
      assert.ok(extractMetaDescription(html));
      assert.match(html, /<link rel="canonical" href="http:\/\/127\.0\.0\.1:\d+\//);
      assert.match(html, h1Pattern);
      assert.match(html, /<script type="application\/ld\+json">/);
      assert.match(html, /<link rel="stylesheet" href="\/assets\/index-BzS9fL3m\.css" \/>/);
      assert.match(html, /<script type="module" src="\/assets\/index-CkG9aP2q\.js"><\/script>/);
      assert.match(html, /\.topbar nav a\.active \{ background: #fff1f2; color: #e11d48;/);
      assert.match(html, /\.topbar nav a\.apply-link \{ background: #111111; color: #fff;/);
      assert.match(html, /\.topbar nav a\.apply-link\.active \{ background: #111111; color: #fff;/);
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('core SEO descriptions include expanded search context', async () => {
  const app = express();
  app.use(createPublicPageRoutes({ publicViewService: createPublicViewServiceStub() }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const checks = [
      ['/methodology', /机场评分规则/, /每日重算/],
      ['/apply', /官网地址/, /自动测速接入/],
      ['/risk-monitor', /跑路机场监测页/, /高风险机场 VPN 服务/],
    ] as const;

    for (const [path, firstPattern, secondPattern] of checks) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`);
      assert.equal(response.status, 200);
      const description = extractMetaDescription(await response.text());
      assert.ok(description.length >= 80, `${path} description too short: ${description.length}`);
      assert.ok(description.length <= 150, `${path} description too long: ${description.length}`);
      assert.match(description, firstPattern);
      assert.match(description, secondPattern);
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /deals returns crawlable advertising deal HTML', async () => {
  const app = express();
  app.use(createPublicPageRoutes({
    publicViewService: createPublicViewServiceStub(),
    airportAdCampaignRepository: {
      listActiveDeals: async () => [createDealView(1), createDealView(2)],
    },
    frontendAssets: TEST_FRONTEND_ASSETS,
  }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/deals`, { headers: { host: `127.0.0.1:${port}` } });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /text\/html/);
    const html = await response.text();
    assert.match(html, /<h1>机场优惠码大全：活动折扣、免费试用与 USDT 支付优惠<\/h1>/);
    assert.match(html, /机场优惠码大全 \| 机场折扣、活动优惠、免费试用与 USDT 支付/);
    assert.match(html, /<link rel="canonical" href="http:\/\/127\.0\.0\.1:\d+\/deals"/);
    assert.match(html, /什么是机场优惠码/);
    assert.match(html, /机场优惠码和机场推荐有什么区别/);
    assert.match(html, /如何判断机场折扣是否值得买/);
    assert.match(html, /新用户优惠、续费优惠、免费试用有什么区别/);
    assert.match(html, /USDT 支付优惠需要注意什么/);
    assert.match(html, /机场优惠码常见问题/);
    assert.match(html, /星云机场/);
    assert.match(html, /优惠码/);
    assert.match(html, /NEW220/);
    assert.match(html, /href="https:\/\/www\.nebula\.example\.com" target="_blank" rel="nofollow noreferrer noopener">访问官网/);
    assert.doesNotMatch(html, /href="www\.nebula\.example\.com"/);
    assert.match(html, /"@type":"CollectionPage"/);
    assert.match(html, /"@type":"BreadcrumbList"/);
    assert.match(html, /"@type":"ItemList"/);
    assert.match(html, /"@type":"Offer"/);
    assert.match(html, /"@type":"Service"/);
    assert.match(html, /"@type":"FAQPage"/);
    assert.match(html, /"validFrom":"2026-05-24T10:00:00\+08:00"/);
    assert.match(html, /"validThrough":"2026-06-24T10:00:00\+08:00"/);
    assert.match(html, /"availability":"https:\/\/schema\.org\/InStock"/);
    assert.match(html, /"seller":\{"@type":"Organization","name":"星云机场","url":"https:\/\/www\.nebula\.example\.com"\}/);
    assert.match(html, /"category":"机场优惠码"/);
    assert.match(html, /"itemOffered":\{"@type":"Service","name":"星云机场","url":"http:\/\/127\.0\.0\.1:\d+\/airports\/nebula"/);
    assert.doesNotMatch(html, /最佳|官方推荐|最强|永久稳定/);
    assert.match(html, /"kind":"deals"/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /methodology includes expanded methodology SEO body and FAQ structured data', async () => {
  const app = express();
  app.use(createPublicPageRoutes({ publicViewService: createPublicViewServiceStub() }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/methodology`);
    assert.equal(response.status, 200);
    const html = await response.text();

    assert.match(html, /总公式与评分目标/);
    assert.match(html, /0\.4 × 稳定性 S \+ 0\.3 × 性能 P \+ 0\.2 × 价格 C \+ 0\.1 × 风险 R/);
    assert.match(html, /四个维度的子项公式/);
    assert.match(html, /S = 0\.5 × UptimeScore \+ 0\.3 × StabilityScore \+ 0\.2 × StreakScore/);
    assert.match(html, /风险扣分如何进入排名/);
    assert.match(html, /recent_complaints_count × 3/);
    assert.match(html, /时间衰减与每日重算/);
    assert.match(html, /w = exp\(-0\.1 × days_diff\)/);
    assert.match(html, /低价机场一定高分吗？/);
    assert.match(html, /"@type":"FAQPage"/);
    assert.match(html, /机场推荐依据/);
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

test('GET /rankings/all requests the full public page size and exposes more than 20 report links', async () => {
  const calls: Array<{ page: number; pageSize: number }> = [];
  const app = express();
  app.use(createPublicPageRoutes({
    publicViewService: {
      ...createPublicViewServiceStub(),
      getFullRankingView: async (_date: string, page: number, pageSize: number, filters): Promise<FullRankingView> => {
        calls.push({ page, pageSize });
        return {
          ...buildFullRankingViewWithAirportCount(25),
          page,
          page_size: pageSize,
          filters,
        };
      },
    },
  }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/rankings/all?date=2026-03-23&page=1`);
    assert.equal(response.status, 200);
    assert.deepEqual(calls, [{ page: 1, pageSize: 100 }]);

    const html = await response.text();
    const reportLinks = new Set(
      Array.from(html.matchAll(/href="(\/airports\/airport-\d+)">测评报告/g), (match) => match[1]),
    );
    assert.equal(reportLinks.size, 25);
    assert.ok(reportLinks.size > 20);
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
      params: { date: string | null; page: number; filters: { q: string; payment: string[] } };
      payload: { items: Array<{ name: string }> };
    };
    assert.equal(initialData.kind, 'full_ranking');
    assert.equal(initialData.params.date, '2026-03-23');
    assert.equal(initialData.params.page, 1);
    assert.equal(initialData.params.filters.q, '');
    assert.deepEqual(initialData.params.filters.payment, []);
    assert.equal(initialData.payload.items[0].name, '星云机场');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /rankings/all renders indexable single-filter SEO page', async () => {
  const app = express();
  app.use(createPublicPageRoutes({
    publicViewService: {
      ...createPublicViewServiceStub(),
      getFullRankingView: async (_date: string, _page: number, _pageSize: number, filters): Promise<FullRankingView> => ({
        ...fullRankingView,
        filters,
      }),
    },
  }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/rankings/all?payment=alipay`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<h1>支持支付宝的机场 VPN 排名<\/h1>/);
    assert.match(html, /<meta name="robots" content="index,follow,max-image-preview:large"/);
    assert.match(html, /<link rel="canonical" href="http:\/\/127\.0\.0\.1:\d+\/rankings\/all\?payment=alipay"/);
    assert.match(html, /搜索与分类筛选/);
    assert.match(html, /class="filter-chip active" href="\/rankings\/all">支付宝<\/a>/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /rankings/all noindexes search and combination filters', async () => {
  const app = express();
  app.use(createPublicPageRoutes({
    publicViewService: {
      ...createPublicViewServiceStub(),
      getFullRankingView: async (_date: string, _page: number, _pageSize: number, filters): Promise<FullRankingView> => ({
        ...fullRankingView,
        filters,
      }),
    },
  }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/rankings/all?q=clash&client=clash&region=hong_kong`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<h1>机场搜索与筛选结果<\/h1>/);
    assert.match(html, /<meta name="robots" content="noindex,follow"/);
    assert.match(html, /<link rel="canonical" href="http:\/\/127\.0\.0\.1:\d+\/rankings\/all"/);
    assert.match(html, /搜索：clash/);
    assert.match(html, /香港/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /rankings/all removes unsupported filter values from URL', async () => {
  const app = express();
  app.use(createPublicPageRoutes({ publicViewService: createPublicViewServiceStub() }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/rankings/all?payment=alipay&payment=unknown`, {
      redirect: 'manual',
    });
    assert.equal(response.status, 301);
    assert.equal(response.headers.get('location'), '/rankings/all?payment=alipay');
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
    assert.match(okResponse.headers.get('content-type') || '', /text\/html; charset=utf-8/);
    assert.equal(
      okResponse.headers.get('cache-control'),
      'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
    );
    const okHtml = await okResponse.text();
    assert.match(okHtml, /<h1>星云机场 测评报告<\/h1>/);
    assert.match(okHtml, /id="report-top"/);
    assert.match(okHtml, /报告日期：2026-03-23/);
    assert.match(okHtml, /<div class="breadcrumb"><a href="\/">首页<\/a><span>\/<\/span>星云机场<\/div>/);
    assert.doesNotMatch(okHtml, /机场专题/);
    assert.match(okHtml, /aria-label="报告页面导航"/);
    assert.match(okHtml, /href="#report-overview"/);
    assert.match(okHtml, /href="#report-content"/);
    assert.match(okHtml, />测评摘要<\/a>/);
    assert.match(okHtml, /href="#report-snapshot"/);
    assert.match(okHtml, /href="#report-capabilities"/);
    assert.match(okHtml, /href="#report-score"/);
    assert.match(okHtml, /href="#report-metrics"/);
    assert.match(okHtml, /href="#report-trends"/);
    assert.match(okHtml, /href="#report-plan-telegram"/);
    assert.match(okHtml, /href="#report-conclusion"/);
    assert.doesNotMatch(okHtml, /回到顶部/);
    assert.match(okHtml, /今日推荐/);
    assert.match(okHtml, /全量榜单/);
    assert.match(okHtml, /申请入驻/);
    assert.match(okHtml, /GateRank Score/);
    assert.match(okHtml, /星云机场 测评摘要/);
    assert.doesNotMatch(okHtml, /星云机场 实际内容与 SEO 摘要/);
    assert.doesNotMatch(okHtml, /report-content-grid/);
    assert.match(okHtml, /report-content-summary/);
    assert.match(okHtml, /星云机场 当前公开总分98\.60\/100，状态为正常。本页汇总风险/);
    assert.doesNotMatch(okHtml, /星云机场 当前公开分数 98\.60\/100，状态为正常，官网为/);
    assert.match(okHtml, /<span>总分 98\.60\/100<\/span>/);
    assert.match(okHtml, /<span>状态 正常<\/span>/);
    assert.match(okHtml, /<span>风险惩罚 0<\/span>/);
    assert.doesNotMatch(okHtml, /<article class="snapshot-card">\s*<div>风险惩罚<\/div>\s*<strong>0<\/strong>\s*<\/article>/);
    assert.match(okHtml, /<span>官网扣分 0<\/span>/);
    assert.match(okHtml, /<span>SSL 扣分 0<\/span>/);
    assert.match(okHtml, /<span>30 天可用率 99\.90%<\/span>/);
    assert.match(okHtml, /<span>中位延迟 88 ms<\/span>/);
    assert.match(okHtml, /<span>试用 支持<\/span>/);
    assert.match(okHtml, /<details class="report-content-detail">/);
    assert.doesNotMatch(okHtml, /<details class="report-content-detail" open>/);
    assert.match(okHtml, /<summary>综合结论<\/summary>/);
    assert.match(okHtml, /<summary>风险解读<\/summary>/);
    assert.match(okHtml, /<summary>稳定性与性能<\/summary>/);
    assert.match(okHtml, /<summary>套餐与试用<\/summary>/);
    assert.match(okHtml, /<summary>节点、客户端与解锁<\/summary>/);
    assert.match(okHtml, /<summary>Telegram 与售后<\/summary>/);
    assert.match(okHtml, /综合结论/);
    assert.match(okHtml, /星云机场 当前 GateRank 公开总分98\.60\/100，状态为正常。本页把 星云机场 机场测评拆成评分/);
    assert.doesNotMatch(okHtml, /星云机场 当前 GateRank 公开分数为 98\.60\/100，状态为正常，官网为/);
    assert.match(okHtml, /风险解读/);
    assert.match(okHtml, /稳定性与性能/);
    assert.match(okHtml, /套餐与试用/);
    assert.match(okHtml, /节点、客户端与解锁/);
    assert.match(okHtml, /Telegram 与售后/);
    assert.match(okHtml, /官网探测扣分 0/);
    assert.match(okHtml, /SSL 扣分 0/);
    assert.match(okHtml, /30 天可用率为 99\.90%/);
    assert.match(okHtml, /中位延迟为 88 ms/);
    assert.match(okHtml, /下载速率为 320 Mbps/);
    assert.match(okHtml, /月付支持/);
    assert.match(okHtml, /年付支持/);
    assert.match(okHtml, /香港 6节点 IEPL 原生IP/);
    assert.match(okHtml, /Clash、Shadowrocket/);
    assert.match(okHtml, /Telegram 群支持/);
    assert.match(okHtml, /群人数 1,200 人/);
    assert.match(okHtml, /服务能力详情/);
    assert.match(okHtml, /Netflix/);
    assert.match(okHtml, /<svg viewBox="0 0 24 24" fill="currentColor"/);
    assert.match(okHtml, /支付宝/);
    assert.match(okHtml, /#1677FF/);
    assert.match(okHtml, /Telegram 群组/);
    assert.match(okHtml, /#26A5E4/);
    assert.match(okHtml, /香港 · 6 节点 · IEPL/);
    assert.match(okHtml, /🇭🇰/);
    assert.match(okHtml, /评分拆解/);
    assert.match(okHtml, /核心监测指标/);
    assert.match(okHtml, /30 天可用率/);
    assert.match(okHtml, /30 天趋势/);
    assert.match(okHtml, /套餐信息/);
    assert.match(okHtml, /电报信息/);
    assert.match(okHtml, /最低年付折算月价/);
    assert.match(okHtml, /https:\/\/t\.me\/nebula_group/);
    assert.doesNotMatch(okHtml, /导入与配置/);
    assert.match(okHtml, /结论与建议/);
    assert.doesNotMatch(okHtml, /GateRank Pro 数据看板/);
    assert.match(okHtml, /常见问题/);
    assert.match(okHtml, /星云机场怎么样/);
    assert.match(okHtml, /星云机场测评怎么看/);
    assert.match(okHtml, /星云机场官网是什么/);
    assert.match(okHtml, /星云机场跑路风险高吗/);
    assert.match(okHtml, /星云机场适合长期使用吗/);
    assert.match(okHtml, /星云机场风险主要来自哪里/);
    assert.match(okHtml, /星云机场支持哪些套餐、客户端和地区/);
    assert.match(okHtml, /<script type="application\/ld\+json">/);
    assert.match(okHtml, /"@type":"FAQPage"/);
    assert.match(okHtml, /"@type":"ItemList"/);
    assert.match(okHtml, /"name":"官网探测扣分","value":"0"/);
    assert.match(okHtml, /"name":"SSL扣分","value":"0"/);
    assert.match(okHtml, /"name":"套餐信息","value":"月付支持/);
    assert.match(okHtml, /"name":"节点地区","value":"香港 6节点 IEPL 原生IP"/);
    assert.match(okHtml, /"name":"客户端支持","value":"Clash、Shadowrocket"/);
    assert.match(okHtml, /"name":"售后支持","value":"Telegram 群支持/);
    assert.match(okHtml, /<link rel="canonical" href="http:\/\/127\.0\.0\.1:\d+\/airports\/nebula"/);
    const description = extractMetaDescription(okHtml);
    assert.ok(description.length >= 80, `report description too short: ${description.length}`);
    assert.ok(description.length <= 180, `report description too long: ${description.length}`);
    assert.match(description, /星云机场/);
    assert.match(description, /机场测评/);
    assert.match(description, /总分/);
    assert.match(description, /状态/);
    assert.match(description, /风险/);
    assert.match(description, /官网/);
    assert.match(description, /30 天趋势/);
    assert.match(description, /机场 VPN 选择/);

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

function extractMetaDescription(html: string): string {
  const matched = html.match(/<meta name="description" content="([^"]+)"/);
  assert.ok(matched, 'meta description missing');
  return matched[1];
}

function createDealView(id: number): AirportDealView {
  return {
    campaign_id: id,
    airport_id: id,
    airport_name: id === 1 ? '星云机场' : '极光机场',
    airport_slug: id === 1 ? 'nebula' : 'aurora',
    website: id === 1 ? 'www.nebula.example.com' : `https://airport-${id}.example.com`,
    report_url: id === 1 ? '/airports/nebula' : '/airports/aurora',
    coupon_code: id === 1 ? 'NEW220' : 'FLASH30',
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
}

function buildFullRankingViewWithAirportCount(count: number): FullRankingView {
  return {
    ...fullRankingView,
    total: count,
    total_pages: 1,
    items: Array.from({ length: count }, (_, index) => ({
      ...fullRankingView.items[0],
      airport_id: index + 1,
      rank: index + 1,
      name: `测试机场 ${index + 1}`,
      website: `https://airport-${index + 1}.example.com`,
      report_url: `/airports/airport-${index + 1}`,
    })),
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
    score_30d: [
      { date: '2026-03-22', value: 97.4 },
      { date: '2026-03-23', value: 98.6 },
    ],
    uptime_30d: [
      { date: '2026-03-22', value: 99.8 },
      { date: '2026-03-23', value: 99.9 },
    ],
    latency_30d: [
      { date: '2026-03-22', value: 92 },
      { date: '2026-03-23', value: 88 },
    ],
    download_30d: [
      { date: '2026-03-22', value: 300 },
      { date: '2026-03-23', value: 320 },
    ],
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
    streaming: [
      { key: 'netflix', label: 'Netflix' },
      { key: 'chatgpt', label: 'ChatGPT' },
    ],
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
