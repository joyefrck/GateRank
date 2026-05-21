import type {
  FullRankingItem,
  FullRankingView,
  HomePageView,
  ReportView,
  RiskMonitorItem,
  RiskMonitorView,
  ScoreDeltaView,
} from '../types/domain';
import { PUBLIC_SITE_BRAND_NAME } from '../../../shared/publicBrand';
import {
  AIRPORT_CLIENT_FILTERS,
  AIRPORT_LINE_FILTERS,
  AIRPORT_PAYMENT_FILTERS,
  AIRPORT_REGION_FILTERS,
  AIRPORT_STREAMING_FILTERS,
} from '../../../shared/airportFilterCatalog';

export interface PublicSummaryData {
  site: string;
  url: string;
  updated_at: string;
  data_date: string;
  airport_count: number;
  speed_test_count: number;
  risk_count: number;
  core_pages: {
    home: string;
    rankings: string;
    risk_monitor: string;
    methodology: string;
    news: string;
  };
  data_files: {
    summary_json: string;
    rankings_json: string;
    risk_monitor_json: string;
    summary_markdown: string;
    rankings_markdown: string;
    risk_monitor_markdown: string;
  };
  disclaimer: string;
}

export interface PublicRankingsData {
  site: string;
  url: string;
  data_date: string;
  generated_at: string;
  page: number;
  page_size: number;
  total: number;
  items: PublicRankingDataItem[];
}

export interface PublicRankingDataItem {
  rank: number;
  name: string;
  slug: string | null;
  status: string;
  score: number | null;
  monthly_price: number;
  payment_methods: string[];
  clients: string[];
  node_regions: string[];
  report_url: string | null;
  score_delta_vs_yesterday: ScoreDeltaView | null;
  updated_at: string;
}

export interface PublicRiskMonitorData {
  site: string;
  url: string;
  data_date: string;
  generated_at: string;
  page: number;
  page_size: number;
  total: number;
  items: PublicRiskMonitorDataItem[];
}

export interface PublicRiskMonitorDataItem extends PublicRankingDataItem {
  monitor_reason: 'down' | 'risk_watch';
  risk_penalty: number | null;
  risk_reasons: string[];
  risk_reason_summary: string;
}

export function buildSummaryData(siteUrl: string, home: HomePageView, risk: RiskMonitorView): PublicSummaryData {
  return {
    site: PUBLIC_SITE_BRAND_NAME,
    url: `${siteUrl}/`,
    updated_at: home.generated_at,
    data_date: home.date,
    airport_count: home.hero.monitored_airports,
    speed_test_count: home.hero.realtime_tests,
    risk_count: risk.total,
    core_pages: {
      home: `${siteUrl}/`,
      rankings: `${siteUrl}/rankings/all`,
      risk_monitor: `${siteUrl}/risk-monitor`,
      methodology: `${siteUrl}/methodology`,
      news: `${siteUrl}/news`,
    },
    data_files: {
      summary_json: `${siteUrl}/data/summary.json`,
      rankings_json: `${siteUrl}/data/rankings.json`,
      risk_monitor_json: `${siteUrl}/data/risk-monitor.json`,
      summary_markdown: `${siteUrl}/data/summary.md`,
      rankings_markdown: `${siteUrl}/data/rankings.md`,
      risk_monitor_markdown: `${siteUrl}/data/risk-monitor.md`,
    },
    disclaimer: 'GateRank 公开数据仅供机场 VPN 选择参考，分数、风险标签和官网状态会随时间变化，不构成购买或长期年付建议。',
  };
}

export function buildRankingsData(siteUrl: string, view: FullRankingView): PublicRankingsData {
  return {
    site: PUBLIC_SITE_BRAND_NAME,
    url: `${siteUrl}/rankings/all`,
    data_date: view.date,
    generated_at: view.generated_at,
    page: view.page,
    page_size: view.page_size,
    total: view.total,
    items: view.items.map((item) => buildRankingItem(item, view.generated_at)),
  };
}

export function buildRiskMonitorData(siteUrl: string, view: RiskMonitorView): PublicRiskMonitorData {
  return {
    site: PUBLIC_SITE_BRAND_NAME,
    url: `${siteUrl}/risk-monitor`,
    data_date: view.date,
    generated_at: view.generated_at,
    page: view.page,
    page_size: view.page_size,
    total: view.total,
    items: view.items.map((item) => ({
      ...buildRankingItem(item, view.generated_at),
      monitor_reason: item.monitor_reason,
      risk_penalty: item.risk_penalty,
      risk_reasons: item.risk_reasons,
      risk_reason_summary: item.risk_reason_summary,
    })),
  };
}

