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
  buildReportFaqItems,
  buildReportSeo,
  buildReportStructuredData,
  buildRiskMonitorSeo,
  formatAirportStatusLabel,
  formatMetric,
  type PublicSeoText,
} from '../../../shared/publicSeo';
import { PUBLIC_SITE_BRAND_NAME } from '../../../shared/publicBrand';
import { getCapabilityIcon, type CapabilityIconCategory, type CapabilityIconData } from '../../../shared/capabilityIcons';

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
          <h1>机场排行榜：全量机场 VPN 评分排名</h1>
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
          <h1>跑路机场监测：高风险机场名单与机场跑路预警</h1>
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
  const seo = buildReportSeo(view);
  const canonicalPath = buildAirportReportPath(view.airport.slug);
  const faqItems = buildReportFaqItems(view);

  return renderPublicDocument({
    siteUrl,
    canonicalPath,
    seo,
    active: 'rankings',
    jsonLd: buildReportStructuredData(siteUrl, canonicalPath, seo, view),
    body: `
      <main class="page-main report-page">
        <section class="report-hero">
          <div class="report-hero-copy">
            <div class="breadcrumb">首页 / 机场专题 / ${escapeHtml(view.airport.name)}</div>
            <h1>${escapeHtml(view.airport.name)} 测评报告</h1>
            <p>${escapeHtml(seo.description)}</p>
            <div class="report-tags">
              ${view.airport.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}
              <span>${escapeHtml(formatAirportStatusLabel(view.airport.status))}</span>
              <span>${escapeHtml(view.capabilities.plan.has_trial_plan ? '免费试用' : '试用未收录')}</span>
            </div>
            <p><a class="primary-link" href="${escapeAttribute(view.airport.website)}" rel="nofollow noreferrer">访问官网</a></p>
          </div>
          <aside class="score-card">
            <div class="score-title">GateRank Score</div>
            <div class="score-number">${escapeHtml(formatMetric(view.summary_card.score))}<span>/100</span></div>
            <div class="score-bar"><i style="width:${Math.max(0, Math.min(100, view.summary_card.score))}%"></i></div>
            <div class="score-grade">综合评级：${escapeHtml(formatScoreGrade(view.summary_card.score))}</div>
          </aside>
        </section>
        <section class="report-snapshot">
          ${renderSnapshotCard('状态', formatAirportStatusLabel(view.airport.status))}
          ${renderSnapshotCard('数据日期', view.date)}
          ${renderSnapshotCard('健康记录', `${view.metrics.healthy_days_streak} 天`)}
          ${renderSnapshotCard('稳定性', formatStabilityTier(view.metrics.stability_tier))}
          ${renderSnapshotCard('风险惩罚', formatMetric(view.score_breakdown.risk_penalty))}
        </section>
        <section class="pro-banner">
          <div>
            <div class="eyebrow">广告</div>
            <h2>GateRank Pro 数据看板</h2>
            <p>更全面的数据洞察、更智能的机场评估，适合需要持续观察转化与测速表现的机场团队。</p>
          </div>
          <a href="/apply">立即体验 Pro</a>
        </section>
        ${renderReportSummary(view)}
        ${renderReportFaq(faqItems)}
      </main>
    `,
  });
}

