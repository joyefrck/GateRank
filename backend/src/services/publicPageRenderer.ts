import type {
  FullRankingItem,
  FullRankingView,
  HomePageView,
  ReportView,
  RiskMonitorItem,
  RiskMonitorView,
} from '../types/domain';
import {
  APPLY_SEO,
  METHODOLOGY_SEO,
  PUBLIC_FRONTEND_ASSETS,
  PUBLIC_SEO_PATHS,
  buildFullRankingSeo,
  buildHomeSeo,
  buildQuery,
  buildAirportReportPath,
  buildReportSeo,
  buildRiskMonitorSeo,
  formatAirportStatusLabel,
  formatMetric,
  type PublicSeoText,
} from '../../../shared/publicSeo';
import { PUBLIC_SITE_BRAND_NAME } from '../../../shared/publicBrand';

interface RenderOptions {
  siteUrl: string;
  canonicalPath: string;
  seo: PublicSeoText;
  active: 'home' | 'rankings' | 'risk' | 'methodology' | 'apply';
  jsonLd: unknown;
  body: string;
  status?: number;
  initialData?: PublicInitialData;
}

interface PublicInitialData {
  kind: 'home' | 'full_ranking' | 'risk_monitor';
  params: {
    date?: string | null;
    page?: number | null;
  };
  payload: unknown;
}

export function renderHomePublicPage(siteUrl: string, view: HomePageView, requestedDate?: string): string {
  const seo = buildHomeSeo({
    dateLabel: view.date,
    monitoredAirports: view.hero.monitored_airports,
    realtimeTests: view.hero.realtime_tests,
  });
  const canonicalPath = `/${buildQuery({ date: requestedDate })}`;
  const todayPickItems = view.sections.today_pick.items;

  return renderPublicDocument({
    siteUrl,
    canonicalPath,
    seo,
    active: 'home',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: PUBLIC_SITE_BRAND_NAME,
        url: `${siteUrl}/`,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: seo.title,
        description: seo.description,
        url: `${siteUrl}${canonicalPath}`,
        mainEntity: buildItemList(siteUrl, todayPickItems),
      },
    ],
    initialData: {
      kind: 'home',
      params: { date: requestedDate ?? null },
      payload: view,
    },
    body: `
      <main class="page-main">
        <section class="hero">
          <div class="eyebrow">今日推荐</div>
          <h1>机场榜：机场 VPN 推荐与可靠性榜单</h1>
          <p>${escapeHtml(seo.description)}</p>
          <div class="metric-grid">
            ${renderMetric('监测机场', `${formatNumber(view.hero.monitored_airports)}+`)}
            ${renderMetric('实时测速', `${formatNumber(view.hero.realtime_tests)}+`)}
            ${renderMetric('数据日期', view.date)}
            ${renderMetric('更新时间', view.hero.report_time_text)}
          </div>
        </section>
        ${renderHomeSections(view)}
      </main>
    `,
  });
}

export function renderFullRankingPublicPage(
  siteUrl: string,
  view: FullRankingView,
  requestedDate: string | undefined,
  requestedPage: number,
): string {
  const page = view.page || requestedPage || 1;
  const seo = buildFullRankingSeo({ dateLabel: view.date, total: view.total });
  const canonicalPath = `${PUBLIC_SEO_PATHS.fullRanking}${buildQuery({
    date: requestedDate,
    page: page > 1 ? page : undefined,
  })}`;

  return renderPublicDocument({
    siteUrl,
    canonicalPath,
    seo,
    active: 'rankings',
    jsonLd: [
      buildCollectionPageJsonLd(siteUrl, canonicalPath, seo),
      buildBreadcrumbJsonLd(siteUrl, [
        ['今日推荐', '/'],
        ['全量榜单', canonicalPath],
      ]),
      buildRankingItemList(siteUrl, view.items),
    ],
    initialData: {
      kind: 'full_ranking',
      params: {
        date: requestedDate ?? null,
        page,
      },
      payload: view,
    },
    body: `
      <main class="page-main">
        <section class="hero hero-dark">
          <div class="eyebrow">全量榜单</div>
          <h1>全量机场榜单</h1>
          <p>全部已上线机场按公开展示分数降序排列，原始 HTML 直接包含排名、分数、状态、官网和测评报告入口。</p>
          <div class="metric-grid">
            ${renderMetric('收录机场', formatNumber(view.total))}
            ${renderMetric('当前分页', `${view.page}/${view.total_pages}`)}
            ${renderMetric('默认页容量', String(view.page_size))}
            ${renderMetric('数据日期', view.date)}
          </div>
        </section>
        ${renderRankingTable(view.items)}
      </main>
    `,
  });
}