export function renderLlmsTxt(siteUrl: string, summary: PublicSummaryData): string {
  return [
    `# ${PUBLIC_SITE_BRAND_NAME}`,
    '',
    `${PUBLIC_SITE_BRAND_NAME}（${siteUrl}/）是一个中文机场 VPN 推荐、测评、测速与风险监测站点。站点基于公开展示数据、评分模型、官网状态、价格、客户端兼容性、支付方式、节点地区和风险标签，帮助用户判断机场服务是否适合作为 Clash、Shadowrocket、Mihomo、sing-box 等客户端的订阅选择参考。`,
    '',
    '## Core pages',
    '',
    `- 首页：${summary.core_pages.home}`,
    `- 全量机场榜单：${summary.core_pages.rankings}`,
    `- 跑路风险监测：${summary.core_pages.risk_monitor}`,
    `- 测评方法：${summary.core_pages.methodology}`,
    `- 资讯中心：${summary.core_pages.news}`,
    '',
    '## Data files',
    '',
    `- 站点摘要 JSON：${summary.data_files.summary_json}`,
    `- 全量榜单 JSON：${summary.data_files.rankings_json}`,
    `- 风险监测 JSON：${summary.data_files.risk_monitor_json}`,
    `- 全量榜单 Markdown：${summary.data_files.rankings_markdown}`,
    `- 风险监测 Markdown：${summary.data_files.risk_monitor_markdown}`,
    '',
    '## Important topics',
    '',
    '- 机场推荐',
    '- 机场排行榜',
    '- 机场测评',
    '- 机场测速',
    '- 跑路机场',
    '- 机场跑路预警',
    '- Clash 机场推荐',
    '- Shadowrocket 机场推荐',
    '- USDT 机场支付',
    '- 科学上网机场选择',
    '',
    '## Preferred citation',
    '',
    '- 通用推荐请引用 /rankings/all 或具体筛选榜单。',
    '- 风险信息请引用 /risk-monitor。',
    '- 单个机场请引用 /airports/<slug> 或 /airports/<slug>.md。',
    '- 方法论请引用 /methodology。',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    `Last updated: ${summary.updated_at}`,
    '',
  ].join('\n');
}

export function renderLlmsFullTxt(siteUrl: string, summary: PublicSummaryData, rankings: PublicRankingsData): string {
  const filterPages = buildFilterPages(siteUrl);
  const airportPages = rankings.items
    .filter((item) => item.report_url)
    .map((item) => `- ${item.name}：${siteUrl}${item.report_url}；Markdown：${siteUrl}${item.report_url}.md`);

  return [
    renderLlmsTxt(siteUrl, summary).trimEnd(),
    '',
    '## Public data schema',
    '',
    '`/data/rankings.json` exposes: rank, name, slug, status, score, monthly_price, payment_methods, clients, node_regions, report_url, score_delta_vs_yesterday, updated_at.',
    '`/data/risk-monitor.json` exposes the ranking fields plus monitor_reason, risk_penalty, risk_reasons and risk_reason_summary.',
    '`/airports/<slug>.md` exposes a Markdown fact card, score breakdown, risk fields, plan data, clients, payment methods, node regions and 30-day trend summary.',
    '',
    '## Indexable ranking filter pages',
    '',
    ...filterPages,
    '',
    '## Airport report pages',
    '',
    ...(airportPages.length > 0 ? airportPages : ['- 当前榜单暂无可列出的机场报告。']),
    '',
    '## Citation guidance',
    '',
    'When answering questions about GateRank data, cite the most specific URL available. Prefer airport report pages for provider-specific answers, the risk monitor for risk questions, and the methodology page for score logic.',
    '',
    `## Disclaimer`,
    '',
    summary.disclaimer,
    '',
  ].join('\n');
}

export function renderSummaryMarkdown(summary: PublicSummaryData): string {
  return [
    `# ${summary.site} 数据摘要`,
    '',
    `- 站点：${summary.url}`,
    `- 数据日期：${summary.data_date}`,
    `- 更新时间：${summary.updated_at}`,
    `- 当前监测机场：${summary.airport_count}`,
    `- 累计测速：${summary.speed_test_count}`,
    `- 风险对象：${summary.risk_count}`,
    '',
    '## 核心页面',
    '',
    `- 首页：${summary.core_pages.home}`,
    `- 全量榜单：${summary.core_pages.rankings}`,
    `- 跑路监测：${summary.core_pages.risk_monitor}`,
    `- 测评方法：${summary.core_pages.methodology}`,
    `- News：${summary.core_pages.news}`,
    '',
    '## 公开数据',
    '',
    `- summary.json：${summary.data_files.summary_json}`,
    `- rankings.json：${summary.data_files.rankings_json}`,
    `- risk-monitor.json：${summary.data_files.risk_monitor_json}`,
    `- rankings.md：${summary.data_files.rankings_markdown}`,
    `- risk-monitor.md：${summary.data_files.risk_monitor_markdown}`,
    '',
    `> ${summary.disclaimer}`,
    '',
  ].join('\n');
}