function renderSnapshotCard(label: string, value: string): string {
  return `
    <article class="snapshot-card">
      <div>${escapeHtml(label)}</div>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function renderReportSummary(view: ReportView): string {
  return `
    <section class="report-section">
      <h2>服务能力详情</h2>
      <div class="capability-grid">
        ${renderCapabilityGroup('解锁能力', view.capabilities.streaming, 'streaming')}
        ${renderCapabilityGroup('支付方式', view.capabilities.payment_methods, 'payment')}
        ${renderCapabilityGroup('售后支持', view.capabilities.telegram.items, 'support', renderTelegramFootnote(view))}
        ${renderRegionGroup(view)}
        ${renderCapabilityGroup('客户端支持', view.capabilities.clients, 'client')}
        ${renderCapabilityGroup('新手引导', view.capabilities.import_methods, 'import')}
      </div>
    </section>
    <section class="report-section">
      <h2>评分拆解</h2>
      <div class="score-grid">
        ${renderScoreMetric('稳定性 (S)', view.score_breakdown.s, 'emerald')}
        ${renderScoreMetric('性能 (P)', view.score_breakdown.p, 'blue')}
        ${renderScoreMetric('价格 (C)', view.score_breakdown.c, 'orange')}
        ${renderScoreMetric('风险 (R)', view.score_breakdown.r, 'purple')}
        ${renderScoreMetric('最终分', view.score_breakdown.final_score, 'emerald')}
        ${renderScoreMetric('风险惩罚', view.score_breakdown.risk_penalty, 'slate')}
      </div>
    </section>
    <section class="report-section">
      <h2>核心监测指标</h2>
      <div class="metric-grid">
        ${renderInfoCard('30 天可用率', `${formatMetric(view.metrics.uptime_percent_30d)}%`)}
        ${renderInfoCard('中位延迟', `${formatMetric(view.metrics.median_latency_ms)} ms`)}
        ${renderInfoCard('下载速率', `${formatMetric(view.metrics.median_download_mbps)} Mbps`)}
        ${renderInfoCard('丢包率', `${formatMetric(view.metrics.packet_loss_percent)}%`)}
      </div>
    </section>
    <section class="report-section">
      <h2>30 天趋势</h2>
      <div class="metric-grid">
        ${renderInfoCard('评分趋势', buildTrendSummary(view.trends.score_30d, '分'))}
        ${renderInfoCard('可用率趋势', buildTrendSummary(view.trends.uptime_30d, '%'))}
        ${renderInfoCard('延迟趋势', buildTrendSummary(view.trends.latency_30d, ' ms'))}
        ${renderInfoCard('下载趋势', buildTrendSummary(view.trends.download_30d, ' Mbps'))}
      </div>
    </section>
    <section class="report-section">
      <h2>导入与配置</h2>
      <div class="metric-grid">
        ${renderInfoCard('一键导入', hasCapability(view.capabilities.import_methods, 'one_click_import') ? '支持' : '未收录')}
        ${renderInfoCard('订阅链接', hasCapability(view.capabilities.import_methods, 'subscription_link') ? '支持' : '未收录')}
        ${renderInfoCard('教程支持', hasCapability(view.capabilities.import_methods, 'tutorials') ? '支持' : '未收录')}
        ${renderInfoCard('客户端数量', `${view.capabilities.clients.length} 个`)}
        ${renderInfoCard('地区覆盖', `${view.capabilities.regions.length} 个`)}
        ${renderInfoCard('年付套餐', view.capabilities.plan.supports_annual ? '支持' : '未收录')}
      </div>
    </section>
    <section class="report-section report-conclusion">
      <h2>结论与建议</h2>
      <p>本次评测数据显示 ${escapeHtml(view.airport.name)} 当前综合分为 ${escapeHtml(formatMetric(view.summary_card.score))} / 100，状态为 ${escapeHtml(formatAirportStatusLabel(view.airport.status))}，稳定性评级为 ${escapeHtml(formatStabilityTier(view.metrics.stability_tier))}。${escapeHtml(view.summary_card.conclusion)}</p>
    </section>
  `;
}

function renderCapabilityGroup(
  title: string,
  items: Array<{ key: string; label: string }>,
  category: CapabilityIconCategory,
  footnote?: string | null,
): string {
  return `
    <article class="capability-card">
      <h3>${escapeHtml(title)}</h3>
      <div class="capability-list">
        ${items.length > 0 ? items.map((item) => renderCapabilityLine(item, category)).join('') : '<p class="muted">未收录</p>'}
      </div>
      ${footnote ? `<div class="capability-footnote">${escapeHtml(footnote)}</div>` : ''}
    </article>
  `;
}

function renderCapabilityIcon(icon: CapabilityIconData): string {
  const style = `background-color:${escapeAttribute(icon.bg)};border-color:${escapeAttribute(icon.border)};color:${escapeAttribute(icon.color)}`;
  if (icon.kind === 'svg') {
    return `<span class="capability-icon" style="${style}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor" focusable="false"><path d="${escapeAttribute(icon.path)}"></path></svg></span>`;
  }
  return `<span class="capability-icon" style="${style}" aria-hidden="true">${escapeHtml(icon.mark)}</span>`;
}

function renderCapabilityLine(
  item: { key: string; label: string },
  category: CapabilityIconCategory,
  displayLabel = item.label,
): string {
  const icon = getCapabilityIcon(item.key, category);
  return `
    <p>
      <span class="capability-entry">
        ${renderCapabilityIcon(icon)}
        <span class="capability-label">${escapeHtml(displayLabel)}</span>
      </span>
      <span class="capability-check">✓</span>
    </p>
  `;
}

function renderRegionGroup(view: ReportView): string {
  const regions = view.capabilities.regions.slice(0, 5);
  return `
    <article class="capability-card">
      <h3>节点覆盖</h3>
      <div class="capability-list">
        ${regions.length > 0
          ? regions.map((region) => renderCapabilityLine(region, 'region', `${region.label}${region.line_types.length > 0 ? ` · ${region.line_types.join('/')}` : ''}`)).join('')
          : '<p class="muted">未收录</p>'}
      </div>
      ${view.capabilities.regions.length > 5 ? `<div class="capability-footnote">另有 ${view.capabilities.regions.length - 5} 个地区</div>` : ''}
    </article>
  `;
}

function renderScoreMetric(label: string, value: number, tone: string): string {
  return `
    <article class="score-metric ${escapeAttribute(tone)}">
      <div>${escapeHtml(label)}</div>
      <strong>${escapeHtml(formatMetric(value))}</strong>
      <i style="width:${Math.max(0, Math.min(100, value))}%"></i>
    </article>
  `;
}

function renderTelegramFootnote(view: ReportView): string | null {
  const { group_member_count, recent_active_at } = view.capabilities.telegram;
  if (group_member_count && recent_active_at) {
    return `${formatNumber(group_member_count)} 人 · ${recent_active_at}`;
  }
  if (group_member_count) {
    return `${formatNumber(group_member_count)} 人`;
  }
  return recent_active_at;
}

function hasCapability(items: Array<{ key: string }>, key: string): boolean {
  return items.some((item) => item.key === key);
}

function formatScoreGrade(score: number): string {
  if (score >= 85) return '优秀';
  if (score >= 75) return '良好';
  if (score >= 60) return '观察';
  return '高风险';
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

function renderInfoCard(title: string, body: string): string {
  return `
    <article class="mini-card">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(body)}</p>
    </article>
  `;
}

function renderReportFaq(items: Array<{ question: string; answer: string }>): string {
  return `
    <section class="content-card">
      <h2>常见问题</h2>
      <div class="card-grid">
        ${items.map((item) => `
          <article class="mini-card">
            <h3>${escapeHtml(item.question)}</h3>
            <p>${escapeHtml(item.answer)}</p>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function buildTrendSummary(points: Array<{ date: string; value: number }>, suffix: string): string {
  if (points.length === 0) {
    return '暂无 30 天趋势数据';
  }
  const first = points[0];
  const latest = points[points.length - 1];
  return `${first.date} 为 ${formatMetric(first.value)}${suffix}，${latest.date} 为 ${formatMetric(latest.value)}${suffix}，共 ${points.length} 个数据点。`;
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
  .report-page { width: min(1180px, calc(100vw - 32px)); }
  .report-hero { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 24px; align-items: start; border: 1px solid #dbe4f0; border-radius: 8px; padding: 32px; background: linear-gradient(135deg, #f8fbff, #fff 54%, #eef6ff); }
  .breadcrumb { margin-bottom: 18px; color: #64748b; font-size: 13px; font-weight: 700; }
  .report-hero h1 { margin: 0; font-size: clamp(32px, 5vw, 48px); line-height: 1.08; letter-spacing: 0; }
  .report-hero p { color: #475569; }
  .report-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
  .report-tags span { border: 1px solid #dbeafe; border-radius: 999px; padding: 6px 10px; background: #eff6ff; color: #1d4ed8; font-size: 12px; font-weight: 900; }
  .primary-link { display: inline-flex; margin-top: 8px; min-height: 42px; align-items: center; border-radius: 8px; background: #020617; color: #fff; padding: 0 18px; text-decoration: none; font-weight: 900; }
  .score-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 28px; background: #fff; text-align: center; box-shadow: 0 10px 30px rgba(15, 23, 42, .06); }
  .score-title { color: #1e293b; font-size: 14px; font-weight: 900; }
  .score-number { margin-top: 12px; color: #020617; font-size: 58px; line-height: 1; font-weight: 900; }
  .score-number span { margin-left: 6px; color: #64748b; font-size: 14px; }
  .score-bar { height: 8px; margin-top: 20px; overflow: hidden; border-radius: 999px; background: #e2e8f0; }
  .score-bar i { display: block; height: 100%; border-radius: 999px; background: #22c55e; }
  .score-grade { margin-top: 14px; color: #059669; font-size: 14px; font-weight: 900; }
  .report-snapshot { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
  .snapshot-card, .capability-card, .score-metric, .report-section, .pro-banner { border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; }
  .snapshot-card { min-height: 88px; padding: 18px; }
  .snapshot-card div { color: #64748b; font-size: 13px; font-weight: 700; }
  .snapshot-card strong { display: block; margin-top: 8px; color: #020617; font-size: 18px; font-weight: 900; }
  .pro-banner { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 24px; align-items: end; padding: 28px; background: linear-gradient(115deg, #fff, #eef6ff 58%, #dbeafe); }
  .pro-banner h2 { margin: 8px 0 0; color: #020617; }
  .pro-banner a { display: inline-flex; min-height: 42px; align-items: center; border-radius: 8px; background: #2563eb; color: #fff; padding: 0 18px; text-decoration: none; font-weight: 900; }
  .report-section { padding: 24px; }
  .report-section h2 { margin-bottom: 18px; color: #020617; font-size: 22px; letter-spacing: 0; }
  .capability-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; }
  .capability-card { padding: 16px; }
  .capability-card h3 { color: #020617; font-size: 15px; }
  .capability-list { display: grid; gap: 8px; }
  .capability-list p { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0; border-radius: 8px; background: #f8fafc; padding: 8px 10px; color: #334155; font-size: 14px; font-weight: 700; line-height: 1.4; }
  .capability-entry { display: flex; min-width: 0; align-items: center; gap: 8px; }
  .capability-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .capability-icon { display: inline-flex; width: 28px; height: 28px; flex: 0 0 28px; align-items: center; justify-content: center; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-weight: 900; line-height: 1; }
  .capability-icon svg { width: 17px; height: 17px; }
  .capability-check { flex: 0 0 auto; color: #10b981; }
  .capability-footnote { margin-top: 10px; color: #94a3b8; font-size: 12px; font-weight: 800; }
  .score-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; }
  .score-metric { padding: 16px; }
  .score-metric div { color: #64748b; font-size: 13px; font-weight: 700; }
  .score-metric strong { display: block; margin-top: 8px; color: #020617; font-size: 26px; font-weight: 900; }
  .score-metric i { display: block; height: 6px; margin-top: 12px; border-radius: 999px; background: #22c55e; }
  .score-metric.blue i { background: #3b82f6; }
  .score-metric.orange i { background: #f97316; }
  .score-metric.purple i { background: #a855f7; }
  .score-metric.slate i { background: #94a3b8; }
  .report-conclusion p { color: #475569; }
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; border-bottom: 1px solid #eee; padding: 14px 10px; vertical-align: top; }
  th { font-size: 12px; text-transform: uppercase; letter-spacing: .12em; color: #666; }
  @media (max-width: 900px) {
    .report-hero, .pro-banner { grid-template-columns: 1fr; padding: 22px; }
    .report-snapshot, .capability-grid, .score-grid { grid-template-columns: 1fr; }
    .score-card { padding: 22px; }
  }
  .footer { margin-top: auto; border-top: 1px solid #eee; padding: 32px 24px; text-align: center; color: #666; }
`;