export function renderRiskMonitorPublicPage(
  siteUrl: string,
  view: RiskMonitorView,
  requestedDate: string | undefined,
  requestedPage: number,
): string {
  const page = view.page || requestedPage || 1;
  const seo = buildRiskMonitorSeo({ dateLabel: view.date, total: view.total });
  const canonicalPath = `${PUBLIC_SEO_PATHS.riskMonitor}${buildQuery({
    date: requestedDate,
    page: page > 1 ? page : undefined,
  })}`;

  return renderPublicDocument({
    siteUrl,
    canonicalPath,
    seo,
    active: 'risk',
    jsonLd: [
      buildCollectionPageJsonLd(siteUrl, canonicalPath, seo),
      buildBreadcrumbJsonLd(siteUrl, [
        ['今日推荐', '/'],
        ['跑路监测', canonicalPath],
      ]),
      buildRankingItemList(siteUrl, view.items),
    ],
    initialData: {
      kind: 'risk_monitor',
      params: {
        date: requestedDate ?? null,
        page,
      },
      payload: view,
    },
    body: `
      <main class="page-main">
        <section class="hero hero-risk">
          <div class="eyebrow">跑路监测</div>
          <h1>高风险机场监测列表</h1>
          <p>本页聚合管理员确认跑路与命中风险观察标签的机场，原始 HTML 直接暴露风险原因、状态和报告入口。</p>
          <div class="metric-grid">
            ${renderMetric('风险对象', formatNumber(view.total))}
            ${renderMetric('当前分页', `${view.page}/${view.total_pages}`)}
            ${renderMetric('默认页容量', String(view.page_size))}
            ${renderMetric('数据日期', view.date)}
          </div>
        </section>
        ${renderRiskTable(view.items)}
      </main>
    `,
  });
}

export function renderReportPublicPage(siteUrl: string, view: ReportView, requestedDate?: string): string {
  const seo = buildReportSeo({
    airportName: view.airport.name,
    score: view.summary_card.score,
    statusLabel: formatAirportStatusLabel(view.airport.status),
  });
  const canonicalPath = buildAirportReportPath(view.airport.slug);

  return renderPublicDocument({
    siteUrl,
    canonicalPath,
    seo,
    active: 'rankings',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: seo.title,
        description: seo.description,
        url: `${siteUrl}${canonicalPath}`,
      },
      buildBreadcrumbJsonLd(siteUrl, [
        ['今日推荐', '/'],
        [view.airport.name, canonicalPath],
      ]),
    ],
    body: `
      <main class="page-main">
        <section class="hero">
          <div class="eyebrow">机场测评报告</div>
          <h1>${escapeHtml(view.airport.name)} 测评报告</h1>
          <p>${escapeHtml(seo.description)}</p>
          <div class="metric-grid">
            ${renderMetric('公开分数', formatMetric(view.summary_card.score))}
            ${renderMetric('状态', formatAirportStatusLabel(view.airport.status))}
            ${renderMetric('数据日期', view.date)}
            ${renderMetric('稳定性', formatStabilityTier(view.metrics.stability_tier))}
          </div>
        </section>
        ${renderReportSummary(view)}
      </main>
    `,
  });
}