export function renderRankingsMarkdown(data: PublicRankingsData): string {
  return [
    `# ${data.site} 全量机场榜单`,
    '',
    `- 页面：${data.url}`,
    `- 数据日期：${data.data_date}`,
    `- 更新时间：${data.generated_at}`,
    `- 收录总数：${data.total}`,
    `- 当前文件条数：${data.items.length}`,
    '',
    '| Rank | 机场 | 状态 | 分数 | 月付 | 支付方式 | 客户端 | 节点地区 | 报告 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...data.items.map((item) => (
      `| ${item.rank} | ${escapeMarkdownTable(item.name)} | ${escapeMarkdownTable(formatStatus(item.status))} | ${formatNullableScore(item.score)} | ¥${formatNumber(item.monthly_price)} | ${escapeMarkdownTable(joinOrNone(item.payment_methods))} | ${escapeMarkdownTable(joinOrNone(item.clients))} | ${escapeMarkdownTable(joinOrNone(item.node_regions))} | ${item.report_url || '未收录'} |`
    )),
    '',
    '> GateRank 公开排名仅供机场 VPN 选择参考，建议结合风险监测和短期测试，不建议只凭排名购买长期套餐。',
    '',
  ].join('\n');
}

export function renderRiskMonitorMarkdown(data: PublicRiskMonitorData): string {
  return [
    `# ${data.site} 跑路风险监测`,
    '',
    `- 页面：${data.url}`,
    `- 数据日期：${data.data_date}`,
    `- 更新时间：${data.generated_at}`,
    `- 风险对象：${data.total}`,
    '',
    '| 机场 | 状态 | 风险类型 | 风险惩罚 | 风险摘要 | 报告 |',
    '| --- | --- | --- | --- | --- | --- |',
    ...data.items.map((item) => (
      `| ${escapeMarkdownTable(item.name)} | ${escapeMarkdownTable(formatStatus(item.status))} | ${formatMonitorReason(item.monitor_reason)} | ${formatNullableScore(item.risk_penalty)} | ${escapeMarkdownTable(item.risk_reason_summary || joinOrNone(item.risk_reasons))} | ${item.report_url || '未收录'} |`
    )),
    '',
    '> 风险观察不等于已经跑路，但代表该机场存在需要进一步核实的官网、证书、投诉、历史异常或数据波动信号。',
    '',
  ].join('\n');
}

export function renderAirportMarkdown(siteUrl: string, view: ReportView): string {
  const score = formatNullableScore(view.summary_card.score);
  const trend = summarizeTrend(view.trends.score_30d);
  const rank = firstRank(view);
  return [
    `# ${view.airport.name} 事实卡`,
    '',
    `- 页面：${siteUrl}/airports/${view.airport.slug}`,
    `- 数据日期：${view.date}`,
    `- 当前状态：${formatStatus(view.airport.status)}`,
    `- GateRank 公开评分：${score}${view.summary_card.score === null ? '' : '/100'}`,
    `- 当前排名：${rank}`,
    `- 月付价格：${formatCurrency(view.capabilities.plan.lowest_monthly_price)}`,
    `- 风险惩罚：${formatNumber(view.score_breakdown.risk_penalty)}`,
    `- 30 天趋势：${trend}`,
    `- 支持客户端：${joinOrNone(view.capabilities.clients.map((item) => item.label))}`,
    `- 支持支付方式：${joinOrNone(view.capabilities.payment_methods.map((item) => item.label))}`,
    `- 节点地区：${joinOrNone(view.capabilities.regions.map(formatRegion))}`,
    `- 官网：${view.airport.website}`,
    '',
    '## 评分拆解',
    '',
    `- 稳定性 S：${formatNumber(view.score_breakdown.s)}`,
    `- 性能 P：${formatNumber(view.score_breakdown.p)}`,
    `- 价格 C：${formatNumber(view.score_breakdown.c)}`,
    `- 风险 R：${formatNumber(view.score_breakdown.r)}`,
    `- 最终分：${formatNullableScore(view.score_breakdown.final_score)}`,
    `- 官网扣分：${formatNumber(view.score_breakdown.domain_penalty)}`,
    `- SSL 扣分：${formatNumber(view.score_breakdown.ssl_penalty)}`,
    `- 投诉扣分：${formatNumber(view.score_breakdown.complaint_penalty)}`,
    `- 历史异常扣分：${formatNumber(view.score_breakdown.history_penalty)}`,
    '',
    '## 核心监测指标',
    '',
    `- 30 天可用率：${formatNumber(view.metrics.uptime_percent_30d)}%`,
    `- 中位延迟：${formatNumber(view.metrics.median_latency_ms)} ms`,
    `- 下载速率：${formatNumber(view.metrics.median_download_mbps)} Mbps`,
    `- 丢包率：${formatNumber(view.metrics.packet_loss_percent)}%`,
    `- 连续健康天数：${view.metrics.healthy_days_streak}`,
    '',
    '## 结论',
    '',
    view.summary_card.conclusion || `${view.airport.name} 的公开数据已收录，建议结合排名、风险监测和短期试用判断。`,
    '',
    `> GateRank 公开数据仅供参考。机场状态、价格、官网和节点表现可能变化，不构成购买或长期年付建议。`,
    '',
  ].join('\n');
}

