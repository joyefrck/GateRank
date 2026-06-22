import type {
  FullRankingItem,
  FullRankingView,
  HomePageView,
  ReportView,
  RiskMonitorItem,
  RiskMonitorView,
} from '../types/domain';
import type { PublicSummaryData } from './machineReadableRenderer';
import {
  APPLY_SEO,
  DEALS_CONTENT_SECTIONS,
  DEALS_FAQ_ITEMS,
  METHODOLOGY_SEO,
  PUBLIC_SEO_PATHS,
  buildDealsStructuredData,
  buildFullRankingHeading,
  buildFullRankingSeo,
  buildDealsSeo,
  buildHomeSeo,
  buildQuery,
  buildAirportReportPath,
  buildReportComparisonLinks,
  buildReportContentSections,
  buildReportContentSummary,
  buildReportFaqItems,
  buildReportSeo,
  buildReportStructuredData,
  buildReportTrendLabel,
  buildRiskMonitorSeo,
  formatAirportStatusLabel,
  formatMetric,
  type PublicSeoText,
} from '../../../shared/publicSeo';
import type { AirportDealView } from '../../../shared/airportAds';
import { PUBLIC_SITE_BRAND_NAME } from '../../../shared/publicBrand';
import {
  FALLBACK_PUBLIC_FRONTEND_ASSETS,
  type PublicFrontendAssets,
} from './frontendAssets';
import { getCapabilityIcon, type CapabilityIconCategory, type CapabilityIconData } from '../../../shared/capabilityIcons';
import {
  AIRPORT_CLIENT_FILTERS,
  AIRPORT_IMPORT_FILTERS,
  AIRPORT_LINE_FILTERS,
  AIRPORT_PAYMENT_FILTERS,
  AIRPORT_REGION_FILTERS,
  AIRPORT_STREAMING_FILTERS,
  getAirportFilterLabel,
  type AirportFilterCategory,
  type AirportFilterOption,
} from '../../../shared/airportFilterCatalog';
import {
  buildFullRankingPath,
  EMPTY_FULL_RANKING_FILTERS,
  getFullRankingSeoDecision,
  hasFullRankingFilters,
  type FullRankingFilters,
} from '../../../shared/fullRankingFilters';

interface RenderOptions {
  siteUrl: string;
  canonicalPath: string;
  seo: PublicSeoText;
  active: 'home' | 'rankings' | 'deals' | 'risk' | 'methodology' | 'apply' | 'forAi';
  jsonLd: unknown;
  body: string;
  status?: number;
  robots?: string;
  initialData?: PublicInitialData;
  frontendAssets?: PublicFrontendAssets;
}

interface PublicInitialData {
  kind: 'home' | 'full_ranking' | 'risk_monitor' | 'deals';
  params: {
    date?: string | null;
    page?: number | null;
    filters?: FullRankingFilters;
  };
  payload: unknown;
}

const reportAnchorSections = [
  { id: 'report-overview', label: '概览' },
  { id: 'report-content', label: '测评摘要' },
  { id: 'report-snapshot', label: '数据快照' },
  { id: 'report-capabilities', label: '服务能力' },
  { id: 'report-score', label: '评分拆解' },
  { id: 'report-metrics', label: '核心指标' },
  { id: 'report-trends', label: '趋势' },
  { id: 'report-plan-telegram', label: '套餐电报' },
  { id: 'report-conclusion', label: '结论建议' },
];