export function renderMethodologyPublicPage(siteUrl: string): string {
  return renderPublicDocument({
    siteUrl,
    canonicalPath: PUBLIC_SEO_PATHS.methodology,
    seo: METHODOLOGY_SEO,
    active: 'methodology',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        headline: METHODOLOGY_SEO.title,
        description: METHODOLOGY_SEO.description,
        about: ['机场测评方法', '机场测速标准', '机场评分规则', '风险扣分'],
      },
      buildBreadcrumbJsonLd(siteUrl, [
        ['今日推荐', '/'],
        ['测评方法', PUBLIC_SEO_PATHS.methodology],
      ]),
    ],
    body: `
      <main class="page-main">
        <section class="hero">
          <div class="eyebrow">测评方法</div>
          <h1>机场测评方法：评分规则、测速标准与风险扣分</h1>
          <p>${escapeHtml(METHODOLOGY_SEO.description)}</p>
          <div class="metric-grid">
            ${renderMetric('评分维度', '4')}
            ${renderMetric('稳定性权重', '40%')}
            ${renderMetric('性能权重', '30%')}
            ${renderMetric('价格 / 风险', '20% / 10%')}
          </div>
        </section>
        <section class="content-card">
          <h2>总公式</h2>
          <p>最终分 = 0.4 × 稳定性 S + 0.3 × 性能 P + 0.2 × 价格 C + 0.1 × 风险 R，并叠加时间衰减与风险扣分。</p>
          <div class="card-grid">
            ${renderInfoCard('稳定性 S', '看可用率、波动分档和连续健康天数，不让一次偶然测速决定全局。')}
            ${renderInfoCard('性能 P', '看中位延迟、下载速率和丢包，兼顾快与稳。')}
            ${renderInfoCard('价格 C', '看月付、试用和速度价格比，防止“便宜但不值”。')}
            ${renderInfoCard('风险 R', '看域名、SSL、投诉和历史异常，防止“快但危险”。')}
          </div>
        </section>
      </main>
    `,
  });
}

export function renderApplyPublicPage(siteUrl: string): string {
  return renderPublicDocument({
    siteUrl,
    canonicalPath: PUBLIC_SEO_PATHS.apply,
    seo: APPLY_SEO,
    active: 'apply',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: APPLY_SEO.title,
      description: APPLY_SEO.description,
      url: `${siteUrl}${PUBLIC_SEO_PATHS.apply}`,
    },
    body: `
      <main class="page-main">
        <section class="hero">
          <div class="eyebrow">申请入驻测试</div>
          <h1>申请入驻 GateRank 机场测试</h1>
          <p>${escapeHtml(APPLY_SEO.description)}提交后会创建个人后台账号，首次登录需要修改密码，完成支付后申请进入后台待审批列表。</p>
        </section>
        <section class="content-card">
          <h2>申请表单需要的信息</h2>
          <div class="card-grid">
            ${renderInfoCard('机场基础信息', '机场名称、官网地址、成立日期、月付价格、试用支持与简介。')}
            ${renderInfoCard('测试资料', '测试账号、测试密码和订阅地址，用于后续自动监测与人工复核。')}
            ${renderInfoCard('联系方式', '申请人邮箱和 Telegram，用于审核、支付与后续沟通。')}
          </div>
        </section>
      </main>
    `,
  });
}

export function renderPublicHtmlError(siteUrl: string, status: number, message: string): string {
  return renderPublicDocument({
    siteUrl,
    status,
    canonicalPath: '/',
    seo: {
      title: `${message} | ${PUBLIC_SITE_BRAND_NAME}`,
      description: `${PUBLIC_SITE_BRAND_NAME} 页面暂时无法显示，请返回首页或稍后再试。`,
      keywords: '机场榜GateRank,GateRank',
    },
    active: 'home',
    jsonLd: {},
    body: `
      <main class="page-main">
        <section class="hero">
          <div class="eyebrow">Error ${status}</div>
          <h1>${escapeHtml(message)}</h1>
          <p>请返回 <a href="/">GateRank 首页</a>，或稍后再试。</p>
        </section>
      </main>
    `,
  });
}

