import test from 'node:test';
import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import express from 'express';
import { createPublicPageRoutes } from '../src/routes/publicPageRoutes';
import { createPublicRoutes } from '../src/routes/publicRoutes';
import type { FullRankingView, HomePageView, ReportView, RiskMonitorView } from '../src/types/domain';
import { createTimedPromiseCache } from '../src/utils/publicCache';
import type { AirportDealView } from '../../shared/airportAds';
import { getDateInTimezone } from '../src/utils/time';
import { DEFAULT_TOOLS_DOWNLOAD_PAGE_CONFIG } from '../../shared/toolDownloads';

const TEST_FRONTEND_ASSETS = {
  script: '/assets/index-CkG9aP2q.js',
  stylesheet: '/assets/index-BzS9fL3m.css',
};

function extractBalancedCssBlock(css: string, openingPattern: RegExp, requiredSelector: string): string {
  const flags = openingPattern.flags.includes('g') ? openingPattern.flags : `${openingPattern.flags}g`;
  const matcher = new RegExp(openingPattern.source, flags);
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(css)) !== null) {
    const openingBraceIndex = css.indexOf('{', match.index + match[0].length);
    if (openingBraceIndex === -1) continue;

    let depth = 1;
    for (let index = openingBraceIndex + 1; index < css.length; index += 1) {
      if (css[index] === '{') depth += 1;
      if (css[index] === '}') depth -= 1;
      if (depth === 0) {
        const block = css.slice(openingBraceIndex + 1, index);
        if (block.includes(requiredSelector)) return block;
        break;
      }
    }
  }
  throw new Error(`CSS block not found for ${requiredSelector}: ${openingPattern}`);
}

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
      ['/', /<h1>机场榜：机场 VPN 推荐与<span>可靠性榜单<\/span><\/h1>/, /机场 VPN 推荐、科学上网机场测评与可靠性榜单/],
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
      assert.match(html, /@layer base\s*\{\s*a\s*\{\s*color:\s*inherit;\s*\}\s*\}/);
      assert.doesNotMatch(html, /(?:<style>|\})\s*a\s*\{\s*color:\s*inherit;\s*\}/);
      assert.match(html, /<script type="module" src="\/assets\/index-CkG9aP2q\.js"><\/script>/);
      assert.match(html, /data-public-top-nav="true"/);
      assert.match(html, /\.public-top-nav-inner\s*\{[^}]*height:\s*64px;/);
      assert.match(html, /\.footer\s*\{[^}]*linear-gradient\(to right,rgba\(0,0,0,\.03\) 1px,transparent 1px\)[^}]*background-size:\s*30px 30px,30px 30px,24px 24px;/);
      assert.match(html, /<span class="public-top-nav-brand-title">机场榜GateRank<\/span>/);
      assert.doesNotMatch(html, /<header class="topbar">/);
      if (path === '/') {
        assert.match(html, /<div class="home-v3-pill">行业首创，每日更新<\/div>/);
        assert.match(html, /\.home-v3-hero h1\s*\{[^}]*font-size:\s*clamp\(20px,\s*2\.4vw,\s*30px\)/);
        assert.match(html, /@media \(min-width:\s*640px\)\s*\{\s*\.home-v3-hero h1\s*\{\s*white-space:\s*nowrap;/);
        assert.match(html, /\.page-main h1\s*\{[^}]*font-size:\s*clamp\(36px,\s*7vw,\s*64px\)/);
        assert.doesNotMatch(html, /(?:^|\})\s*h1\s*\{[^}]*font-size:\s*clamp\(36px,\s*7vw,\s*64px\)/);
        assert.match(html, /\.home-v3-table-wrap td\s*\{[^}]*vertical-align:\s*middle;/);
        assert.match(html, /#gaterank-ranking-section td\.align-middle\s*\{[^}]*vertical-align:\s*middle;/);
        assert.doesNotMatch(html, /aria-label="查看(?:长期稳定|性价比榜|新入榜|风险预警)"/);
        assert.match(html, /基于公开监测数据，结合今日推荐、长期稳定、性价比、新入榜与风险预警五类榜单/);
        assert.match(html, /<h2 id="home-v3-sponsored-title">商业合作专区<\/h2>/);
        assert.doesNotMatch(html, /<h2 id="home-v3-sponsored-title">今日赞助推荐<\/h2>/);
        assert.match(html, /星云优惠机场/);
        const homepageDealCards = Array.from(html.matchAll(/<article class="home-v3-deal(?: home-v3-empty)?"/g));
        assert.equal(homepageDealCards.length, 5, 'homepage SSR renders five commercial deal slots');
        assert.match(html, /首页 5 号广告位招募中/);
        const sponsoredDealHtml = html.match(/<article class="home-v3-deal"[\s\S]*?<\/article>/)?.[0] || '';
        assert.match(sponsoredDealHtml, /<p>新客八折<\/p>/);
        assert.doesNotMatch(sponsoredDealHtml, /月付套餐限时优惠。/);
        assert.doesNotMatch(sponsoredDealHtml, /<b>广告<\/b>/);
        assert.doesNotMatch(sponsoredDealHtml, /公开分/);
        assert.doesNotMatch(sponsoredDealHtml, /91\.2/);
        assert.match(sponsoredDealHtml, /<small>180 天观察<\/small>/);
        assert.match(sponsoredDealHtml, /<code>优惠码 GATE20<\/code>/);
        assert.match(sponsoredDealHtml, /<div class="home-v3-tags"><span>IEPL<\/span><span>新客优惠<\/span><\/div>/);
        assert.match(sponsoredDealHtml, /<small>月付起<\/small><strong>¥12<\/strong>/);
        const dealActionsHtml = sponsoredDealHtml.match(/<div class="home-v3-deal-actions">[\s\S]*?<\/div>/)?.[0] || '';
        assert.match(dealActionsHtml, /href="\/airports\/nebula-deal">查看测评报告<\/a>[\s\S]*href="https:\/\/deal\.example\.com" target="_blank" rel="nofollow sponsored noopener noreferrer" aria-label="访问 星云优惠机场 官网">官网 <span aria-hidden="true">↗<\/span><\/a>/);
        assert.match(html, /\.home-v3-deal-grid\s*\{[^}]*grid-template-columns:\s*repeat\(5,minmax\(0,1fr\)\);[^}]*gap:\s*12px;/);
        const max900Css = extractBalancedCssBlock(html, /@media \(max-width:\s*900px\)\s*/, '.home-v3-deal-grid');
        const max600Css = extractBalancedCssBlock(html, /@media \(max-width:\s*600px\)\s*/, '.home-v3-deal-grid');
        assert.match(max900Css, /\.home-v3-deal-grid\s*\{\s*grid-template-columns:\s*1fr 1fr;\s*\}/);
        assert.match(max600Css, /\.home-v3-deal-grid,\s*\.home-v3-summary-grid[^}]*grid-template-columns:\s*1fr;/);
        assert.match(html, /\.home-v3-deal\s*\{[^}]*min-height:\s*264px;[^}]*padding:\s*14px;/);
        assert.match(html, /\.home-v3-deal-actions\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*1fr;[^}]*gap:\s*7px;[^}]*margin-top:\s*10px;/);
        assert.match(html, /\.home-v3-deal-actions a\s*\{[^}]*width:\s*100%;[^}]*justify-content:\s*center;[^}]*border:\s*1px solid #e5e5e5;/);
        assert.match(html, /\.home-v3-deal-report\s*\{[^}]*border-color:\s*#171717 !important;[^}]*background:\s*#171717;[^}]*color:\s*#fff;/);
        assert.match(html, /\.home-v3-deal-website\s*\{[^}]*background:\s*#fafafa;[^}]*color:\s*#404040;/);
        assert.doesNotMatch(html, /\.home-v3-deal-bottom > a\s*\{/);
        assert.match(html, /\.home-v3-summary-grid li strong\s*\{[^}]*color:\s*#404040;[^}]*font-family:\s*ui-monospace,[^}]*text-align:\s*right;/);
        assert.doesNotMatch(html, /\.home-v3-summary-grid li strong\s*\{[^}]*\b(?:background|border|mask|content):/);
        const riskSummaryHtml = html.match(/<article>\s*<div class="home-v3-summary-title"><h3>风险预警<\/h3><\/div>[\s\S]*?<\/article>/)?.[0] || '';
        assert.match(riskSummaryHtml, /<li><span>01<\/span><a href="\/airports\/risk-alert">风险观察机场<\/a><strong class="home-v3-risk-status">风险<\/strong><\/li>/);
        assert.doesNotMatch(riskSummaryHtml, /(?:67\.40|no-score-badge|no-ad-badge|amber|★|☆)/);
        assert.match(html, /\.home-v3-summary-grid li strong\.home-v3-risk-status\s*\{[^}]*color:\s*#e11d48;[^}]*text-align:\s*right;/);
        assert.doesNotMatch(html, /\.home-v3-summary-grid li strong\.home-v3-risk-status\s*\{[^}]*\b(?:background|border|mask|content):/);
        assert.doesNotMatch(html, /广告位空缺不会由普通优惠活动补位/);
        assert.match(html, /rel="nofollow sponsored noopener noreferrer"/);
        assert.match(html, /<h2 id="home-v3-ranking-title">🏆 GateRank 排行榜<\/h2>/);
        assert.doesNotMatch(html, /<h2 id="home-v3-ranking-title">综合实力排行<\/h2>/);
        assert.doesNotMatch(html, /共收录 \d+ 个机场/);
        assert.match(html, /星云机场/);
        assert.match(html, /观察 4 天/);
        assert.match(html, /href="\/airports\/nebula"/);
        assert.match(html, /<h2>公告与动态<\/h2>/);
        assert.doesNotMatch(html, /<h2>最新 News<\/h2>/);
        assert.match(html, /GateRank 3\.0 发布说明/);
        assert.match(html, /data-public-mobile-drawer="true"/);
        assert.match(html, /href="\/tools\/download"/);
        assert.match(html, /网络工具箱/);
        assert.match(html, /为什么选择 GateRank？/);
        assert.match(html, /常见问题与机场选购指南/);
        assert.match(html, /机场和 VPN 有什么区别？/);
        assert.match(html, /机场推荐看价格还是稳定性？/);
        assert.match(html, /href="\/rankings\/all"/);
        assert.match(html, /href="\/methodology"/);
        assert.match(html, /href="\/risk-monitor"/);
        assert.match(html, /href="\/deals"/);
        assert.match(html, /href="\/rankings\/payment\/alipay"/);
        assert.match(html, /href="\/rankings\/payment\/usdt-trc20"/);
        assert.match(html, /href="\/rankings\/unlock\/chatgpt"/);
        assert.match(html, /href="\/rankings\/unlock\/netflix"/);
        assert.match(html, /"@type":"FAQPage"/);
        const homeFaqQuestionCount = Array.from(html.matchAll(/"@type":"Question"/g)).length;
        assert.ok(homeFaqQuestionCount >= 5, `expected at least 5 home FAQ questions, got ${homeFaqQuestionCount}`);
      }
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('homepage SSR renders every summary item supplied by the configured backend limit', async () => {
  const baseItem = homeView.sections.new_entries.items[0];
  assert.ok(baseItem);
  const configuredItems = Array.from({ length: 5 }, (_, index) => ({
    ...baseItem,
    airport_id: 80 + index,
    name: `配置数量机场 ${index + 1}`,
    report_url: `/airports/configured-${index + 1}`,
  }));
  const configuredHomeView: HomePageView = {
    ...homeView,
    sections: {
      ...homeView.sections,
      new_entries: {
        ...homeView.sections.new_entries,
        items: configuredItems,
      },
    },
  };
  const app = express();
  app.use(createPublicPageRoutes({
    publicViewService: {
      ...createPublicViewServiceStub(),
      getHomePageView: async () => configuredHomeView,
    },
    frontendAssets: TEST_FRONTEND_ASSETS,
  }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(response.status, 200);
    const html = await response.text();

    for (const item of configuredItems) {
      assert.match(html, new RegExp(`href="${escapeRegExp(item.report_url)}"[^>]*>${escapeRegExp(item.name)}<`));
    }
    assert.doesNotMatch(html, /每组最多显示 4 条真实数据/);
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

test('core public SEO pages expose dedicated 1200x630 OG images', async () => {
  const app = express();
  app.use(createPublicPageRoutes({
    publicViewService: createPublicViewServiceStub(),
    airportAdCampaignRepository: {
      listActiveDeals: async () => [createDealView(1), createDealView(2)],
    },
    monthlyReportPublicService: {
      getListView: async () => ({
        page: 1,
        page_size: 12,
        total: 1,
        total_pages: 1,
        items: [createMonthlyReportListItem()],
      }),
      getBySlug: async () => null,
      getSitemapItems: async () => [],
    } as never,
    frontendAssets: TEST_FRONTEND_ASSETS,
  }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;
    const checks = [
      ['/', '/og/home-2026-airport-ranking.png', '机场榜 GateRank 全球科学上网机场评测与排名平台分享图'],
      ['/rankings/all', '/og/rankings-all.png', 'GateRank 全量机场排行榜分享图'],
      ['/tools', '/og/tools.png', 'GateRank 网络检测与科学上网工具箱分享图'],
      ['/tools/streaming-check', '/og/tools-streaming-check.png', 'GateRank 流媒体解锁检测工具分享图'],
      ['/tools/ip-check', '/og/tools-ip-check.png', 'GateRank IP 地理位置查询工具分享图'],
      ['/tools/dns-leak-test', '/og/tools-dns-leak-test.png', 'GateRank DNS 泄漏检测工具分享图'],
      ['/monthly-reports', '/og/monthly-reports.png', 'GateRank 机场 VPN 月度报告分享图'],
      ['/deals', '/og/deals-coupons.png', 'GateRank 机场优惠码大全分享图'],
      ['/risk-monitor', '/og/risk-monitor.png', 'GateRank 跑路机场监测分享图'],
      ['/methodology', '/og/methodology.png', 'GateRank 机场测评方法分享图'],
      ['/apply', '/og/apply.png', 'GateRank 申请入驻测试分享图'],
    ] as const;

    for (const [pathname, imagePath, alt] of checks) {
      const response = await fetch(`${baseUrl}${pathname}`, { headers: { host: `127.0.0.1:${port}` } });
      assert.equal(response.status, 200, pathname);
      const html = await response.text();
      const imageUrl = `${baseUrl}${imagePath}`;
      assert.match(html, new RegExp(`<meta property="og:image" content="${escapeRegExp(imageUrl)}" />`), pathname);
      assert.match(html, new RegExp(`<meta property="og:image:secure_url" content="${escapeRegExp(imageUrl)}" />`), pathname);
      assert.match(html, /<meta property="og:image:type" content="image\/png" \/>/);
      assert.match(html, /<meta property="og:image:width" content="1200" \/>/);
      assert.match(html, /<meta property="og:image:height" content="630" \/>/);
      assert.match(html, new RegExp(`<meta property="og:image:alt" content="${escapeRegExp(alt)}" />`), pathname);
      assert.match(html, new RegExp(`<meta name="twitter:image" content="${escapeRegExp(imageUrl)}" />`), pathname);
      assert.match(html, new RegExp(`<meta name="twitter:image:alt" content="${escapeRegExp(alt)}" />`), pathname);
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
    assert.match(html, /<section class="hero hero-deals">/);
    assert.match(html, /linear-gradient\(135deg, #241207 0%, #6F2F0B 38%, #D97706 72%, #F7D7B2 100%\)/);
    assert.match(html, /<h1>机场优惠码大全：活动折扣、免费试用与 USDT 支付优惠<\/h1>/);
    assert.match(html, /<div>当前活动<\/div>\s*<strong>2<\/strong>/);
    assert.doesNotMatch(html, />2\/6<\/strong>/);
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

test('GET /tools/download returns crawlable branded SEO download page HTML', async () => {
  const app = express();
  app.use(createPublicPageRoutes({
    publicViewService: createPublicViewServiceStub(),
    toolsDownloadService: {
      getDownloadPageView: async (platform?: string | null) => ({
        config: {
          ...DEFAULT_TOOLS_DOWNLOAD_PAGE_CONFIG,
          seo_title: '翻墙工具下载 | Clash Verge Rev、v2rayN、Shadowrocket 客户端',
          seo_description: 'GateRank 翻墙工具下载页收录 Windows、macOS、iOS、Android、Linux 常用科学上网客户端，支持官方页面跳转和后台上传文件。',
          seo_keywords: '翻墙工具下载,科学上网客户端下载,Clash Verge Rev,v2rayN,Shadowrocket,Stash,sing-box,Hiddify',
          h1: '翻墙工具下载：科学上网客户端与机场订阅工具',
          hero_description: '按系统筛选常用代理客户端，优先展示官方页面和后台上传的可信安装包。',
          content_sections: [
            { title: '如何选择翻墙工具', body: 'Windows 和 macOS 用户可优先查看 Clash Verge Rev、v2rayN、sing-box、Hiddify 等客户端。' },
          ],
        },
        platform: platform ?? null,
        platforms: ['windows', 'macos', 'ios', 'android', 'linux'],
        items: [
          createToolDownloadItem({
            slug: 'clash-verge-rev',
            name: 'Clash Verge Rev',
            platforms: ['windows', 'macos', 'linux'],
            local_file_url: '/uploads/tools/files/1783493370824-8654d0d0-9b6f-49ce-bcbf-ddd79a05bbc9.dmg',
            version: '2.5.1',
          }),
          createToolDownloadItem({ slug: 'v2rayn', name: 'v2rayN', platforms: ['windows'] }),
          createToolDownloadItem({ slug: 'shadowrocket', name: 'Shadowrocket', platforms: ['ios'] }),
          createToolDownloadItem({ slug: 'stash', name: 'Stash', platforms: ['ios', 'macos'] }),
          createToolDownloadItem({ slug: 'sing-box', name: 'sing-box', platforms: ['windows', 'macos', 'ios', 'android', 'linux'] }),
          createToolDownloadItem({ slug: 'hiddify', name: 'Hiddify', platforms: ['windows', 'macos', 'ios', 'android', 'linux'] }),
        ],
        hotItems: [
          createToolDownloadItem({ slug: 'clash-verge-rev', name: 'Clash Verge Rev', platforms: ['windows', 'macos', 'linux'] }),
          createToolDownloadItem({ slug: 'v2rayn', name: 'v2rayN', platforms: ['windows'] }),
        ],
        total: 6,
      }),
    } as never,
    frontendAssets: TEST_FRONTEND_ASSETS,
  }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;
    const response = await fetch(`${baseUrl}/tools/download`, { headers: { host: `127.0.0.1:${port}` } });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<h1>翻墙工具下载：科学上网客户端与机场订阅工具<\/h1>/);
    assert.match(html, /<title>翻墙工具下载 \| Clash Verge Rev、v2rayN、Shadowrocket 客户端 \| 机场榜GateRank<\/title>/);
    assert.match(html, /<meta name="keywords" content="翻墙工具下载,科学上网客户端下载,Clash Verge Rev,v2rayN,Shadowrocket,Stash,sing-box,Hiddify" \/>/);
    assert.match(html, /<link rel="canonical" href="http:\/\/127\.0\.0\.1:\d+\/tools\/download"/);
    assert.match(html, /<meta property="og:image" content="http:\/\/127\.0\.0\.1:\d+\/og\/download\.png" \/>/);
    assert.match(html, /<meta property="og:image:alt" content="GateRank 翻墙工具下载页分享图" \/>/);
    assert.match(html, /<a class="public-top-nav-link is-active" href="\/tools" aria-haspopup="true" data-client-nav="true">工具<\/a>/);
    assert.match(html, /\.public-top-nav-submenu \{[\s\S]*?min-width: 260px;/);
    assert.match(html, /\.public-top-nav-submenu-link > span:first-child \{[\s\S]*?white-space: nowrap;/);
    assert.match(html, /href="\/tools\/download"/);
    assert.match(html, /Windows 翻墙工具下载/);
    assert.match(html, /macOS 翻墙工具下载/);
    assert.match(html, /iOS 翻墙工具下载/);
    assert.match(html, /Android 翻墙工具下载/);
    assert.match(html, /Linux 翻墙工具下载/);
    assert.match(html, /支持版本：macOS 12\+/);
    assert.match(html, /支持版本：Windows 10\/11/);
    assert.match(html, /<a class="tool-download-primary" href="\/download\/file\/clash-verge-rev\?platform=macos">立即下载<\/a>/);
    assert.doesNotMatch(html, /href="\/download\/file\/clash-verge-rev\?platform=macos" download=/);
    assert.doesNotMatch(html, /\/uploads\/tools\/files\/1783493370824-8654d0d0-9b6f-49ce-bcbf-ddd79a05bbc9\.dmg/);
    assert.match(html, /\.tools-download-card-grid \{ display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
    assert.doesNotMatch(html, /\.tools-download-card-grid \{ display: grid; grid-template-columns: repeat\(auto-fit/);
    assert.match(html, /class="tool-card is-hot"/);
    assert.match(html, /class="tool-hot-badge" data-tool-hot-badge>热门<\/span>/);
    assert.match(html, /\.tool-hot-badge \{ position: absolute;/);
    assert.match(html, /class="muted tool-trust-meta"/);
    assert.match(html, /\.tool-card-head > div \{ min-width: 0; flex: 1; \}/);
    assert.match(html, /\.tool-card\.is-hot \.tool-card-head h3 \{ padding-right: 68px; \}/);
    assert.match(html, /\.tool-trust-meta \{ line-height: 1\.5; overflow-wrap: anywhere; \}/);
    assert.match(html, /@media \(min-width: 640px\) \{\s*\.tool-trust-meta \{ white-space: nowrap; \}/);
    assert.doesNotMatch(html, /\.tool-card\.is-hot \.tool-card-head \{ padding-right: 68px; \}/);
    assert.match(html, /\.tool-download-primary:not\(\.is-disabled\):hover,/);
    assert.match(html, /\.tool-official-link:hover,/);
    assert.doesNotMatch(html, /Download Center/);
    assert.doesNotMatch(html, /选择你的设备系统/);
    assert.doesNotMatch(html, /热门客户端推荐/);
    assert.doesNotMatch(html, /class="tool-platform-row"/);
    assert.doesNotMatch(html, /href="\/download\?platform=windows"/);
    assert.match(html, /Clash Verge Rev/);
    assert.match(html, /v2rayN/);
    assert.match(html, /Shadowrocket/);
    assert.match(html, /Stash/);
    assert.match(html, /sing-box/);
    assert.match(html, /Hiddify/);
    assert.match(html, /"@type":"SoftwareApplication"/);
    assert.match(html, /"@type":"FAQPage"/);
    assert.match(html, /Windows 翻墙工具推荐哪个？/);
    assert.match(html, /Android 用 v2rayNG 还是 Karing？/);
    assert.match(html, /Shadowrocket 为什么需要美区 Apple ID？/);
    assert.match(html, /"name":"Windows 翻墙工具推荐哪个？"/);
    assert.match(html, /"name":"Shadowrocket 为什么需要美区 Apple ID？"/);
    assert.match(html, /"kind":"tools_download"/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /download/file/:slug uses controlled download headers and rejects obvious bots', async () => {
  let recordedDownloads = 0;
  const app = express();
  app.use(createPublicPageRoutes({
    publicViewService: createPublicViewServiceStub(),
    toolsDownloadService: {
      getDownloadPageView: async () => ({
        config: {
          seo_title: '翻墙工具下载',
          seo_description: '翻墙工具下载页面。',
          seo_keywords: '翻墙工具下载',
          h1: '翻墙工具下载',
          hero_description: '下载工具。',
          content_sections: [],
          faq_items: [],
        },
        platform: null,
        platforms: ['windows', 'macos', 'ios', 'android', 'linux'],
        items: [],
        hotItems: [],
        total: 0,
      }),
      getDownloadFileTarget: async (slug: string, platform: string) => ({
        item: createToolDownloadItem({
          slug,
          name: 'Clash Verge Rev',
          platforms: ['macos'],
          local_file_url: '/uploads/tools/files/clash-verge-rev.dmg',
          version: '2.5.1',
        }),
        platform,
        downloadFilename: 'Clash.Verge_2.5.1_aarch64.dmg',
        absolutePath: '/tmp/gaterank-test-clash-verge-rev.dmg',
        internalRedirectPath: '/_protected_uploads/tools/files/clash-verge-rev.dmg',
      }),
      recordDownload: async () => {
        recordedDownloads += 1;
      },
    } as never,
  }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const browserResponse = await fetch(`http://127.0.0.1:${port}/download/file/clash-verge-rev?platform=macos`, {
      headers: {
        'user-agent': 'Mozilla/5.0 GateRank download test',
        'accept-language': 'zh-CN,zh;q=0.9',
      },
    });
    assert.equal(browserResponse.status, 200);
    assert.equal(browserResponse.headers.get('x-accel-redirect'), '/_protected_uploads/tools/files/clash-verge-rev.dmg');
    assert.match(browserResponse.headers.get('content-disposition') || '', /attachment/);
    assert.match(browserResponse.headers.get('content-disposition') || '', /filename\*=UTF-8''Clash\.Verge_2\.5\.1_aarch64\.dmg/);
    assert.equal(recordedDownloads, 1);

    const repeatResponse = await fetch(`http://127.0.0.1:${port}/download/file/clash-verge-rev?platform=macos`, {
      headers: {
        'user-agent': 'Mozilla/5.0 GateRank download test',
        'accept-language': 'zh-CN,zh;q=0.9',
      },
    });
    assert.equal(repeatResponse.status, 200);
    assert.equal(recordedDownloads, 2);

    const botResponse = await fetch(`http://127.0.0.1:${port}/download/file/clash-verge-rev?platform=macos`, {
      headers: {
        'user-agent': 'curl/8.0.1',
      },
    });
    assert.equal(botResponse.status, 403);
    assert.equal(((await botResponse.json()) as { code?: string }).code, 'DOWNLOAD_FORBIDDEN');
    assert.equal(recordedDownloads, 2);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /tools/download platform filter is noindex and canonicalizes to base page', async () => {
  const app = express();
  app.use(createPublicPageRoutes({
    publicViewService: createPublicViewServiceStub(),
    toolsDownloadService: {
      getDownloadPageView: async (platform?: string | null) => ({
        config: {
          seo_title: '翻墙工具下载',
          seo_description: '翻墙工具下载页面。',
          seo_keywords: '翻墙工具下载',
          h1: '翻墙工具下载',
          hero_description: '下载工具。',
          content_sections: [],
          faq_items: [],
        },
        platform: platform ?? null,
        platforms: ['windows', 'macos', 'ios', 'android', 'linux'],
        items: [createToolDownloadItem({ slug: 'stash', name: 'Stash', platforms: ['macos'] })],
        hotItems: [],
        total: 1,
      }),
    } as never,
  }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/tools/download?platform=macos`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<meta name="robots" content="noindex,follow" \/>/);
    assert.match(html, /<link rel="canonical" href="http:\/\/127\.0\.0\.1:\d+\/tools\/download"/);
    assert.match(html, /macOS 翻墙工具下载/);
    assert.doesNotMatch(html, /Windows 翻墙工具下载/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /tools renders the tool index and legacy /download redirects with query parameters', async () => {
  const app = express();
  app.use(createPublicPageRoutes({
    publicViewService: createPublicViewServiceStub(),
    toolsDownloadService: {
      getDownloadPageView: async () => ({
        config: {
          seo_title: '翻墙工具下载',
          seo_description: '翻墙工具下载页面。',
          seo_keywords: '翻墙工具下载',
          h1: '翻墙工具下载',
          hero_description: '下载工具。',
          content_sections: [],
          faq_items: [],
        },
        platform: null,
        platforms: ['windows', 'macos', 'ios', 'android', 'linux'],
        items: [],
        hotItems: [],
        total: 0,
      }),
    } as never,
  }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const indexResponse = await fetch(`http://127.0.0.1:${port}/tools`, { redirect: 'manual' });
    assert.equal(indexResponse.status, 200);
    const indexHtml = await indexResponse.text();
    assert.match(indexHtml, /<title>网络检测与科学上网工具箱 \| 机场榜GateRank<\/title>/);
    assert.match(indexHtml, /<h1>网络检测与科学上网工具箱<\/h1>/);
    assert.match(indexHtml, /href="\/tools\/download"/);
    assert.match(indexHtml, /href="\/tools\/streaming-check"/);
    assert.match(indexHtml, /href="\/tools\/ip-check"/);
    assert.match(indexHtml, /href="\/tools\/dns-leak-test"/);
    assert.match(indexHtml, /\/og\/tools\.png/);
    assert.match(indexHtml, /"@type":"CollectionPage"/);
    assert.match(indexHtml, /"@type":"ItemList"/);

    const legacyDownloadResponse = await fetch(`http://127.0.0.1:${port}/download?platform=macos`, { redirect: 'manual' });
    assert.equal(legacyDownloadResponse.status, 301);
    assert.equal(legacyDownloadResponse.headers.get('location'), '/tools/download?platform=macos');

    const ipCheckResponse = await fetch(`http://127.0.0.1:${port}/tools/ip-check`);
    assert.equal(ipCheckResponse.status, 200);
    const ipCheckHtml = await ipCheckResponse.text();
    assert.match(ipCheckHtml, /<h1>IP 地理位置查询<\/h1>/);
    assert.match(ipCheckHtml, /placeholder="输入 IP 地址或域名"/);
    assert.match(ipCheckHtml, /GateRank 不持久保存查询历史/);
    assert.match(ipCheckHtml, /ipwho\.is/);
    assert.match(ipCheckHtml, /进程内存中临时缓存最多 24 小时/);
    assert.doesNotMatch(ipCheckHtml, /ip-api Pro/);
    assert.match(ipCheckHtml, /<meta name="robots" content="index,follow,max-image-preview:large" \/>/);
    assert.match(ipCheckHtml, /<link rel="canonical" href="http:\/\/127\.0\.0\.1:\d+\/tools\/ip-check" \/>/);
    assert.match(ipCheckHtml, /<title>IP 地理位置查询 \| IP 地址、域名、ISP 与 ASN 检测 \| 机场榜GateRank<\/title>/);
    assert.match(ipCheckHtml, /\/og\/tools-ip-check\.png/);
    assert.match(ipCheckHtml, /"@type":"WebApplication"/);
    assert.match(ipCheckHtml, /"@type":"FAQPage"/);
    assert.doesNotMatch(ipCheckHtml, /IP 检测工具即将上线|即将上线/);

    const streamingResponse = await fetch(`http://127.0.0.1:${port}/tools/streaming-check`);
    assert.equal(streamingResponse.status, 200);
    assert.equal(
      streamingResponse.headers.get('cache-control'),
      'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
    );
    const streamingHtml = await streamingResponse.text();
    assert.match(streamingHtml, /<h1>流媒体解锁检测<\/h1>/);
    for (const service of ['ChatGPT', 'Netflix', 'Claude', 'TikTok', 'Disney+', 'HBO Max']) {
      assert.match(streamingHtml, new RegExp(`<h2>${escapeRegExp(service)}<\\/h2>`));
    }
    assert.match(streamingHtml, /<meta name="robots" content="index,follow,max-image-preview:large" \/>/);
    assert.match(streamingHtml, /<link rel="canonical" href="http:\/\/127\.0\.0\.1:\d+\/tools\/streaming-check" \/>/);
    assert.match(streamingHtml, /<title>流媒体解锁检测 \| ChatGPT、Netflix、Claude、TikTok、Disney\+、HBO Max \| 机场榜GateRank<\/title>/);
    assert.match(streamingHtml, /\/og\/tools-streaming-check\.png/);
    assert.match(streamingHtml, /"@type":"WebApplication"/);
    assert.match(streamingHtml, /"@type":"FAQPage"/);
    assert.doesNotMatch(streamingHtml, /流媒体解锁检测<\/span><span class="public-top-nav-submenu-badge">即将上线/);
    assert.doesNotMatch(streamingHtml, /IP 检测<\/span><span class="public-top-nav-submenu-badge">即将上线/);

    const dnsLeakResponse = await fetch(`http://127.0.0.1:${port}/tools/dns-leak-test`);
    assert.equal(dnsLeakResponse.status, 200);
    const dnsLeakHtml = await dnsLeakResponse.text();
    assert.match(dnsLeakHtml, /<h1>DNS Leak Test<\/h1>/);
    assert.match(dnsLeakHtml, /DNS 解析器证据/);
    assert.match(dnsLeakHtml, /每一行代表一个实际访问 GateRank 权威探针/);
    assert.match(dnsLeakHtml, /AS 编号/);
    assert.match(dnsLeakHtml, /不能据此判断 DoH 或 DoT/);
    assert.match(dnsLeakHtml, /DoH/);
    assert.match(dnsLeakHtml, /网页无法可靠判断/);
    assert.match(dnsLeakHtml, /<link rel="canonical" href="http:\/\/127\.0\.0\.1:\d+\/tools\/dns-leak-test" \/>/);
    assert.match(dnsLeakHtml, /<title>DNS Leak Test \| DNS 泄漏、解析器与 DNSSEC 检测 \| 机场榜GateRank<\/title>/);
    assert.match(dnsLeakHtml, /GateRank DNS 泄漏检测工具分享图/);
    assert.match(dnsLeakHtml, /"@type":"WebApplication"/);
    assert.match(dnsLeakHtml, /"@type":"FAQPage"/);
    assert.doesNotMatch(dnsLeakHtml, /即将上线/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /monthly-reports returns crawlable monthly report index HTML', async () => {
  const app = express();
  app.use(createPublicPageRoutes({
    publicViewService: createPublicViewServiceStub(),
    monthlyReportPublicService: {
      getListView: async () => ({
        page: 1,
        page_size: 12,
        total: 1,
        total_pages: 1,
        items: [createMonthlyReportListItem()],
      }),
      getBySlug: async () => null,
      getSitemapItems: async () => [],
    } as never,
    frontendAssets: TEST_FRONTEND_ASSETS,
  }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/monthly-reports`, { headers: { host: `127.0.0.1:${port}` } });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<h1>2026机场推荐月度报告<span>按月份追踪机场排行榜与测评结论<\/span><\/h1>/);
    assert.match(html, /2026机场推荐月度报告 \| 机场排行榜、机场测评、稳定机场推荐与便宜机场推荐/);
    assert.match(html, /<meta name="keywords" content="机场推荐,2026机场推荐,机场排行榜,机场测评,稳定机场推荐,便宜机场推荐,/);
    for (const keyword of ['机场推荐', '2026机场推荐', '机场排行榜', '机场测评', '稳定机场推荐', '便宜机场推荐']) {
      assert.match(html, new RegExp(keyword));
    }
    assert.match(html, /<link rel="canonical" href="http:\/\/127\.0\.0\.1:\d+\/monthly-reports"/);
    assert.match(html, /<h2>按年份归档<\/h2>/);
    assert.match(html, /<div class="monthly-report-year">2026<\/div>/);
    assert.match(html, /<div class="monthly-report-month">06月<\/div>/);
    assert.match(html, /2026机场推荐、机场排行榜与机场测评索引/);
    assert.match(html, /月度报告如何服务机场推荐搜索/);
    assert.match(html, /2026年6月机场 VPN 月度报告/);
    assert.match(html, /\/monthly-reports\/2026-06-airport-vpn-ranking-report/);
    assert.match(html, /"@type":"CollectionPage"/);
    assert.match(html, /"@type":"BreadcrumbList"/);
    assert.match(html, /"@type":"ItemList"/);
    assert.equal(Array.from(html.matchAll(/<script type="application\/ld\+json">/g)).length, 1);
    assert.match(html, /"kind":"monthly_reports"/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /monthly-reports/:slug returns configured SEO and OG image', async () => {
  const app = express();
  app.use(createPublicPageRoutes({
    publicViewService: createPublicViewServiceStub(),
    monthlyReportPublicService: {
      getListView: async () => ({ page: 1, page_size: 12, total: 0, total_pages: 1, items: [] }),
      getBySlug: async (slug: string) => slug === '2026-06-airport-vpn-ranking-report'
        ? createMonthlyReport()
        : null,
      getSitemapItems: async () => [],
    } as never,
    frontendAssets: TEST_FRONTEND_ASSETS,
  }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/monthly-reports/2026-06-airport-vpn-ranking-report`, {
      headers: { host: `127.0.0.1:${port}` },
    });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<title>自定义 SEO 月报标题<\/title>/);
    assert.match(html, /<meta name="description" content="自定义 SEO 月报描述" \/>/);
    assert.match(html, /<meta name="keywords" content="机场VPN月报,机场推荐" \/>/);
    assert.match(html, /<meta property="og:image" content="http:\/\/127\.0\.0\.1:\d+\/uploads\/news\/monthly-og\.webp" \/>/);
    assert.match(html, /<meta property="og:image:type" content="image\/webp" \/>/);
    assert.match(html, /<h1>2026年6月机场 VPN 月度报告<\/h1>/);
    assert.match(html, /<strong>重点机场<\/strong>/);
    assert.match(html, /"@type":"Article"/);
    assert.match(html, /"kind":"monthly_report"/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /monthly-reports/:slug renders airport links that open in a new tab', async () => {
  const app = express();
  app.use(createPublicPageRoutes({
    publicViewService: createPublicViewServiceStub(),
    monthlyReportPublicService: {
      getListView: async () => ({ page: 1, page_size: 12, total: 0, total_pages: 1, items: [] }),
      getBySlug: async () => createMonthlyReport({
        content_html: '<p><a class="news-link" href="/airports/xiaomi" target="_blank" rel="noreferrer noopener">小米机场</a></p>',
      }),
      getSitemapItems: async () => [],
    } as never,
    frontendAssets: TEST_FRONTEND_ASSETS,
  }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/monthly-reports/2026-06-airport-vpn-ranking-report`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(
      html,
      /<a class="news-link" href="\/airports\/xiaomi" target="_blank" rel="noreferrer noopener">小米机场<\/a>/,
    );
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /monthly-reports/:slug returns 404 for unpublished reports', async () => {
  const app = express();
  app.use(createPublicPageRoutes({
    publicViewService: createPublicViewServiceStub(),
    monthlyReportPublicService: {
      getListView: async () => ({ page: 1, page_size: 12, total: 0, total_pages: 1, items: [] }),
      getBySlug: async () => null,
      getSitemapItems: async () => [],
    } as never,
    frontendAssets: TEST_FRONTEND_ASSETS,
  }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/monthly-reports/draft-report`);
    assert.equal(response.status, 404);
    assert.match(await response.text(), /月度报告不存在或尚未发布/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /deals and GET /api/v1/pages/deals reuse a shared active deals cache', async () => {
  let dealsCalls = 0;
  const pageCache = createTimedPromiseCache(60_000);
  const airportAdCampaignRepository = {
    listActiveDeals: async (): Promise<AirportDealView[]> => {
      dealsCalls += 1;
      return [createDealView(1)];
    },
  };
  const publicViewService = createPublicViewServiceStub();
  const app = express();
  app.use('/api/v1', createPublicRoutes({
    airportRepository: {
      getById: async () => null,
    },
    airportApplicationRepository: {
      create: async () => 1,
    },
    metricsRepository: {
      getByAirportAndDate: async () => null,
    },
    scoreRepository: {
      getByAirportAndDate: async () => null,
      getTrend: async () => [],
    },
    rankingRepository: {
      getRanking: async () => [],
    },
    publicViewService,
    airportAdCampaignRepository,
    pageCache,
  }));
  app.use(createPublicPageRoutes({
    publicViewService,
    airportAdCampaignRepository,
    frontendAssets: TEST_FRONTEND_ASSETS,
    pageCache,
  }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const htmlResponse = await fetch(`http://127.0.0.1:${port}/deals`);
    const apiResponse = await fetch(`http://127.0.0.1:${port}/api/v1/pages/deals`);

    assert.equal(htmlResponse.status, 200);
    assert.equal(apiResponse.status, 200);
    assert.equal(dealsCalls, 1);
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

    assert.match(html, /<section class="hero hero-methodology">/);
    assert.match(html, /linear-gradient\(135deg, #082F49 0%, #075985 38%, #0284C7 72%, #BAE6FD 100%\)/);
    assert.match(html, /总公式与评分目标/);
    assert.match(html, /0\.4 × 稳定性 S \+ 0\.3 × 性能 P \+ 0\.1 × 价格 C \+ 0\.2 × 风险 R/);
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
    assert.match(html, /aria-label="翻墙工具客户端下载"/);
    assert.match(html, /按 Android、macOS、Windows、Linux 选择常用客户端/);
    const rankingFiltersStart = html.indexOf('class="content-card ranking-filter-card"');
    const rankingDownloadCtaStart = html.indexOf('class="home-tool-download-cta"');
    const rankingListStart = html.indexOf('<h2>机场排行列表</h2>');
    assert.notEqual(rankingFiltersStart, -1);
    assert.notEqual(rankingDownloadCtaStart, -1);
    assert.notEqual(rankingListStart, -1);
    assert.ok(rankingFiltersStart < rankingDownloadCtaStart);
    assert.ok(rankingDownloadCtaStart < rankingListStart);
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
    assert.ok(calls.some((call) => call.page === 1 && call.pageSize === 100));

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

test('GET /rankings/all embeds client-sized initial payload for React pagination after refresh', async () => {
  const calls: Array<{ page: number; pageSize: number }> = [];
  const app = express();
  app.use(createPublicPageRoutes({
    publicViewService: {
      ...createPublicViewServiceStub(),
      getFullRankingView: async (_date: string, page: number, pageSize: number, filters): Promise<FullRankingView> => {
        calls.push({ page, pageSize });
        const total = 25;
        return {
          ...buildFullRankingViewWithAirportCount(total),
          page,
          page_size: pageSize,
          total,
          total_pages: Math.max(1, Math.ceil(total / pageSize)),
          filters,
          items: buildFullRankingViewWithAirportCount(total).items.slice(0, pageSize),
        };
      },
    },
  }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/rankings/all?date=2026-03-23&page=1`);
    assert.equal(response.status, 200);
    assert.deepEqual(calls, [
      { page: 1, pageSize: 100 },
      { page: 1, pageSize: 20 },
    ]);

    const html = await response.text();
    const matched = html.match(/<script id="__GATERANK_INITIAL_DATA__" type="application\/json">([^<]+)<\/script>/);
    assert.ok(matched);
    const initialData = JSON.parse(matched[1]) as {
      payload: { page_size: number; total: number; total_pages: number; items: unknown[] };
    };
    assert.equal(initialData.payload.page_size, 20);
    assert.equal(initialData.payload.total, 25);
    assert.equal(initialData.payload.total_pages, 2);
    assert.equal(initialData.payload.items.length, 20);
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

test('GET /rankings/payment/alipay renders indexable static single-filter SEO page', async () => {
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
    const response = await fetch(`http://127.0.0.1:${port}/rankings/payment/alipay`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<h1>支持支付宝的机场 VPN 推荐排名<\/h1>/);
    assert.match(html, /<meta name="robots" content="index,follow,max-image-preview:large"/);
    assert.match(html, /<link rel="canonical" href="http:\/\/127\.0\.0\.1:\d+\/rankings\/payment\/alipay"/);
    assertStaticOgImage(html, `http://127.0.0.1:${port}`, '/og/rankings-payment.png', 'GateRank 支持支付宝机场排行分享图');
    assert.match(html, /搜索与分类筛选/);
    assert.match(html, /支付宝机场怎么选/);
    assert.match(html, /支付宝机场的优点和风险/);
    assert.match(html, /支付宝机场与 USDT-TRC20 机场对比/);
    assert.match(html, /支付宝机场适合哪些用户/);
    assert.match(html, /"@type":"FAQPage"/);
    assert.match(html, /class="filter-chip active" href="\/rankings\/all">支付宝<\/a>/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /rankings/all redirects indexable single-filter query to static URL', async () => {
  const app = express();
  app.use(createPublicPageRoutes({ publicViewService: createPublicViewServiceStub() }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/rankings/all?payment=alipay`, {
      redirect: 'manual',
    });
    assert.equal(response.status, 301);
    assert.equal(response.headers.get('location'), '/rankings/payment/alipay');
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

test('GET /rankings static filter rejects unknown slugs', async () => {
  const app = express();
  app.use(createPublicPageRoutes({ publicViewService: createPublicViewServiceStub() }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/rankings/payment/not-a-filter`);
    assert.equal(response.status, 404);
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
    assert.equal(response.headers.get('location'), '/rankings/payment/alipay');
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
    assert.equal(fullRankingCalls, 2);
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
    assert.match(okHtml, /<title>星云机场怎么样？星云机场测评、官网入口、稳定性与跑路风险分析 \| 机场榜GateRank<\/title>/);
    assert.match(okHtml, /<h1>星云机场测评：官网入口、稳定性、速度与跑路风险分析<\/h1>/);
    assertStaticOgImage(okHtml, `http://127.0.0.1:${port}`, '/og/airport-report.png', 'GateRank 机场测评报告分享图');
    assert.match(okHtml, /id="report-top"/);
    assert.match(okHtml, /报告日期：2026-03-23/);
    assert.match(okHtml, /<div class="breadcrumb"><a href="\/">首页<\/a><span>\/<\/span>星云机场<\/div>/);
    assert.doesNotMatch(okHtml, /机场专题/);
    assert.match(okHtml, /aria-label="报告页面导航"/);
    assert.match(okHtml, /class="is-active" aria-current="location" href="#report-overview"/);
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
    assert.match(okHtml, /机场排行/);
    assert.match(okHtml, /申请入驻/);
    assert.match(okHtml, /GateRank Score/);
    assert.match(okHtml, /class="score-methodology"/);
    assert.match(okHtml, /class="score-radar"/);
    assert.match(okHtml, /<title id="report-score-radar-title">本报告四维评分分布<\/title>/);
    assert.match(okHtml, /points="60,12\.48 107\.04,60 60,103\.2 14\.4,60"/);
    assert.match(okHtml, /class="score-methodology-link" href="\/methodology">我们是如何测评的？/);
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
    assert.match(okHtml, /<summary>适合哪些用户<\/summary>/);
    assert.match(okHtml, /<summary>选择前要注意什么<\/summary>/);
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
    assert.doesNotMatch(okHtml, /capability-check/);
    assert.match(okHtml, /Netflix/);
    assert.match(okHtml, /<svg viewBox="0 0 24 24" fill="currentColor"/);
    assert.match(okHtml, /支付宝/);
    assert.match(okHtml, /#1677FF/);
    assert.match(okHtml, /Telegram 群组/);
    assert.match(okHtml, /#26A5E4/);
    assert.match(okHtml, /香港 · 6 节点 · IEPL/);
    assert.match(okHtml, /🇭🇰/);
    assert.match(okHtml, /aria-label="翻墙工具客户端下载"/);
    assert.match(okHtml, /星云机场已收录的客户端支持包括 Clash、Shadowrocket/);
    const capabilitySectionStart = okHtml.indexOf('<section id="report-capabilities"');
    const reportDownloadCtaStart = okHtml.indexOf('class="home-tool-download-cta"');
    const reportScoreStart = okHtml.indexOf('<section id="report-score"');
    assert.notEqual(capabilitySectionStart, -1);
    assert.notEqual(reportDownloadCtaStart, -1);
    assert.notEqual(reportScoreStart, -1);
    assert.ok(capabilitySectionStart < reportDownloadCtaStart);
    assert.ok(reportDownloadCtaStart < reportScoreStart);
    assert.match(okHtml, /评分拆解/);
    const scoreSectionStart = okHtml.indexOf('<section id="report-score"');
    assert.notEqual(scoreSectionStart, -1);
    const scoreSectionEnd = okHtml.indexOf('<section id="report-metrics"', scoreSectionStart);
    assert.notEqual(scoreSectionEnd, -1);
    const scoreSection = okHtml.slice(scoreSectionStart, scoreSectionEnd);
    assert.match(scoreSection, /<div>稳定性 \(S\)<\/div>/);
    assert.match(scoreSection, /<div>性能 \(P\)<\/div>/);
    assert.match(scoreSection, /<div>价格 \(C\)<\/div>/);
    assert.match(scoreSection, /<div>风险 \(R\)<\/div>/);
    assert.match(scoreSection, /<div>最终分<\/div>/);
    assert.doesNotMatch(scoreSection, /<div>风险惩罚<\/div>/);
    assert.match(okHtml, /核心监测指标/);
    assert.match(okHtml, /30 天可用率/);
    assert.doesNotMatch(okHtml, /<h2>30 天趋势<\/h2>/);
    assert.match(okHtml, /<h2>近 2 天趋势<\/h2>/);
    assert.match(okHtml, /套餐信息/);
    assert.match(okHtml, /电报信息/);
    assert.match(okHtml, /最低年付折算月价/);
    assert.match(okHtml, /https:\/\/t\.me\/nebula_group/);
    assert.doesNotMatch(okHtml, /导入与配置/);
    assert.match(okHtml, /结论与建议/);
    assert.match(okHtml, /继续对比更多机场/);
    assert.match(okHtml, /href="\/rankings\/all"/);
    assert.match(okHtml, /href="\/rankings\/unlock\/chatgpt"/);
    assert.match(okHtml, /href="\/rankings\/unlock\/netflix"/);
    assert.match(okHtml, /href="\/rankings\/payment\/usdt-trc20"/);
    assert.doesNotMatch(okHtml, /GateRank Pro 数据看板/);
    assert.match(okHtml, /常见问题/);
    assert.match(okHtml, /星云机场怎么样/);
    assert.match(okHtml, /星云机场测评怎么看/);
    assert.match(okHtml, /星云机场官网是什么/);
    assert.match(okHtml, /星云机场跑路风险高吗/);
    assert.match(okHtml, /星云机场适合长期使用吗/);
    assert.match(okHtml, /星云机场风险主要来自哪里/);
    assert.match(okHtml, /星云机场支持哪些套餐、客户端和地区/);
    assert.match(okHtml, /星云机场适合新手使用吗/);
    assert.match(okHtml, /星云机场支持流媒体吗/);
    assert.match(okHtml, /星云机场支持 ChatGPT 和 AI 工具吗/);
    assert.match(okHtml, /星云机场速度怎么样/);
    assert.match(okHtml, /星云机场和其他机场相比有什么优势/);
    assert.match(okHtml, /选择星云机场前要注意什么/);
    const faqQuestionCount = Array.from(okHtml.matchAll(/"@type":"Question"/g)).length;
    assert.ok(faqQuestionCount >= 8, `expected at least 8 FAQ questions, got ${faqQuestionCount}`);
    assert.match(okHtml, /<script type="application\/ld\+json">/);
    assert.match(okHtml, /"@type":"FAQPage"/);
    assert.match(okHtml, /"@type":"ItemList"/);
    assert.match(okHtml, /"@type":"Product"/);
    assert.match(okHtml, /"reviewRating":\{"@type":"Rating","ratingValue":"98\.60","bestRating":"100","worstRating":"0"\}/);
    assert.match(okHtml, /"reviewBody":"GateRank 算法评分/);
    assert.doesNotMatch(okHtml, /"name":"用户评分"/);
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
    assert.match(description, /官网入口/);
    assert.match(description, /稳定性/);
    assert.match(description, /下载速度/);
    assert.match(description, /延迟/);
    assert.match(description, /代理请求失败率/);
    assert.match(description, /近 2 天趋势/);
    assert.match(description, /跑路风险分析/);
    assert.match(description, /是否值得使用/);
    assert.doesNotMatch(description, /https:\/\/nebula\.example\.com/);

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

test('GET /airports/:slug labels low report score as limited rating instead of high risk', async () => {
  const lowScoreReportView: ReportView = {
    ...reportView,
    airport: {
      ...reportView.airport,
      id: 8,
      slug: 'fresh-airport',
      name: '新入驻机场',
    },
    summary_card: {
      ...reportView.summary_card,
      name: '新入驻机场',
      score: 58.52,
    },
    score_breakdown: {
      ...reportView.score_breakdown,
      final_score: 58.52,
    },
  };
  const app = express();
  app.use(createPublicPageRoutes({
    publicViewService: {
      ...createPublicViewServiceStub(),
      getReportViewBySlug: async (slug: string): Promise<ReportView | null> => (slug === 'fresh-airport' ? lowScoreReportView : null),
    },
  }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/airports/fresh-airport`);
    assert.equal(response.status, 200);
    const html = await response.text();

    assert.match(html, /综合评级：评级受限/);
    assert.match(html, /<span>综合评级 评级受限<\/span>/);
    assert.doesNotMatch(html, /综合评级：高风险/);
    assert.doesNotMatch(html, /<span>综合评级 高风险<\/span>/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /airports/:slug keeps methodology guidance when the public total score is hidden', async () => {
  const hiddenScoreReportView: ReportView = {
    ...reportView,
    airport: {
      ...reportView.airport,
      id: 9,
      slug: 'hidden-score-airport',
      name: '隐藏总分机场',
    },
    summary_card: {
      ...reportView.summary_card,
      name: '隐藏总分机场',
      score: null,
      score_hidden: true,
      score_hidden_reason: 'insufficient_balance',
    },
    score_breakdown: {
      ...reportView.score_breakdown,
      final_score: null,
    },
  };
  const app = express();
  app.use(createPublicPageRoutes({
    publicViewService: {
      ...createPublicViewServiceStub(),
      getReportViewBySlug: async (slug: string): Promise<ReportView | null> => (slug === 'hidden-score-airport' ? hiddenScoreReportView : null),
    },
  }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/airports/hidden-score-airport`);
    assert.equal(response.status, 200);
    const html = await response.text();

    assert.match(html, /class="score-number score-number-hidden">暂不公开/);
    assert.match(html, /class="score-methodology"/);
    assert.match(html, /class="score-radar"/);
    assert.match(html, /href="\/methodology">我们是如何测评的？/);
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertStaticOgImage(html: string, baseUrl: string, imagePath: string, alt: string) {
  const imageUrl = `${baseUrl}${imagePath}`;
  assert.match(html, new RegExp(`<meta property="og:image" content="${escapeRegExp(imageUrl)}" />`));
  assert.match(html, new RegExp(`<meta property="og:image:secure_url" content="${escapeRegExp(imageUrl)}" />`));
  assert.match(html, /<meta property="og:image:type" content="image\/png" \/>/);
  assert.match(html, /<meta property="og:image:width" content="1200" \/>/);
  assert.match(html, /<meta property="og:image:height" content="630" \/>/);
  assert.match(html, new RegExp(`<meta property="og:image:alt" content="${escapeRegExp(alt)}" />`));
  assert.match(html, new RegExp(`<meta name="twitter:image" content="${escapeRegExp(imageUrl)}" />`));
  assert.match(html, new RegExp(`<meta name="twitter:image:alt" content="${escapeRegExp(alt)}" />`));
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

function createMonthlyReportListItem() {
  return {
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
}

function createMonthlyReport(input: Partial<ReturnType<typeof createMonthlyReportListItem> & { content_markdown: string; content_html: string }> = {}) {
  return {
    ...createMonthlyReportListItem(),
    seo_title: '自定义 SEO 月报标题',
    seo_description: '自定义 SEO 月报描述',
    seo_keywords: '机场VPN月报,机场推荐',
    cover_image_url: '/uploads/news/monthly-cover.webp',
    og_image_url: '/uploads/news/monthly-og.webp',
    og_image_alt: '月报 OG 图',
    content_markdown: '## 本月摘要\n\n**重点机场** 表现稳定。',
    content_html: '<h2 id="summary" class="news-heading news-heading-2">本月摘要</h2><p class="news-paragraph"><strong>重点机场</strong> 表现稳定。</p>',
    ...input,
  };
}

function createToolDownloadItem(input: { slug: string; name: string; platforms: string[]; local_file_url?: string; version?: string }) {
  const platform_versions = {
    windows: 'Windows 10/11',
    macos: 'macOS 12+',
    ios: 'iOS 15+',
    android: 'Android 8+',
    linux: 'Ubuntu 20.04+',
  };
  return {
    id: Math.floor(Math.random() * 1000) + 1,
    slug: input.slug,
    name: input.name,
    summary: `${input.name} 科学上网客户端`,
    description: `${input.name} 可用于导入机场订阅并连接代理节点。`,
    platforms: input.platforms,
    platform_versions,
    icon_url: `/uploads/tools/icons/${input.slug}.webp`,
    local_file_url: input.local_file_url || '',
    official_url: `https://example.com/${input.slug}`,
    primary_action: 'official' as const,
    version: input.version || 'latest',
    file_size_label: '',
    is_hot: true,
    sort_order: 1,
    status: 'published' as const,
    published_at: '2026-07-08 10:00:00',
    created_at: '2026-07-08 09:00:00',
    updated_at: '2026-07-08 10:00:00',
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
  tool_download_cta: {
    href: '/tools/download',
    title: '翻墙工具客户端下载',
    description: 'Android、macOS、Windows、Linux 常用客户端集中下载，覆盖 v2rayN、Karing、Clash Meta 等订阅工具。',
    platforms: ['Android', 'macOS', 'Windows', 'Linux'],
    items: [
      { slug: 'v2rayn', name: 'v2rayN', icon_url: '/uploads/tools/icons/v2rayn.webp' },
      { slug: 'karing', name: 'Karing', icon_url: '/uploads/tools/icons/karing.webp' },
      { slug: 'clash-verge-rev', name: 'Clash Verge Rev', icon_url: '/uploads/tools/icons/clash-verge-rev.webp' },
    ],
  },
  ranking_preview: {
    total: 12,
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
        created_at: '2026-03-20',
        score: 98.6,
        score_delta_vs_yesterday: { label: '对比昨天', value: 1.2 },
        score_date: '2026-03-23',
        report_url: '/airports/nebula',
      },
    ],
  },
  sponsored_deals: {
    total: 1,
    display_limit: 4,
    items: [
      {
        campaign_id: 101,
        airport_id: 17,
        home_slot: 1,
        name: '星云优惠机场',
        website: 'https://deal.example.com',
        report_url: '/airports/nebula-deal',
        discount_title: '新客八折',
        discount_description: '月付套餐限时优惠。',
        coupon_code: 'GATE20',
        plan_price_month: 12,
        tracking_days: 180,
        tags: ['IEPL', '新客优惠'],
        score: 91.2,
        score_hidden: false,
        score_hidden_reason: null,
        score_delta_vs_yesterday: { label: '对比昨天', value: null },
      },
    ],
  },
  news_updates: [
    {
      id: 1,
      title: 'GateRank 3.0 发布说明',
      slug: 'gaterank-3-release',
      href: '/news/gaterank-3-release',
      published_at: '2026-03-23T09:00:00+08:00',
    },
  ],
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
    new_entries: {
      title: '新入榜潜力',
      subtitle: 'New Entries',
      items: [
        {
          type: 'new',
          airport_id: 8,
          name: '极光机场',
          website: 'https://aurora.example.com',
          tags: ['新入榜'],
          score: 86.2,
          score_delta_vs_yesterday: { label: '对比昨天', value: null },
          stability_tier: 'minor_fluctuation',
          details: [
            { label: '上架时间', value: '2026-03-20' },
            { label: '月付价格', value: '¥18/月' },
          ],
          conclusion: '新入榜机场，建议先短周期观察。',
          report_url: '/airports/aurora',
        },
      ],
    },
    risk_alerts: {
      title: '风险预警',
      subtitle: 'Risk Alerts',
      items: [
        {
          type: 'risk',
          airport_id: 9,
          name: '风险观察机场',
          website: 'https://risk-alert.example.com',
          tags: ['域名异常'],
          score: 67.4,
          score_delta_vs_yesterday: { label: '对比昨天', value: -4.2 },
          stability_tier: 'volatile',
          details: [
            { label: '异常记录', value: '域名异常' },
            { label: '投诉指数', value: '上升' },
          ],
          conclusion: '近期存在风险信号，建议谨慎选择。',
          report_url: '/airports/risk-alert',
        },
      ],
    },
  },
};

const fullRankingView: FullRankingView = {
  date: '2026-03-23',
  generated_at: '2026-03-23T10:00:00+08:00',
  page: 1,
  page_size: 20,
  total: 1,
  total_pages: 1,
  tool_download_cta: {
    href: '/tools/download',
    title: '翻墙工具客户端下载',
    description: '常用客户端集中下载。',
    platforms: ['Android', 'macOS', 'Windows', 'Linux'],
    items: [
      { slug: 'clash-verge-rev', name: 'Clash Verge Rev', icon_url: '/uploads/tools/icons/clash-verge-rev.webp' },
    ],
  },
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
  tool_download_cta: {
    href: '/tools/download',
    title: '翻墙工具客户端下载',
    description: '常用客户端集中下载。',
    platforms: ['Android', 'macOS', 'Windows', 'Linux'],
    items: [
      { slug: 'clash-verge-rev', name: 'Clash Verge Rev', icon_url: '/uploads/tools/icons/clash-verge-rev.webp' },
    ],
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
    packet_loss_30d: [
      { date: '2026-03-20', value: 10 },
      { date: '2026-03-23', value: 0 },
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