export function renderHomePublicPage(
  siteUrl: string,
  view: HomePageView,
  requestedDate?: string,
  frontendAssets?: PublicFrontendAssets,
): string {
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
    frontendAssets,
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
  filters: FullRankingFilters = view.filters || EMPTY_FULL_RANKING_FILTERS,
  frontendAssets?: PublicFrontendAssets,
): string {
  const page = view.page || requestedPage || 1;
  const seo = buildFullRankingSeo({ dateLabel: view.date, total: view.total, filters });
  const seoDecision = getFullRankingSeoDecision(filters, page);
  const canonicalPath = buildFullRankingPath(seoDecision.canonicalFilters, {
    date: requestedDate,
    page: hasFullRankingFilters(seoDecision.canonicalFilters) ? undefined : page,
  });
  const heading = buildFullRankingHeading(filters);

  return renderPublicDocument({
    siteUrl,
    canonicalPath,
    seo,
    robots: seoDecision.robots,
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
        filters,
      },
      payload: view,
    },
    frontendAssets,
    body: `
      <main class="page-main">
        <section class="hero hero-dark">
          <div class="eyebrow">全量榜单</div>
          <h1>${escapeHtml(heading)}</h1>
          <p>${escapeHtml(seo.description)}</p>
          <div class="metric-grid">
            ${renderMetric('收录机场', formatNumber(view.total))}
            ${renderMetric('当前分页', `${view.page}/${view.total_pages}`)}
            ${renderMetric('已选筛选', String(getSelectedFilterLabels(filters).length))}
            ${renderMetric('数据日期', view.date)}
          </div>
        </section>
        ${renderFullRankingFilters(filters)}
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
  frontendAssets?: PublicFrontendAssets,
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
    frontendAssets,
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

export function renderDealsPublicPage(
  siteUrl: string,
  deals: AirportDealView[],
  frontendAssets?: PublicFrontendAssets,
): string {
  const seo = buildDealsSeo({ activeDeals: deals.length });
  const canonicalPath = PUBLIC_SEO_PATHS.deals;
  return renderPublicDocument({
    siteUrl,
    canonicalPath,
    seo,
    active: 'deals',
    jsonLd: buildDealsStructuredData(siteUrl, deals, canonicalPath),
    initialData: {
      kind: 'deals',
      params: {},
      payload: { items: deals, total: deals.length },
    },
    frontendAssets,
    body: `
      <main class="page-main">
        <section class="hero">
          <div class="eyebrow">DEALS &amp; COUPONS</div>
          <h1>机场优惠码大全：活动折扣、免费试用与 USDT 支付优惠</h1>
          <p>${escapeHtml(seo.description)}</p>
          <div class="metric-grid">
            ${renderMetric('广告位', `${deals.length}/6`)}
            ${renderMetric('免费试用', `${deals.filter((deal) => deal.supports_trial).length}+`)}
            ${renderMetric('支持 USDT', `${deals.filter((deal) => deal.supports_usdt).length}+`)}
            ${renderMetric('更新频率', 'Daily Update')}
          </div>
        </section>
        <section class="content-card">
          <div class="eyebrow">重要说明</div>
          <h2>优惠信息不影响 GateRank Score</h2>
          <p class="muted">本页用于展示机场服务商投放的优惠活动与优惠码，不代表 GateRank 测评推荐。请结合测评报告、风险记录与自身需求独立判断。</p>
        </section>
        <section class="content-card">
          <h2>机场优惠卡片</h2>
          <div class="card-grid">
            ${deals.length > 0 ? deals.map(renderDealMiniCard).join('') : '<p class="muted">当前暂无上架广告活动。</p>'}
          </div>
        </section>
        ${renderDealsGuideSections()}
        ${renderDealsFaqSection()}
      </main>
    `,
  });
}

export function renderReportPublicPage(
  siteUrl: string,
  view: ReportView,
  requestedDate?: string,
  frontendAssets?: PublicFrontendAssets,
): string {
  const seo = buildReportSeo(view);
  const canonicalPath = buildAirportReportPath(view.airport.slug);
  const faqItems = buildReportFaqItems(view);

  return renderPublicDocument({
    siteUrl,
    canonicalPath,
    seo,
    active: 'rankings',
    jsonLd: buildReportStructuredData(siteUrl, canonicalPath, seo, view),
    frontendAssets,
    body: `
      <main id="report-top" class="page-main report-page">
        ${renderReportFixedNav()}
        <div class="report-date-status">
          <span>报告日期：${escapeHtml(view.date)}</span>
          ${view.resolved_from_fallback && view.fallback_notice ? `<span class="report-fallback-note">· ${escapeHtml(view.fallback_notice)}</span>` : ''}
        </div>
        <section id="report-overview" class="report-hero report-anchor-target">
          <div class="report-hero-copy">
            <div class="breadcrumb"><a href="/">首页</a><span>/</span>${escapeHtml(view.airport.name)}</div>
            <h1>${escapeHtml(buildReportPageHeading(view))}</h1>
            <p>${escapeHtml(seo.description)}</p>
            <div class="report-tags">
              ${view.airport.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}
              <span>${escapeHtml(formatAirportStatusLabel(view.airport.status))}</span>
              <span>${escapeHtml(view.capabilities.plan.has_trial_plan ? '免费试用' : '试用未收录')}</span>
            </div>
            <p><a class="primary-link" href="${escapeAttribute(normalizeExternalHref(view.airport.website))}" target="_blank" rel="nofollow noreferrer noopener">访问官网</a></p>
          </div>
          ${renderReportScoreCard(view)}
        </section>
        ${renderReportContentSections(view)}
        <section id="report-snapshot" class="report-snapshot report-anchor-target">
          ${renderSnapshotCard('状态', formatAirportStatusLabel(view.airport.status))}
          ${renderSnapshotCard('数据日期', view.date)}
          ${renderSnapshotCard('健康记录', `${view.metrics.healthy_days_streak} 天`)}
          ${renderSnapshotCard('稳定性', formatStabilityTier(view.metrics.stability_tier))}
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

function renderReportFixedNav(): string {
  return `
    <nav class="report-fixed-nav" aria-label="报告页面导航">
      ${reportAnchorSections.map((section) => `<a href="#${escapeAttribute(section.id)}">${escapeHtml(section.label)}</a>`).join('')}
    </nav>
  `;
}

function renderReportContentSections(view: ReportView): string {
  const sections = buildReportContentSections(view);
  const summary = buildReportContentSummary(view);
  return `
    <section id="report-content" class="report-section report-content report-anchor-target">
      <h2>${escapeHtml(view.airport.name)} 测评摘要</h2>
      <div class="report-content-summary">
        <p>${escapeHtml(summary.body)}</p>
        <div class="report-content-chips">
          ${summary.chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join('')}
        </div>
      </div>
      <div class="report-content-details">
        ${sections.map((section) => `
          <details class="report-content-detail">
            <summary>${escapeHtml(section.title)}</summary>
            <p>${escapeHtml(section.body)}</p>
            <div class="report-content-facts">
              ${section.facts.map((fact) => `<span>${escapeHtml(fact)}</span>`).join('')}
            </div>
          </details>
        `).join('')}
      </div>
      ${renderReportComparisonLinks(view)}
    </section>
  `;
}

function renderReportSummary(view: ReportView): string {
  return `
    <section id="report-capabilities" class="report-section report-anchor-target">
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
    <section id="report-score" class="report-section report-anchor-target">
      <h2>评分拆解</h2>
      <div class="score-grid">
        ${renderScoreMetric('稳定性 (S)', view.score_breakdown.s, 'emerald')}
        ${renderScoreMetric('性能 (P)', view.score_breakdown.p, 'blue')}
        ${renderScoreMetric('价格 (C)', view.score_breakdown.c, 'orange')}
        ${renderScoreMetric('风险 (R)', view.score_breakdown.r, 'purple')}
        ${renderScoreMetric('最终分', view.score_breakdown.final_score, 'emerald')}
      </div>
    </section>
    <section id="report-metrics" class="report-section report-anchor-target">
      <h2>核心监测指标</h2>
      <div class="metric-grid">
        ${renderInfoCard('30 天可用率', `${formatMetric(view.metrics.uptime_percent_30d)}%`)}
        ${renderInfoCard('中位延迟', `${formatMetric(view.metrics.median_latency_ms)} ms`)}
        ${renderInfoCard('下载速率', `${formatMetric(view.metrics.median_download_mbps)} Mbps`)}
        ${renderInfoCard('丢包率', `${formatMetric(view.metrics.packet_loss_percent)}%`)}
      </div>
    </section>
    <section id="report-trends" class="report-section report-anchor-target">
      <h2>${escapeHtml(buildReportTrendLabel(view))}</h2>
      <div class="metric-grid">
        ${renderInfoCard('评分趋势', view.summary_card.score_hidden ? '暂不公开' : buildTrendSummary(view.trends.score_30d, '分'))}
        ${renderInfoCard('可用率趋势', buildTrendSummary(view.trends.uptime_30d, '%'))}
        ${renderInfoCard('延迟趋势', buildTrendSummary(view.trends.latency_30d, ' ms'))}
        ${renderInfoCard('下载趋势', buildTrendSummary(view.trends.download_30d, ' Mbps'))}
      </div>
    </section>
    <section id="report-plan-telegram" class="report-section report-anchor-target">
      <div class="report-info-grid">
        ${renderReportInfoPanel('套餐信息', buildPlanInfoItems(view))}
        ${renderReportInfoPanel('电报信息', buildTelegramInfoItems(view))}
      </div>
    </section>
    <section id="report-conclusion" class="report-section report-conclusion report-anchor-target">
      <h2>结论与建议</h2>
      <p>本次评测数据显示 ${escapeHtml(view.airport.name)} 当前公开总分${escapeHtml(formatPublicScoreText(view))}，状态为 ${escapeHtml(formatAirportStatusLabel(view.airport.status))}，稳定性评级为 ${escapeHtml(formatStabilityTier(view.metrics.stability_tier))}。${escapeHtml(view.summary_card.conclusion)}</p>
    </section>
  `;
}

function buildReportPageHeading(view: ReportView): string {
  const searchName = view.airport.name.endsWith('机场') ? view.airport.name : `${view.airport.name}机场`;
  return `${searchName}测评：官网入口、稳定性、速度与跑路风险分析`;
}

function renderReportComparisonLinks(view: ReportView): string {
  const links = buildReportComparisonLinks(view);
  if (links.length === 0) {
    return '';
  }
  return `
    <div class="report-comparison-links">
      <h3>继续对比更多机场</h3>
      <div>
        ${links.map((link) => `<a href="${escapeAttribute(link.href)}">${escapeHtml(link.label)}</a>`).join('')}
      </div>
    </div>
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
          ? regions.map((region) => renderCapabilityLine(region, 'region', formatReportRegionLabel(region))).join('')
          : '<p class="muted">未收录</p>'}
      </div>
      ${view.capabilities.regions.length > 5 ? `<div class="capability-footnote">另有 ${view.capabilities.regions.length - 5} 个地区</div>` : ''}
    </article>
  `;
}

function formatReportRegionLabel(region: ReportView['capabilities']['regions'][number]): string {
  const parts = [region.label];
  if (region.node_count > 0) {
    parts.push(`${region.node_count} 节点`);
  }
  if (region.line_types.length > 0) {
    parts.push(region.line_types.join('/'));
  }
  return parts.join(' · ');
}

function renderReportScoreCard(view: ReportView): string {
  if (view.summary_card.score_hidden || view.summary_card.score === null) {
    return `
      <aside class="score-card">
        <div class="score-title">GateRank Score</div>
        <div class="score-number">暂不公开</div>
        <div class="score-grade">余额不足，公开总分暂不展示</div>
      </aside>
    `;
  }
  return `
    <aside class="score-card">
      <div class="score-title">GateRank Score</div>
      <div class="score-number">${escapeHtml(formatMetric(view.summary_card.score))}<span>/100</span></div>
      <div class="score-bar"><i style="width:${Math.max(0, Math.min(100, view.summary_card.score))}%"></i></div>
      <div class="score-grade">综合评级：${escapeHtml(formatScoreGrade(view.summary_card.score))}</div>
    </aside>
  `;
}

function renderScoreMetric(label: string, value: number | null, tone: string): string {
  const width = value === null ? 0 : Math.max(0, Math.min(100, value));
  return `
    <article class="score-metric ${escapeAttribute(tone)}">
      <div>${escapeHtml(label)}</div>
      <strong>${escapeHtml(value === null ? '暂不公开' : formatMetric(value))}</strong>
      <i style="width:${width}%"></i>
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

interface ReportInfoItem {
  label: string;
  value: string;
  href?: string | null;
}

function buildPlanInfoItems(view: ReportView): ReportInfoItem[] {
  const plan = view.capabilities.plan;
  return [
    { label: '月付套餐', value: formatNullableSupport(plan.supports_monthly) },
    { label: '季付套餐', value: formatNullableSupport(plan.supports_quarterly) },
    { label: '半年付套餐', value: formatNullableSupport(plan.supports_half_yearly) },
    { label: '年付套餐', value: formatNullableSupport(plan.supports_annual) },
    { label: '试用套餐', value: formatNullableSupport(plan.has_trial_plan) },
    { label: '不限时套餐', value: formatNullableSupport(plan.has_lifetime_plan) },
    { label: '最低月付价格', value: formatOptionalCurrency(plan.lowest_monthly_price) },
    { label: '最低年付折算月价', value: formatOptionalCurrency(plan.lowest_annual_monthly_price) },
  ];
}

function buildTelegramInfoItems(view: ReportView): ReportInfoItem[] {
  const telegram = view.capabilities.telegram;
  return [
    { label: 'Telegram 群', value: formatNullableSupport(telegram.has_group) },
    { label: 'Telegram 群链接', value: telegram.group_url || '未设置', href: telegram.group_url },
    { label: 'Telegram 频道', value: formatNullableSupport(telegram.has_channel) },
    { label: 'Telegram 频道链接', value: telegram.channel_url || '未设置', href: telegram.channel_url },
    { label: '群内发言权限', value: formatNullableSupport(telegram.group_allows_speaking) },
    { label: '客服 Bot', value: formatNullableSupport(telegram.has_customer_service_bot) },
    { label: '工单系统', value: formatNullableSupport(telegram.has_ticket_system) },
    { label: '群人数', value: telegram.group_member_count === null ? '未设置' : `${formatNumber(telegram.group_member_count)} 人` },
    { label: '最近活跃时间', value: telegram.recent_active_at || '未设置' },
  ];
}

function renderReportInfoPanel(title: string, items: ReportInfoItem[]): string {
  return `
    <article class="report-info-panel">
      <h2>${escapeHtml(title)}</h2>
      <dl>
        ${items.map((item) => `
          <div>
            <dt>${escapeHtml(item.label)}</dt>
            <dd>${item.href ? `<a href="${escapeAttribute(normalizeExternalHref(item.href))}" rel="nofollow noreferrer">${escapeHtml(item.value)}</a>` : escapeHtml(item.value)}</dd>
          </div>
        `).join('')}
      </dl>
    </article>
  `;
}

function formatNullableSupport(value: boolean | null | undefined): string {
  if (value === true) return '支持';
  if (value === false) return '不支持';
  return '未设置';
}

function formatOptionalCurrency(value: number | null | undefined): string {
  return value === null || value === undefined ? '未设置' : `¥${formatMetric(value)}`;
}

function normalizeExternalHref(value: string): string {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function formatPublicScoreText(view: ReportView): string {
  return view.summary_card.score_hidden || view.summary_card.score === null
    ? '暂不公开'
    : `${formatMetric(view.summary_card.score)} / 100`;
}

function formatScoreGrade(score: number): string {
  if (score >= 85) return '优秀';
  if (score >= 75) return '良好';
  if (score >= 60) return '观察';
  return '评级受限';
}

export function renderMethodologyPublicPage(siteUrl: string, frontendAssets?: PublicFrontendAssets): string {
  const methodologyFaq = [
    {
      question: '低价机场一定高分吗？',
      answer: '不会。价格只占总分 10%，并且 PriceScore 只按 1-30 元、30-50 元、50 元以上三档计算；如果稳定性、性能或风险表现较弱，低价不会单独决定推荐位置。',
    },
    {
      question: '测速快就一定推荐吗？',
      answer: '不会。性能占总分 30%，如果可用率、波动或风险项偏弱，最终分数仍会被拉低。',
    },
    {
      question: '为什么要保留历史分数？',
      answer: '时间衰减让近期表现优先，同时保留长期样本，避免一次短时故障或一次活动测速过度影响榜单。',
    },
    {
      question: '风险分低代表已经跑路了吗？',
      answer: '不一定。风险分用于提示域名、证书、投诉或历史异常等信任信号，需要结合状态和趋势继续观察。',
    },
  ];
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
        about: ['机场测评方法', '机场测速标准', '机场评分规则', '风险扣分', '时间衰减', '机场推荐依据'],
      },
      buildBreadcrumbJsonLd(siteUrl, [
        ['今日推荐', '/'],
        ['测评方法', PUBLIC_SEO_PATHS.methodology],
      ]),
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: methodologyFaq.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      },
    ],
    frontendAssets,
    body: `
      <main class="page-main">
        <section class="hero">
          <div class="eyebrow">测评方法</div>
          <h1>机场测评方法：评分规则、测速标准、风险扣分与推荐依据</h1>
          <p>${escapeHtml(METHODOLOGY_SEO.description)}</p>
          <div class="metric-grid">
            ${renderMetric('评分维度', '4')}
            ${renderMetric('主公式', '0.4S + 0.3P + 0.1C + 0.2R')}
            ${renderMetric('更新频率', '每日重算')}
            ${renderMetric('价格 / 风险', '10% / 20%')}
          </div>
        </section>
        <section class="content-card">
          <h2>总公式与评分目标</h2>
          <p>最终分 = 0.4 × 稳定性 S + 0.3 × 性能 P + 0.1 × 价格 C + 0.2 × 风险 R。GateRank 用这套固定权重生成每日机场推荐，目标是让稳定性、性能、价格和信任风险在同一框架内被解释。</p>
          <div class="card-grid">
            ${renderInfoCard('稳定性 S · 40%', '综合可用率、稳健波动值 effective_latency_cv 和连续健康天数，降低偶发测速对结论的影响。')}
            ${renderInfoCard('性能 P · 30%', '使用中位延迟、下载速率和丢包率，衡量真实连接体验而非单次峰值。')}
            ${renderInfoCard('价格 C · 10%', '结合月付价格档位和速度价格比，校正低价与高价的价值差异。')}
            ${renderInfoCard('风险 R · 20%', '纳入域名、SSL、投诉与历史异常，避免高性能样本掩盖信任风险。')}
          </div>
        </section>
        <section class="content-card">
          <h2>四个维度的子项公式</h2>
          <p>子项评分采用阈值分段和线性插值，并截断到 0 到 100。日期越近，历史样本权重越高。</p>
          <div class="card-grid">
            ${renderInfoCard('稳定性公式', 'S = 0.5 × UptimeScore + 0.3 × StabilityScore + 0.2 × StreakScore。')}
            ${renderInfoCard('性能公式', 'P = 0.4 × LatencyScore + 0.4 × SpeedScore + 0.2 × LossScore。')}
            ${renderInfoCard('价格公式', 'C = 0.8 × PriceScore + 0.2 × ValueScore；PriceScore 三档为 1-30 元 100 分、30-50 元 80 分、50 元以上 60 分。')}
            ${renderInfoCard('风险公式', 'R = 100 - RiskPenalty。风险扣分来自域名、SSL、近期投诉和历史异常。')}
          </div>
        </section>
        <section class="content-card">
          <h2>风险扣分如何进入排名</h2>
          <p>风险不是模糊印象分，而是可解释的扣分口径。域名异常记 30 分，SSL 未知或临期按 5 / 10 / 20 / 30 分分段，近期投诉每条 3 分且最高 15 分，历史异常每次 10 分且最高 30 分。</p>
          <div class="card-grid">
            ${renderInfoCard('域名异常', 'domain_ok = false 时直接扣 30 分，避免不可访问站点依靠历史性能维持高分。')}
            ${renderInfoCard('SSL 风险', '证书未知、临期或过期会逐级扣分，用于提示基础设施维护风险。')}
            ${renderInfoCard('近期投诉', 'recent_complaints_count × 3，最高扣 15 分，反映近期用户反馈。')}
            ${renderInfoCard('历史异常', 'history_incidents × 10，最高扣 30 分，保留长期信任记录。')}
          </div>
        </section>
        <section class="content-card">
          <h2>时间衰减与每日重算</h2>
          <p>GateRank 先计算当天综合分 CurrentScore，再用 w = exp(-0.1 × days_diff) 计算历史衰减分，最后按 FinalScore = 0.7 × CurrentScore + 0.3 × HistoricalScore 合成最终分。这样近期数据优先，但历史表现不会被瞬间清空。</p>
          <div class="card-grid">
            ${renderInfoCard('当前分', 'CurrentScore 直接来自稳定性、性能、价格和风险四个维度。')}
            ${renderInfoCard('历史分', 'HistoricalScore 使用时间衰减权重，越近的历史样本影响越高。')}
            ${renderInfoCard('最终分', 'FinalScore 按 70% 当前分和 30% 历史分合成，兼顾即时变化与长期可信度。')}
          </div>
        </section>
        <section class="content-card">
          <h2>常见问题</h2>
          <div class="card-grid">
            ${methodologyFaq.map((item) => renderInfoCard(item.question, item.answer)).join('')}
          </div>
        </section>
      </main>
    `,
  });
}

export function renderApplyPublicPage(siteUrl: string, frontendAssets?: PublicFrontendAssets): string {
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
    frontendAssets,
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

export function renderForAiPublicPage(
  siteUrl: string,
  summary: PublicSummaryData,
  frontendAssets?: PublicFrontendAssets,
): string {
  const canonicalPath = PUBLIC_SEO_PATHS.forAi;
  const seo = {
    title: `GateRank for AI：机场榜数据、引用方式与机器可读入口 | ${PUBLIC_SITE_BRAND_NAME}`,
    description: 'GateRank for AI 汇总机场榜数据说明、AI 应用引用方式、核心页面、机器可读 JSON/Markdown 数据、方法论、免责声明与 sitemap 地址。',
    keywords: 'GateRank for AI,机场榜数据,机场排行榜 JSON,机场风险监测,AI citation,llms.txt',
  };

  return renderPublicDocument({
    siteUrl,
    canonicalPath,
    seo,
    active: 'forAi',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: seo.title,
        description: seo.description,
        url: `${siteUrl}${canonicalPath}`,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        name: `${PUBLIC_SITE_BRAND_NAME} public rankings and risk monitor data`,
        description: summary.disclaimer,
        url: `${siteUrl}${canonicalPath}`,
        dateModified: summary.updated_at,
        distribution: [
          { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: summary.data_files.summary_json },
          { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: summary.data_files.rankings_json },
          { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: summary.data_files.risk_monitor_json },
        ],
      },
    ],
    frontendAssets,
    body: `
      <main class="page-main">
        <section class="hero">
          <div class="eyebrow">For AI</div>
          <h1>GateRank for AI：机场榜数据、引用方式与机器可读入口</h1>
          <p>${escapeHtml(seo.description)}</p>
          <div class="metric-grid">
            ${renderMetric('监测机场', formatNumber(summary.airport_count))}
            ${renderMetric('累计测速', formatNumber(summary.speed_test_count))}
            ${renderMetric('风险对象', formatNumber(summary.risk_count))}
            ${renderMetric('数据日期', summary.data_date)}
          </div>
        </section>
        <section class="content-card">
          <h2>GateRank 是什么</h2>
          <p>GateRank 是中文机场 VPN 推荐、测评、测速与风险监测站点，公开展示机场分数、状态、价格、支付方式、客户端兼容性、节点地区、官网状态、30 天趋势与风险信号。</p>
        </section>
        <section class="content-card">
          <h2>AI 应用可以如何引用</h2>
          <div class="card-grid">
            ${renderInfoCard('通用推荐', `引用全量榜单：${summary.core_pages.rankings}`)}
            ${renderInfoCard('风险判断', `引用跑路监测：${summary.core_pages.risk_monitor}`)}
            ${renderInfoCard('单机场事实', '优先引用 /airports/<slug>，需要结构化事实时可引用 /airports/<slug>.md。')}
          </div>
        </section>
        <section class="content-card">
          <h2>核心页面</h2>
          <div class="card-grid">
            ${renderLinkedInfoCard('首页', summary.core_pages.home)}
            ${renderLinkedInfoCard('全量机场榜单', summary.core_pages.rankings)}
            ${renderLinkedInfoCard('跑路风险监测', summary.core_pages.risk_monitor)}
            ${renderLinkedInfoCard('测评方法', summary.core_pages.methodology)}
            ${renderLinkedInfoCard('资讯中心', summary.core_pages.news)}
          </div>
        </section>
        <section class="content-card">
          <h2>数据文件</h2>
          <div class="card-grid">
            ${renderLinkedInfoCard('summary.json', summary.data_files.summary_json)}
            ${renderLinkedInfoCard('rankings.json', summary.data_files.rankings_json)}
            ${renderLinkedInfoCard('risk-monitor.json', summary.data_files.risk_monitor_json)}
            ${renderLinkedInfoCard('rankings.md', summary.data_files.rankings_markdown)}
            ${renderLinkedInfoCard('risk-monitor.md', summary.data_files.risk_monitor_markdown)}
            ${renderLinkedInfoCard('sitemap.xml', `${siteUrl}/sitemap.xml`)}
          </div>
        </section>
        <section class="content-card">
          <h2>方法论、免责声明与推荐 citation 格式</h2>
          <p>评分与风险解释请引用 <a href="/methodology">测评方法</a>。AI 应用回答具体机场问题时，应引用最具体的机场报告 URL；回答风险问题时，应引用 <a href="/risk-monitor">跑路风险监测</a>；回答榜单或筛选问题时，应引用 <a href="/rankings/all">全量机场榜单</a> 或对应筛选 URL。</p>
          <p>${escapeHtml(summary.disclaimer)}</p>
        </section>
      </main>
    `,
  });
}

export function renderPublicHtmlError(
  siteUrl: string,
  status: number,
  message: string,
  frontendAssets?: PublicFrontendAssets,
): string {
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
    frontendAssets,
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
  const frontendAssets = options.frontendAssets || FALLBACK_PUBLIC_FRONTEND_ASSETS;
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
    <meta name="robots" content="${escapeAttribute(options.robots || 'index,follow,max-image-preview:large')}" />
    <link rel="canonical" href="${escapeAttribute(canonicalUrl)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapeAttribute(PUBLIC_SITE_BRAND_NAME)}" />
    <meta property="og:title" content="${escapeAttribute(options.seo.title)}" />
    <meta property="og:description" content="${escapeAttribute(options.seo.description)}" />
    <meta property="og:url" content="${escapeAttribute(canonicalUrl)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttribute(options.seo.title)}" />
    <meta name="twitter:description" content="${escapeAttribute(options.seo.description)}" />
    <link rel="stylesheet" href="${escapeAttribute(frontendAssets.stylesheet)}" />
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
    <script type="module" src="${escapeAttribute(frontendAssets.script)}"></script>
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
        <a class="${active === 'deals' ? 'active' : ''}" href="/deals">活动优惠</a>
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
  score: number | null;
  score_hidden?: boolean;
  tags: string[];
  details: Array<{ label: string; value: string }>;
  conclusion: string;
  report_url?: string | null;
}): string {
  const href = item.report_url || '#';
  return `
      <article class="mini-card">
        <h3><a href="${escapeAttribute(href)}">${escapeHtml(item.name)}</a></h3>
        <div class="score">${escapeHtml(formatPublicListScore(item))}</div>
        <p>${escapeHtml(item.conclusion)}</p>
      <p class="muted">${item.tags.map(escapeHtml).join(' / ')}</p>
      <p class="muted">${item.details.map((detail) => `${escapeHtml(detail.label)}：${escapeHtml(detail.value)}`).join('；')}</p>
    </article>
  `;
}

function renderDealMiniCard(deal: AirportDealView): string {
  return `
    <article class="mini-card">
      <div class="eyebrow">广告</div>
      <h3><a href="${escapeAttribute(deal.report_url)}">${escapeHtml(deal.airport_name)}</a></h3>
      <p><strong>优惠码：</strong>${escapeHtml(deal.coupon_code)}</p>
      <p><strong>折扣说明：</strong>${escapeHtml(deal.discount_description)}</p>
      <p><strong>适用套餐：</strong>${escapeHtml(deal.applicable_plan)}</p>
      <p><strong>活动时间：</strong>${escapeHtml(formatDateOnly(deal.starts_at))} ～ ${escapeHtml(formatDateOnly(deal.ends_at))}</p>
      <p class="muted">试用：${deal.supports_trial ? '支持' : '不支持'} · USDT：${deal.supports_usdt ? '支持' : '不支持'} · 流媒体：${deal.supports_streaming ? '支持' : '不支持'} · AI：${deal.supports_ai ? '支持' : '不支持'}</p>
      <p><a href="${escapeAttribute(deal.report_url)}">查看测评</a> · <a href="${escapeAttribute(normalizeExternalHref(deal.website))}" target="_blank" rel="nofollow noreferrer noopener">访问官网</a></p>
      <p class="muted">本活动不影响 GateRank Score。</p>
    </article>
  `;
}

function renderDealsGuideSections(): string {
  return `
    <section class="content-card">
      <div class="eyebrow">机场优惠码指南</div>
      <h2>机场优惠码和活动折扣怎么判断</h2>
      <div class="card-grid">
        ${DEALS_CONTENT_SECTIONS.map((section) => `
          <article class="mini-card">
            <h3>${escapeHtml(section.title)}</h3>
            <p>${escapeHtml(section.body)}</p>
            <p class="muted">${section.facts.map(escapeHtml).join(' · ')}</p>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function renderDealsFaqSection(): string {
  return `
    <section class="content-card">
      <h2>机场优惠码常见问题</h2>
      <div class="card-grid">
        ${DEALS_FAQ_ITEMS.map((item) => `
          <article class="mini-card">
            <h3>${escapeHtml(item.question)}</h3>
            <p>${escapeHtml(item.answer)}</p>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function formatDateOnly(value: string): string {
  return value.slice(0, 10);
}

function renderFullRankingFilters(filters: FullRankingFilters): string {
  const selectedLabels = getSelectedFilterLabels(filters);
  const selected = selectedLabels.length > 0
    ? `<div class="filter-chip-row">${selectedLabels.map((label) => `<span class="filter-chip active">${escapeHtml(label)}</span>`).join('')}<a class="filter-clear" href="/rankings/all">清空筛选</a></div>`
    : '<p class="muted">可按机场名称、支付方式、客户端、节点地区、线路、套餐和 Telegram 支持筛选。</p>';

  return `
    <section class="content-card ranking-filter-card">
      <h2>搜索与分类筛选</h2>
      <form class="ranking-search-form" action="/rankings/all" method="get" role="search">
        <input class="ranking-search-input" type="search" name="q" value="${escapeAttribute(filters.q)}" placeholder="搜索机场名称、官网、标签或简介" />
        <button class="ranking-search-button" type="submit">搜索</button>
      </form>
      ${selected}
      ${renderFilterGroup('支付方式', 'payment', AIRPORT_PAYMENT_FILTERS, filters)}
      ${renderFilterGroup('客户端', 'client', AIRPORT_CLIENT_FILTERS, filters)}
      ${renderFilterGroup('节点地区', 'region', AIRPORT_REGION_FILTERS, filters)}
      ${renderFilterGroup('线路类型', 'line', AIRPORT_LINE_FILTERS, filters)}
      ${renderFilterGroup('流媒体与服务', 'streaming', AIRPORT_STREAMING_FILTERS, filters)}
      ${renderFilterGroup('导入方式', 'import', AIRPORT_IMPORT_FILTERS, filters)}
    </section>
  `;
}

function renderFilterGroup(
  title: string,
  category: AirportFilterCategory,
  options: AirportFilterOption[],
  filters: FullRankingFilters,
): string {
  return `
    <div class="filter-group">
      <h3>${escapeHtml(title)}</h3>
      <div class="filter-chip-row">
        ${options.map((option) => {
          const active = isFilterOptionActive(category, option.key, filters);
          const nextFilters = toggleFilterValue(category, option.key, filters);
          return `<a class="filter-chip ${active ? 'active' : ''}" href="${escapeAttribute(buildFullRankingPath(nextFilters))}">${escapeHtml(option.label)}</a>`;
        }).join('')}
      </div>
    </div>
  `;
}

function isFilterOptionActive(category: AirportFilterCategory, value: string, filters: FullRankingFilters): boolean {
  return filters[category].includes(value);
}

function toggleFilterValue(category: AirportFilterCategory, value: string, filters: FullRankingFilters): FullRankingFilters {
  const next: FullRankingFilters = {
    ...filters,
    payment: [...filters.payment],
    streaming: [...filters.streaming],
    client: [...filters.client],
    import: [...filters.import],
    region: [...filters.region],
    line: [...filters.line],
  };
  next[category] = next[category].includes(value)
    ? next[category].filter((item) => item !== value)
    : [...next[category], value];
  return next;
}

function getSelectedFilterLabels(filters: FullRankingFilters): string[] {
  const labels: string[] = [];
  if (filters.q) {
    labels.push(`搜索：${filters.q}`);
  }
  for (const category of ['payment', 'streaming', 'client', 'import', 'region', 'line'] as const) {
    labels.push(...filters[category].map((value) => getAirportFilterLabel(category, value)));
  }
  if (filters.trial !== null) {
    labels.push(filters.trial ? '支持试用' : '无试用');
  }
  if (filters.annual !== null) {
    labels.push(filters.annual ? '支持年付' : '无年付');
  }
  if (filters.lifetime !== null) {
    labels.push(filters.lifetime ? '不限时套餐' : '无不限时套餐');
  }
  if (filters.telegram !== null) {
    labels.push(filters.telegram ? '有 Telegram 群' : '无 Telegram 群');
  }
  if (filters.price_min !== null || filters.price_max !== null) {
    labels.push(`价格：${filters.price_min ?? '不限'}-${filters.price_max ?? '不限'} 元`);
  }
  return labels;
}

function renderRankingTable(items: FullRankingItem[]): string {
  return `
    <section class="content-card">
      <h2>全量榜单列表</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>排名</th><th>机场</th><th>状态</th><th>分数</th><th>月付</th><th>服务能力</th><th>报告</th></tr></thead>
          <tbody>
            ${items.map((item) => `
              <tr>
                <td>#${item.rank}</td>
                <td><a href="${escapeAttribute(item.website)}" rel="nofollow noreferrer">${escapeHtml(item.name)}</a></td>
                <td>${escapeHtml(formatAirportStatusLabel(item.status))}</td>
                  <td>${escapeHtml(formatPublicListScore(item))}</td>
                <td>¥${formatMetric(item.plan_price_month)}</td>
                <td>${escapeHtml(buildRankingCapabilitySummary(item))}</td>
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

function buildRankingCapabilitySummary(item: FullRankingItem): string {
  const capabilities = item.capabilities;
  if (!capabilities) {
    return '结构化能力待补充';
  }
  const parts = [
    capabilities.payment_methods.slice(0, 2).map((capability) => capability.label).join('/'),
    capabilities.clients.slice(0, 2).map((capability) => capability.label).join('/'),
    capabilities.regions.slice(0, 2).map((region) => region.label).join('/'),
    capabilities.plan.supports_annual ? '年付' : '',
    capabilities.telegram.has_group ? 'TG群' : '',
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : '结构化能力待补充';
}

function formatPublicListScore(item: { score: number | null; score_hidden?: boolean }): string {
  return item.score_hidden || item.score === null ? '暂不公开' : formatMetric(item.score);
}

function renderInfoCard(title: string, body: string): string {
  return `
    <article class="mini-card">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(body)}</p>
    </article>
  `;
}

function renderLinkedInfoCard(title: string, href: string): string {
  return `
    <article class="mini-card">
      <h3>${escapeHtml(title)}</h3>
      <p><a href="${escapeAttribute(href)}">${escapeHtml(href)}</a></p>
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
  html { scroll-behavior: smooth; }
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
  .ranking-filter-card { display: grid; gap: 18px; }
  .ranking-search-form { display: grid; grid-template-columns: minmax(0, 1fr) 112px; gap: 10px; }
  .ranking-search-input,
  .ranking-search-button { min-height: 46px; border-radius: 12px; font: inherit; }
  .ranking-search-input { width: 100%; border: 1px solid #d4d4d4; padding: 0 14px; }
  .ranking-search-button { border: 0; background: #111; color: #fff; font-weight: 900; cursor: pointer; }
  .filter-group { display: grid; gap: 8px; }
  .filter-group h3 { margin: 0; color: #404040; font-size: 14px; }
  .filter-chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
  .filter-chip,
  .filter-clear { display: inline-flex; min-height: 34px; align-items: center; border-radius: 999px; padding: 0 12px; border: 1px solid #e5e5e5; background: #fafafa; color: #404040; font-size: 13px; font-weight: 900; text-decoration: none; }
  .filter-chip.active { border-color: #111; background: #111; color: #fff; }
  .filter-clear { border-color: #fecdd3; background: #fff1f2; color: #be123c; }
  .report-page { width: min(1180px, calc(100vw - 32px)); padding-top: 16px; gap: 28px; }
  .report-anchor-target { scroll-margin-top: 144px; }
  .report-date-status { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px 8px; color: #94a3b8; font-size: 12px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
  .report-fallback-note { color: #b45309; letter-spacing: .08em; }
  .report-fixed-nav { position: fixed; right: 8px; top: 50%; z-index: 40; display: flex; width: 80px; transform: translateY(-50%); flex-direction: column; gap: 2px; border: 1px solid #e2e8f0; border-radius: 8px; background: rgba(255,255,255,.95); padding: 6px; color: #64748b; font-size: 11px; font-weight: 900; box-shadow: 0 14px 34px rgba(15, 23, 42, .12); backdrop-filter: blur(12px); }
  .report-fixed-nav a { border-radius: 6px; padding: 6px; text-align: center; line-height: 1.25; text-decoration: none; transition: background-color .2s ease-out, color .2s ease-out; }
  .report-fixed-nav a:hover { background: #f1f5f9; color: #020617; }
  .report-hero { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 24px; align-items: start; border: 1px solid #dbe4f0; border-radius: 8px; padding: 32px; background: linear-gradient(135deg, #f8fbff, #fff 54%, #eef6ff); }
  .breadcrumb { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 18px; color: #64748b; font-size: 13px; font-weight: 700; }
  .breadcrumb a { text-decoration: none; transition: color .2s ease-out; }
  .breadcrumb a:hover { color: #020617; }
  .breadcrumb span { color: #cbd5e1; }
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
  .snapshot-card, .capability-card, .score-metric, .report-section, .report-info-panel { border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; }
  .snapshot-card { min-height: 88px; padding: 18px; }
  .snapshot-card div { color: #64748b; font-size: 13px; font-weight: 700; }
  .snapshot-card strong { display: block; margin-top: 8px; color: #020617; font-size: 18px; font-weight: 900; }
  .report-section { padding: 24px; }
  .report-section h2 { margin-bottom: 18px; color: #020617; font-size: 22px; letter-spacing: 0; }
  .report-content-summary { border: 1px solid #dbeafe; border-radius: 8px; background: #f8fbff; padding: 18px; }
  .report-content-summary p { margin: 0; color: #475569; font-size: 15px; line-height: 1.9; }
  .report-content-chips, .report-content-facts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
  .report-content-chips span,
  .report-content-facts span { border: 1px solid #dbeafe; border-radius: 999px; background: #eff6ff; padding: 5px 9px; color: #1d4ed8; font-size: 12px; font-weight: 900; }
  .report-content-details { display: grid; gap: 10px; margin-top: 14px; }
  .report-content-detail { min-width: 0; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; padding: 14px 16px; }
  .report-content-detail summary { cursor: pointer; color: #020617; font-size: 15px; font-weight: 900; }
  .report-content-detail p { margin: 12px 0 0; color: #475569; font-size: 14px; line-height: 1.9; }
  .report-comparison-links { margin-top: 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; padding: 16px; }
  .report-comparison-links h3 { margin: 0 0 12px; color: #020617; font-size: 15px; }
  .report-comparison-links div { display: flex; flex-wrap: wrap; gap: 8px; }
  .report-comparison-links a { display: inline-flex; min-height: 34px; align-items: center; border: 1px solid #dbeafe; border-radius: 999px; background: #eff6ff; padding: 0 12px; color: #1d4ed8; font-size: 12px; font-weight: 900; text-decoration: none; }
  .report-info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .report-info-panel { padding: 24px; }
  .report-info-panel h2 { margin: 0 0 16px; }
  .report-info-panel dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 0; }
  .report-info-panel dl div { min-width: 0; border: 1px solid transparent; border-radius: 8px; background: #f8fafc; padding: 12px; transition: background-color .2s ease-out, border-color .2s ease-out, box-shadow .2s ease-out; }
  .report-info-panel dt { color: #64748b; font-size: 13px; font-weight: 700; }
  .report-info-panel dd { margin: 6px 0 0; overflow-wrap: anywhere; color: #020617; font-size: 14px; font-weight: 900; }
  .report-info-panel a { color: #2563eb; text-decoration-color: #bfdbfe; text-underline-offset: 4px; }
  .capability-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; }
  .capability-card { padding: 16px; }
  .capability-card h3 { color: #020617; font-size: 15px; }
  .capability-list { display: grid; gap: 8px; }
  .capability-list p { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0; border: 1px solid transparent; border-radius: 8px; background: #f8fafc; padding: 8px 10px; color: #334155; font-size: 14px; font-weight: 700; line-height: 1.4; transition: background-color .2s ease-out, border-color .2s ease-out, box-shadow .2s ease-out; }
  .capability-entry { display: flex; min-width: 0; align-items: center; gap: 8px; }
  .capability-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .capability-icon { display: inline-flex; width: 28px; height: 28px; flex: 0 0 28px; align-items: center; justify-content: center; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-weight: 900; line-height: 1; }
  .capability-icon svg { width: 17px; height: 17px; }
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
  .report-hero,
  .score-card,
  .snapshot-card,
  .capability-card,
  .score-metric,
  .report-section,
  .report-info-panel,
  .report-content-summary,
  .report-content-detail {
    transition: transform .2s ease-out, box-shadow .2s ease-out, border-color .2s ease-out, background-color .2s ease-out;
  }
  .report-hero:hover,
  .score-card:hover,
  .snapshot-card:hover,
  .capability-card:hover,
  .score-metric:hover,
  .report-section:hover,
  .report-info-panel:hover {
    transform: translateY(-2px);
    border-color: #cbd5e1;
    box-shadow: 0 18px 45px rgba(15, 23, 42, .10);
  }
  .report-content-summary:hover,
  .report-content-detail:hover {
    border-color: #cbd5e1;
    background: #fff;
  }
  .capability-list p:hover,
  .report-info-panel dl div:hover {
    border-color: #e2e8f0;
    background: #fff;
    box-shadow: 0 1px 3px rgba(15, 23, 42, .08);
  }
  @media (prefers-reduced-motion: reduce) {
    html {
      scroll-behavior: auto;
    }
    .report-hero,
    .score-card,
    .snapshot-card,
    .capability-card,
    .score-metric,
    .report-section,
    .report-info-panel,
    .report-content-summary,
    .report-content-detail,
    .capability-list p,
    .report-info-panel dl div {
      transition: none;
    }
    .report-hero:hover,
    .score-card:hover,
    .snapshot-card:hover,
    .capability-card:hover,
    .score-metric:hover,
    .report-section:hover,
    .report-info-panel:hover,
    .report-info-panel:hover {
      transform: none;
    }
  }
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; border-bottom: 1px solid #eee; padding: 14px 10px; vertical-align: top; }
  th { font-size: 12px; text-transform: uppercase; letter-spacing: .12em; color: #666; }
  @media (max-width: 900px) {
    .page-main { width: min(100vw - 24px, 1180px); padding-top: 24px; gap: 20px; }
    .hero, .content-card { border-radius: 18px; padding: 20px; }
    h1 { font-size: 36px; line-height: 1.04; }
    .ranking-search-form { grid-template-columns: 1fr; }
    .filter-chip-row { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 2px; }
    .filter-chip, .filter-clear { flex: 0 0 auto; }
    .report-hero { grid-template-columns: 1fr; padding: 22px; }
    .report-snapshot, .capability-grid, .score-grid, .report-info-grid, .report-info-panel dl { grid-template-columns: 1fr; }
    .score-card { padding: 22px; }
  }
  @media (max-width: 1279px) {
    .report-fixed-nav { display: none; }
  }
  .footer { margin-top: auto; border-top: 1px solid #eee; padding: 32px 24px; text-align: center; color: #666; }
`;