function renderPublicDocument(options: RenderOptions): string {
  const canonicalUrl = `${options.siteUrl}${options.canonicalPath}`;
  const initialDataScript = options.initialData
    ? `\n    <script id="__GATERANK_INITIAL_DATA__" type="application/json">${escapeJsonScript(options.initialData)}</script>`
    : '';
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(options.seo.title)}</title>
    <meta name="description" content="${escapeAttribute(options.seo.description)}" />
    <meta name="keywords" content="${escapeAttribute(options.seo.keywords)}" />
    <meta name="robots" content="index,follow,max-image-preview:large" />
    <link rel="canonical" href="${escapeAttribute(canonicalUrl)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapeAttribute(PUBLIC_SITE_BRAND_NAME)}" />
    <meta property="og:title" content="${escapeAttribute(options.seo.title)}" />
    <meta property="og:description" content="${escapeAttribute(options.seo.description)}" />
    <meta property="og:url" content="${escapeAttribute(canonicalUrl)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttribute(options.seo.title)}" />
    <meta name="twitter:description" content="${escapeAttribute(options.seo.description)}" />
    <link rel="stylesheet" href="${PUBLIC_FRONTEND_ASSETS.stylesheet}" />
    <style>${styles}</style>
    <script type="application/ld+json">${JSON.stringify(options.jsonLd)}</script>
  </head>
  <body>
    <div id="root">
      <div class="page-shell">
        ${renderTopbar(options.active)}
        ${options.body}
        ${renderFooter()}
      </div>
    </div>
    ${initialDataScript}
    <script type="module" src="${PUBLIC_FRONTEND_ASSETS.script}"></script>
  </body>