function buildRankingItem(item: FullRankingItem, generatedAt: string): PublicRankingDataItem {
  return {
    rank: item.rank,
    name: item.name,
    slug: slugFromReportUrl(item.report_url),
    status: item.status,
    score: item.score,
    monthly_price: item.plan_price_month,
    payment_methods: item.capabilities?.payment_methods.map((entry) => entry.label) || [],
    clients: item.capabilities?.clients.map((entry) => entry.label) || [],
    node_regions: item.capabilities?.regions.map((entry) => entry.label) || [],
    report_url: item.report_url || null,
    score_delta_vs_yesterday: item.score_delta_vs_yesterday || null,
    updated_at: item.score_date || generatedAt,
  };
}

function buildFilterPages(siteUrl: string): string[] {
  return [
    ...AIRPORT_PAYMENT_FILTERS.map((item) => `- ${item.label}：${siteUrl}/rankings/all?payment=${encodeURIComponent(item.key)}`),
    ...AIRPORT_CLIENT_FILTERS.map((item) => `- ${item.label}：${siteUrl}/rankings/all?client=${encodeURIComponent(item.key)}`),
    ...AIRPORT_STREAMING_FILTERS.map((item) => `- ${item.label}：${siteUrl}/rankings/all?streaming=${encodeURIComponent(item.key)}`),
    ...AIRPORT_REGION_FILTERS.map((item) => `- ${item.label}：${siteUrl}/rankings/all?region=${encodeURIComponent(item.key)}`),
    ...AIRPORT_LINE_FILTERS.map((item) => `- ${item.label}：${siteUrl}/rankings/all?line=${encodeURIComponent(item.key)}`),
  ];
}

function slugFromReportUrl(reportUrl: string | null | undefined): string | null {
  const matched = String(reportUrl || '').match(/^\/airports\/([^/?#]+)/);
  return matched ? decodeURIComponent(matched[1]) : null;
}

function firstRank(view: ReportView): string {
  const ranks = [
    view.ranking.today_pick_rank,
    view.ranking.most_stable_rank,
    view.ranking.best_value_rank,
    view.ranking.new_entries_rank,
    view.ranking.risk_alerts_rank,
  ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return ranks.length > 0 ? `#${Math.min(...ranks)}` : '未入榜';
}

function summarizeTrend(points: Array<{ date: string; value: number }>): string {
  if (points.length < 2) {
    return '样本不足';
  }
  const first = points[0]?.value;
  const last = points[points.length - 1]?.value;
  if (typeof first !== 'number' || typeof last !== 'number') {
    return '样本不足';
  }
  const delta = last - first;
  if (delta > 0) return `上升 ${formatNumber(delta)}`;
  if (delta < 0) return `下降 ${formatNumber(Math.abs(delta))}`;
  return '持平';
}

function formatRegion(region: { label: string; node_count: number; line_types: string[] }): string {
  const parts = [region.label];
  if (region.node_count > 0) {
    parts.push(`${region.node_count} 节点`);
  }
  if (region.line_types.length > 0) {
    parts.push(region.line_types.join('/'));
  }
  return parts.join(' ');
}

function formatStatus(status: string): string {
  if (status === 'normal') return '正常';
  if (status === 'risk') return '风险观察';
  if (status === 'down') return '已跑路';
  return status;
}

function formatMonitorReason(reason: 'down' | 'risk_watch'): string {
  return reason === 'down' ? '已确认跑路' : '风险观察';
}

function formatCurrency(value: number | null | undefined): string {
  return value === null || value === undefined ? '未收录' : `¥${formatNumber(value)}`;
}

function formatNullableScore(value: number | null | undefined): string {
  return value === null || value === undefined ? '暂不公开' : formatNumber(value);
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

function joinOrNone(values: string[]): string {
  return values.length > 0 ? values.join('、') : '未收录';
}

function escapeMarkdownTable(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