</html>`;
}

function renderTopbar(active: RenderOptions['active']): string {
  return `
    <header class="topbar">
      <a class="brand" href="/">${escapeHtml(PUBLIC_SITE_BRAND_NAME)}</a>
      <nav>
        <a class="${active === 'home' ? 'active' : ''}" href="/">今日推荐</a>
        <a class="${active === 'rankings' ? 'active' : ''}" href="/rankings/all">全量榜单</a>
        <a class="${active === 'risk' ? 'active' : ''}" href="/risk-monitor">跑路监测</a>
        <a class="${active === 'methodology' ? 'active' : ''}" href="/methodology">测评方法</a>
        <a href="/news">News</a>
        <a class="apply-link ${active === 'apply' ? 'active' : ''}" href="/apply">申请入驻</a>
      </nav>
    </header>
  `;
}

function renderFooter(): string {
  return `
    <footer class="footer">
      <strong>${escapeHtml(PUBLIC_SITE_BRAND_NAME)}</strong>
      <p>以公开监测数据、评分趋势和风险记录构建机场推荐体系。</p>
    </footer>
  `;
}

function renderHomeSections(view: HomePageView): string {
  return Object.entries(view.sections)
    .filter(([, section]) => section.items.length > 0)
    .map(([, section]) => `
      <section class="content-card">
        <div class="eyebrow">${escapeHtml(section.subtitle)}</div>
        <h2>${escapeHtml(section.title)}</h2>
        <div class="card-grid">
          ${section.items.map((item) => renderAirportCard(item)).join('')}
        </div>
      </section>
    `)
    .join('');
}

function renderAirportCard(item: {
  name: string;
  score: number;
  tags: string[];
  details: Array<{ label: string; value: string }>;
  conclusion: string;
  report_url?: string | null;
}): string {
  const href = item.report_url || '#';
  return `
    <article class="mini-card">
      <h3><a href="${escapeAttribute(href)}">${escapeHtml(item.name)}</a></h3>
      <div class="score">${formatMetric(item.score)}</div>
      <p>${escapeHtml(item.conclusion)}</p>
      <p class="muted">${item.tags.map(escapeHtml).join(' / ')}</p>
      <p class="muted">${item.details.map((detail) => `${escapeHtml(detail.label)}：${escapeHtml(detail.value)}`).join('；')}</p>
    </article>
  `;
}

function renderRankingTable(items: FullRankingItem[]): string {
  return `
    <section class="content-card">
      <h2>全量榜单列表</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>排名</th><th>机场</th><th>状态</th><th>分数</th><th>月付</th><th>报告</th></tr></thead>
          <tbody>
            ${items.map((item) => `
              <tr>
                <td>#${item.rank}</td>
                <td><a href="${escapeAttribute(item.website)}" rel="nofollow noreferrer">${escapeHtml(item.name)}</a></td>
                <td>${escapeHtml(formatAirportStatusLabel(item.status))}</td>
                <td>${item.score === null ? '-' : formatMetric(item.score)}</td>
                <td>¥${formatMetric(item.plan_price_month)}</td>
                <td>${item.report_url ? `<a href="${escapeAttribute(item.report_url)}">测评报告</a>` : '暂无报告'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderRiskTable(items: RiskMonitorItem[]): string {
  return `
    <section class="content-card">
      <h2>风险监测列表</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>排序</th><th>机场</th><th>状态</th><th>原因</th><th>风险扣分</th><th>报告</th></tr></thead>
          <tbody>
            ${items.map((item) => `
              <tr>
                <td>#${item.rank}</td>
                <td>${escapeHtml(item.name)}</td>
                <td>${escapeHtml(formatAirportStatusLabel(item.status))}</td>
                <td>${escapeHtml(item.risk_reason_summary || formatMonitorReason(item.monitor_reason))}</td>
                <td>${item.risk_penalty === null ? '-' : formatMetric(item.risk_penalty)}</td>
                <td>${item.report_url ? `<a href="${escapeAttribute(item.report_url)}">测评报告</a>` : '暂无报告'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderReportSummary(view: ReportView): string {
  return `
    <section class="content-card">
      <h2>榜单位置</h2>
      <div class="card-grid">
        ${renderInfoCard('今日推荐', formatRank(view.ranking.today_pick_rank))}
        ${renderInfoCard('长期稳定', formatRank(view.ranking.most_stable_rank))}
        ${renderInfoCard('性价比', formatRank(view.ranking.best_value_rank))}
        ${renderInfoCard('新入榜', formatRank(view.ranking.new_entries_rank))}
      </div>
    </section>
    <section class="content-card">
      <h2>评分拆解</h2>
      <div class="card-grid">
        ${renderInfoCard('稳定性 S', formatMetric(view.score_breakdown.s))}
        ${renderInfoCard('性能 P', formatMetric(view.score_breakdown.p))}
        ${renderInfoCard('价格 C', formatMetric(view.score_breakdown.c))}
        ${renderInfoCard('风险 R', formatMetric(view.score_breakdown.r))}
        ${renderInfoCard('最终分', formatMetric(view.score_breakdown.final_score))}
        ${renderInfoCard('风险惩罚', formatMetric(view.score_breakdown.risk_penalty))}
      </div>
    </section>
    <section class="content-card">
      <h2>关键指标</h2>
      <div class="card-grid">
        ${renderInfoCard('30 天可用率', `${formatMetric(view.metrics.uptime_percent_30d)}%`)}
        ${renderInfoCard('中位延迟', `${formatMetric(view.metrics.median_latency_ms)} ms`)}
        ${renderInfoCard('下载速率', `${formatMetric(view.metrics.median_download_mbps)} Mbps`)}
        ${renderInfoCard('丢包率', `${formatMetric(view.metrics.packet_loss_percent)}%`)}
      </div>
    </section>
  `;
}

function renderInfoCard(title: string, body: string): string {
  return `
    <article class="mini-card">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(body)}</p>
    </article>
  `;
}

function renderMetric(label: string, value: string): string {
  return `
    <div class="metric">
      <div>${escapeHtml(label)}</div>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function buildCollectionPageJsonLd(siteUrl: string, canonicalPath: string, seo: PublicSeoText): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: seo.title,
    description: seo.description,
    url: `${siteUrl}${canonicalPath}`,
  };
}

function buildBreadcrumbJsonLd(siteUrl: string, items: Array<[string, string]>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name,
      item: `${siteUrl}${path}`,
    })),
  };
}

function buildItemList(
  siteUrl: string,
  items: Array<{ name: string; report_url?: string | null }>,
): Record<string, unknown> {
  return {
    '@type': 'ItemList',
    itemListElement: items
      .filter((item) => Boolean(item.report_url))
      .map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        url: `${siteUrl}${item.report_url}`,
      })),
  };
}

function buildRankingItemList(
  siteUrl: string,
  items: Array<{ rank: number; name: string; report_url?: string | null }>,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    numberOfItems: items.filter((item) => Boolean(item.report_url)).length,
    itemListElement: items
      .filter((item) => Boolean(item.report_url))
      .map((item) => ({
        '@type': 'ListItem',
        position: item.rank,
        name: item.name,
        url: `${siteUrl}${item.report_url}`,
      })),
  };
}

function formatRank(value: number | null): string {
  return value === null ? '未入榜' : `#${value}`;
}

function formatMonitorReason(reason: RiskMonitorItem['monitor_reason']): string {
  return reason === 'down' ? '管理员确认跑路' : '风险观察';
}

function formatStabilityTier(value: string): string {
  if (value === 'stable') return '稳定';
  if (value === 'minor_fluctuation') return '轻微波动';
  if (value === 'volatile') return '异常波动';
  return value;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

function escapeJsonScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

const styles = `
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif; color: #111; background: #fff; }
  a { color: inherit; }
  .page-shell { min-height: 100vh; display: flex; flex-direction: column; }
  .topbar { min-height: 72px; display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 0 24px; border-bottom: 1px solid #eee; background: rgba(255,255,255,.92); position: sticky; top: 0; z-index: 10; }
  .brand { font-weight: 900; text-decoration: none; }
  .topbar nav { display: flex; flex-wrap: wrap; gap: 10px; font-size: 13px; font-weight: 900; }
  .topbar nav a { padding: 8px 12px; border-radius: 999px; text-decoration: none; color: #666; }
  .topbar nav a:hover { background: #f5f5f5; color: #111; }
  .topbar nav a.active { background: #fff1f2; color: #e11d48; box-shadow: inset 0 0 0 1px #ffe4e6; }
  .topbar nav a.apply-link { background: #111111; color: #fff; -webkit-text-fill-color: #fff; forced-color-adjust: none; color-scheme: light; box-shadow: 0 14px 32px rgba(17,17,17,.18); }
  .topbar nav a.apply-link:hover { background: #262626; color: #fff; -webkit-text-fill-color: #fff; }
  .topbar nav a.apply-link.active { background: #111111; color: #fff; -webkit-text-fill-color: #fff; box-shadow: 0 14px 32px rgba(17,17,17,.18); }
  .page-main { width: min(1180px, calc(100vw - 32px)); margin: 0 auto; padding: 40px 0 72px; display: grid; gap: 32px; }
  .hero { border: 1px solid #e5e5e5; border-radius: 28px; padding: 32px; background: linear-gradient(135deg, #fafafa, #fff); }
  .hero-dark { background: linear-gradient(135deg, #111827, #f8fafc); color: #fff; }
  .hero-risk { background: linear-gradient(135deg, #3f0f19, #f7f2f4); color: #fff; }
  .eyebrow { font-size: 12px; letter-spacing: .18em; text-transform: uppercase; font-weight: 900; color: #777; }
  .hero-dark .eyebrow, .hero-risk .eyebrow { color: rgba(255,255,255,.74); }
  h1 { margin: 16px 0 0; font-size: clamp(36px, 7vw, 64px); line-height: .96; letter-spacing: -0.02em; }
  h2 { margin: 0 0 16px; font-size: 28px; }
  h3 { margin: 0 0 10px; font-size: 18px; }
  p { line-height: 1.8; }
  .hero p { max-width: 820px; font-size: 16px; }
  .metric-grid, .card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-top: 24px; }
  .metric, .mini-card { border: 1px solid #e5e5e5; border-radius: 18px; padding: 18px; background: rgba(255,255,255,.86); color: #111; }
  .metric div, .muted { color: #666; font-size: 13px; }
  .metric strong, .score { display: block; margin-top: 8px; font-size: 28px; font-weight: 900; }
  .content-card { border: 1px solid #e5e5e5; border-radius: 24px; padding: 26px; background: #fff; }
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; border-bottom: 1px solid #eee; padding: 14px 10px; vertical-align: top; }
  th { font-size: 12px; text-transform: uppercase; letter-spacing: .12em; color: #666; }
  .footer { margin-top: auto; border-top: 1px solid #eee; padding: 32px 24px; text-align: center; color: #666; }
`;
