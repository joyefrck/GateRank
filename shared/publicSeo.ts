import { PUBLIC_SITE_BRAND_NAME } from './publicBrand';

export interface PublicSeoText {
  title: string;
  description: string;
  keywords: string;
}

export interface PublicReportSeoView {
  date: string;
  airport: {
    name: string;
    slug: string;
    website: string;
    status: string;
  };
  summary_card: {
    score: number;
    conclusion: string;
  };
  ranking: {
    today_pick_rank: number | null;
    most_stable_rank: number | null;
    best_value_rank: number | null;
    new_entries_rank: number | null;
    risk_alerts_rank: number | null;
  };
  score_breakdown: {
    s: number;
    p: number;
    c: number;
    r: number;
    final_score: number;
    risk_penalty: number;
    domain_penalty: number;
    ssl_penalty: number;
    complaint_penalty: number;
    history_penalty: number;
  };
  metrics: {
    uptime_percent_30d: number;
    median_latency_ms: number;
    median_download_mbps: number;
    packet_loss_percent: number;
    stable_days_streak: number;
    healthy_days_streak: number;
    stability_tier: string;
    recent_complaints_count: number;
    history_incidents: number;
  };
  trends: {
    score_30d: Array<{ date: string; value: number }>;
    uptime_30d: Array<{ date: string; value: number }>;
    latency_30d: Array<{ date: string; value: number }>;
    download_30d: Array<{ date: string; value: number }>;
  };
  capabilities: {
    plan: {
      supports_monthly: boolean | null;
      supports_quarterly: boolean | null;
      supports_half_yearly: boolean | null;
      supports_annual: boolean | null;
      lowest_monthly_price: number | null;
      lowest_annual_monthly_price: number | null;
      has_trial_plan: boolean | null;
      has_lifetime_plan: boolean | null;
    };
    streaming: Array<{ key: string; label: string }>;
    payment_methods: Array<{ key: string; label: string }>;
    telegram: {
      items: Array<{ key: string; label: string }>;
      has_group: boolean | null;
      group_url: string | null;
      has_channel: boolean | null;
      channel_url: string | null;
      group_allows_speaking: boolean | null;
      group_member_count: number | null;
      recent_active_at: string | null;
      has_customer_service_bot: boolean | null;
      has_ticket_system: boolean | null;
    };
    clients: Array<{ key: string; label: string }>;
    import_methods: Array<{ key: string; label: string }>;
    regions: Array<{
      key: string;
      label: string;
      line_types: string[];
      has_residential: boolean | null;
      has_native_ip: boolean | null;
    }>;
  };
}

export interface PublicReportFaqItem {
  question: string;
  answer: string;
}

export interface PublicReportContentSection {
  title: string;
  body: string;
  facts: string[];
}

export interface PublicReportContentSummary {
  body: string;
  chips: string[];
}

export const PUBLIC_SEO_PATHS = {
  home: '/',
  fullRanking: '/rankings/all',
  methodology: '/methodology',
  apply: '/apply',
  riskMonitor: '/risk-monitor',
} as const;

export const PUBLIC_SEO_STATIC_LASTMOD = '2026-05-17T00:00:00+08:00';

export const PUBLIC_FRONTEND_ASSETS = {
  script: '/assets/index.js?v=20260515-ranking-url-clean',
  stylesheet: '/assets/index.css?v=20260515-methodology-fast',
} as const;

export function buildHomeSeo(input?: {
  dateLabel?: string;
  monitoredAirports?: number;
  realtimeTests?: number;
}): PublicSeoText {
  return {
    title: `${PUBLIC_SITE_BRAND_NAME} | 机场 VPN 推荐、科学上网机场测评与可靠性榜单`,
    description:
      input && typeof input.monitoredAirports === 'number' && typeof input.realtimeTests === 'number'
        ? `${input.dateLabel || '今日'} 机场 VPN 榜单已更新，当前监测 ${formatCount(input.monitoredAirports)} 个机场、累计实时测速 ${formatCount(input.realtimeTests)} 次，覆盖今日推荐、长期稳定、性价比、新入榜与风险预警，适合查找 VPN、科学上网、魔法与梯子相关机场参考。`
        : `${PUBLIC_SITE_BRAND_NAME} 提供今日推荐、长期稳定、性价比与风险预警等多维机场 VPN 榜单，帮助用户快速筛选值得关注的 VPN、科学上网、魔法和梯子测评报告。`,
    keywords: '机场榜GateRank,机场榜,机场推荐,机场VPN,VPN,科学上网,魔法,梯子,今日推荐机场,机场测评,稳定机场,风险预警,GateRank',
  };
}

export function buildFullRankingSeo(input?: {
  dateLabel?: string;
  total?: number;
}): PublicSeoText {
  return {
    title: `全量机场榜单 | 全部已上线机场评分排名 | ${PUBLIC_SITE_BRAND_NAME}`,
    description:
      input && typeof input.total === 'number'
        ? `${input.dateLabel || '今日'} 全量榜单收录 ${formatCount(input.total)} 个已上线机场，按公开展示分数降序排列，支持分页查看官网入口、状态、标签、成立日期、月付价格、试用支持与测评报告。`
        : `${PUBLIC_SITE_BRAND_NAME} 全量榜单按公开展示分数降序展示全部已上线机场，包含官网入口、状态、标签、月付价格、试用支持和测评报告入口。`,
    keywords: '机场榜GateRank,全量榜单,机场排名,机场排行榜,机场推荐,机场测评,机场官网,风险机场,GateRank',
  };
}

export function buildRiskMonitorSeo(input?: {
  dateLabel?: string;
  total?: number;
}): PublicSeoText {
  return {
    title: `跑路监测 | 已跑路与风险观察机场列表 | ${PUBLIC_SITE_BRAND_NAME}`,
    description:
      input && typeof input.total === 'number'
        ? `${input.dateLabel || '今日'} ${PUBLIC_SITE_BRAND_NAME} 跑路机场监测页收录 ${formatCount(input.total)} 个已确认跑路、风险观察与异常波动机场，结合评分变化、官网状态、测速数据和风险标签，帮助用户避开高风险机场 VPN 服务。`
        : `${PUBLIC_SITE_BRAND_NAME} 跑路机场监测页汇总已确认跑路、风险观察与异常波动机场，结合评分变化、官网状态、测速数据与风险标签，帮助用户避开高风险机场 VPN 服务。`,
    keywords: '机场榜GateRank,跑路监测,风险观察,机场风险,高风险机场,已跑路机场,GateRank',
  };
}

export function buildReportSeo(input?: PublicReportSeoView): PublicSeoText {
  const airportName = input?.airport.name;
  const statusLabel = input ? formatAirportStatusLabel(input.airport.status) : undefined;
  const airportKeywords = airportName
    ? `${airportName}怎么样,${airportName}测评,${airportName}跑路,${airportName}官网,${airportName}机场测评,`
    : '';
  return {
    title: airportName
      ? `${airportName} 测评报告 | ${PUBLIC_SITE_BRAND_NAME}`
      : `机场测评报告 | ${PUBLIC_SITE_BRAND_NAME}`,
    description:
      input && airportName && typeof input.summary_card.score === 'number' && statusLabel
        ? buildReportDescription(input, airportName, statusLabel)
        : `${PUBLIC_SITE_BRAND_NAME} 测评报告页展示单个机场的榜单位置、评分拆解、关键指标与 30 天趋势。`,
    keywords: `${airportKeywords}机场榜GateRank,机场测评报告,机场评分,机场趋势,机场榜,机场推荐,机场官网,跑路风险,GateRank`,
  };
}

function buildReportDescription(view: PublicReportSeoView, airportName: string, statusLabel: string): string {
  const score = formatMetric(view.summary_card.score);
  const website = view.airport.website || '未收录';
  const riskText =
    view.airport.status === 'down'
      ? '已标记跑路风险'
      : view.airport.status === 'risk'
        ? '存在风险观察'
        : `风险惩罚 ${formatMetric(view.score_breakdown.risk_penalty)}`;
  const trendText = buildReportTrendText(view);

  return `${airportName}机场测评：当前分数 ${score}，状态${statusLabel}，官网为 ${website}。报告结合${riskText}、${trendText}和稳定性数据，帮助判断${airportName}是否适合作为机场 VPN 选择。`;
}

function buildReportTrendText(view: PublicReportSeoView): string {
  const scoreTrend = view.trends.score_30d;
  if (scoreTrend.length >= 2) {
    const first = scoreTrend[0]?.value;
    const last = scoreTrend[scoreTrend.length - 1]?.value;
    if (typeof first === 'number' && typeof last === 'number') {
      const delta = last - first;
      const direction = delta > 0 ? '上升' : delta < 0 ? '下降' : '持平';
      return `30 天趋势${direction}`;
    }
  }
  return '30 天趋势';
}

export function buildReportFaqItems(view: PublicReportSeoView): PublicReportFaqItem[] {
  const airportName = view.airport.name;
  const statusLabel = formatAirportStatusLabel(view.airport.status);
  const riskAnswer = buildReportRiskAnswer(view);
  const planText = buildPlanSummaryText(view);
  const regionText = buildRegionSummaryText(view);
  const clientText = buildListSummary(view.capabilities.clients, '客户端未收录');

  return [
    {
      question: `${airportName}怎么样？`,
      answer: `${airportName} 当前公开分数 ${formatMetric(view.summary_card.score)}，状态为${statusLabel}。GateRank 当前报告结论为：${view.summary_card.conclusion}`,
    },
    {
      question: `${airportName}测评怎么看？`,
      answer: `${airportName} 测评主要看榜单位置、稳定性 S=${formatMetric(view.score_breakdown.s)}、性能 P=${formatMetric(view.score_breakdown.p)}、价格 C=${formatMetric(view.score_breakdown.c)}、风险 R=${formatMetric(view.score_breakdown.r)}，以及 30 天可用率 ${formatMetric(view.metrics.uptime_percent_30d)}%、中位延迟 ${formatMetric(view.metrics.median_latency_ms)} ms、下载速率 ${formatMetric(view.metrics.median_download_mbps)} Mbps。`,
    },
    {
      question: `${airportName}官网是什么？`,
      answer: `${airportName} 在 GateRank 当前记录中的官网入口为 ${view.airport.website}。访问前建议同时查看本页的状态、风险惩罚、投诉记录和历史异常。`,
    },
    {
      question: `${airportName}跑路风险高吗？`,
      answer: riskAnswer,
    },
    {
      question: `${airportName}适合长期使用吗？`,
      answer: `${airportName} 当前分数为 ${formatMetric(view.summary_card.score)}，稳定性评级为${formatStabilityTierLabel(view.metrics.stability_tier)}，健康记录 ${view.metrics.healthy_days_streak} 天。是否长期使用仍建议结合官网可达性、30 天趋势、套餐价格和风险扣分一起判断。`,
    },
    {
      question: `${airportName}风险主要来自哪里？`,
      answer: `${airportName} 当前风险惩罚为 ${formatMetric(view.score_breakdown.risk_penalty)}，其中官网探测扣分 ${formatMetric(view.score_breakdown.domain_penalty)}、SSL 扣分 ${formatMetric(view.score_breakdown.ssl_penalty)}、投诉扣分 ${formatMetric(view.score_breakdown.complaint_penalty)}、历史异常扣分 ${formatMetric(view.score_breakdown.history_penalty)}。`,
    },
    {
      question: `${airportName}支持哪些套餐、客户端和地区？`,
      answer: `${airportName} 套餐情况：${planText}。客户端支持：${clientText}。节点覆盖：${regionText}。`,
    },
  ];
}

export function buildReportContentSections(view: PublicReportSeoView): PublicReportContentSection[] {
  const airportName = view.airport.name;
  const statusLabel = formatAirportStatusLabel(view.airport.status);
  const score = formatMetric(view.summary_card.score);
  const trendText = buildReportTrendText(view);
  const scoreDeltaText = buildTrendDeltaText(view.trends.score_30d, '分');
  const uptimeTrendText = buildTrendDeltaText(view.trends.uptime_30d, '个百分点');
  const latencyTrendText = buildTrendDeltaText(view.trends.latency_30d, ' ms');
  const downloadTrendText = buildTrendDeltaText(view.trends.download_30d, ' Mbps');
  const planText = buildPlanSummaryText(view);
  const regionText = buildRegionSummaryText(view);
  const clientText = buildListSummary(view.capabilities.clients, '客户端未收录');
  const streamingText = buildListSummary(view.capabilities.streaming, '解锁能力未收录');
  const importText = buildListSummary(view.capabilities.import_methods, '导入方式未收录');
  const paymentText = buildListSummary(view.capabilities.payment_methods, '支付方式未收录');
  const telegramText = buildTelegramSummaryText(view);

  return [
    {
      title: '综合结论',
      body: `${airportName} 当前 GateRank 公开分数为 ${score}/100，状态为${statusLabel}。本页把 ${airportName} 机场测评拆成评分、风险、稳定性、性能、套餐、节点和售后信息，适合在选择机场 VPN 前做事实核对。${view.summary_card.conclusion}`,
      facts: [
        `数据日期 ${view.date}`,
        `30 天趋势${trendText.replace(/^30 天趋势/, '') || '持平'}`,
        `综合评级 ${buildScoreGradeText(view.summary_card.score)}`,
      ],
    },
    {
      title: '风险解读',
      body: `${airportName} 当前风险惩罚为 ${formatMetric(view.score_breakdown.risk_penalty)}，风险维度得分 R=${formatMetric(view.score_breakdown.r)}。细分来看，官网探测扣分 ${formatMetric(view.score_breakdown.domain_penalty)}，SSL 扣分 ${formatMetric(view.score_breakdown.ssl_penalty)}，投诉扣分 ${formatMetric(view.score_breakdown.complaint_penalty)}，历史异常扣分 ${formatMetric(view.score_breakdown.history_penalty)}；近期投诉 ${view.metrics.recent_complaints_count} 条，历史异常 ${view.metrics.history_incidents} 次。`,
      facts: [
        `状态 ${statusLabel}`,
        `风险惩罚 ${formatMetric(view.score_breakdown.risk_penalty)}`,
        `官网探测扣分 ${formatMetric(view.score_breakdown.domain_penalty)}`,
        `SSL 扣分 ${formatMetric(view.score_breakdown.ssl_penalty)}`,
      ],
    },
    {
      title: '稳定性与性能',
      body: `${airportName} 近 30 天可用率为 ${formatMetric(view.metrics.uptime_percent_30d)}%，稳定性评级为${formatStabilityTierLabel(view.metrics.stability_tier)}，健康记录 ${view.metrics.healthy_days_streak} 天。性能侧的中位延迟为 ${formatMetric(view.metrics.median_latency_ms)} ms，下载速率为 ${formatMetric(view.metrics.median_download_mbps)} Mbps，丢包率为 ${formatMetric(view.metrics.packet_loss_percent)}%。趋势上，评分${scoreDeltaText}，可用率${uptimeTrendText}，延迟${latencyTrendText}，下载${downloadTrendText}。`,
      facts: [
        `30 天可用率 ${formatMetric(view.metrics.uptime_percent_30d)}%`,
        `中位延迟 ${formatMetric(view.metrics.median_latency_ms)} ms`,
        `下载速率 ${formatMetric(view.metrics.median_download_mbps)} Mbps`,
        `丢包率 ${formatMetric(view.metrics.packet_loss_percent)}%`,
      ],
    },
    {
      title: '套餐与试用',
      body: `${airportName} 的套餐信息显示：${planText}。最低月付价格为 ${formatOptionalCurrencyText(view.capabilities.plan.lowest_monthly_price)}，最低年付折算月价为 ${formatOptionalCurrencyText(view.capabilities.plan.lowest_annual_monthly_price)}，支付方式当前记录为 ${paymentText}。`,
      facts: [
        `月付 ${formatNullableSupportText(view.capabilities.plan.supports_monthly)}`,
        `年付 ${formatNullableSupportText(view.capabilities.plan.supports_annual)}`,
        `试用 ${formatNullableSupportText(view.capabilities.plan.has_trial_plan)}`,
        `支付方式 ${paymentText}`,
      ],
    },
    {
      title: '节点、客户端与解锁',
      body: `${airportName} 当前节点覆盖记录为 ${regionText}。客户端支持记录为 ${clientText}，导入方式为 ${importText}，解锁能力包括 ${streamingText}。这些信息用于判断日常使用、跨区访问和新手配置成本，不代表所有节点在任意时间都保持同等表现。`,
      facts: [
        `地区 ${regionText}`,
        `客户端 ${clientText}`,
        `导入 ${importText}`,
        `解锁 ${streamingText}`,
      ],
    },
    {
      title: 'Telegram 与售后',
      body: `${airportName} 的售后与社区记录显示：${telegramText}。如果准备购买或续费，建议先核对官网入口、Telegram 活跃度、订阅可用性和本页风险记录，再决定是否长期使用。`,
      facts: [
        `Telegram 群 ${formatNullableSupportText(view.capabilities.telegram.has_group)}`,
        `Telegram 频道 ${formatNullableSupportText(view.capabilities.telegram.has_channel)}`,
        `客服 Bot ${formatNullableSupportText(view.capabilities.telegram.has_customer_service_bot)}`,
        `工单系统 ${formatNullableSupportText(view.capabilities.telegram.has_ticket_system)}`,
      ],
    },
  ];
}

export function buildReportContentSummary(view: PublicReportSeoView): PublicReportContentSummary {
  const airportName = view.airport.name;
  const statusLabel = formatAirportStatusLabel(view.airport.status);
  return {
    body: `${airportName} 当前公开分数 ${formatMetric(view.summary_card.score)}/100，状态为${statusLabel}。本页汇总风险、稳定性、性能、套餐、节点和售后事实；详细解读已折叠保留，可展开核对。`,
    chips: [
      `分数 ${formatMetric(view.summary_card.score)}`,
      `状态 ${statusLabel}`,
      `风险惩罚 ${formatMetric(view.score_breakdown.risk_penalty)}`,
      `官网扣分 ${formatMetric(view.score_breakdown.domain_penalty)}`,
      `SSL 扣分 ${formatMetric(view.score_breakdown.ssl_penalty)}`,
      `30 天可用率 ${formatMetric(view.metrics.uptime_percent_30d)}%`,
      `中位延迟 ${formatMetric(view.metrics.median_latency_ms)} ms`,
      `试用 ${formatNullableSupportText(view.capabilities.plan.has_trial_plan)}`,
    ],
  };
}

export function buildReportStructuredData(
  siteUrl: string,
  canonicalPath: string,
  seo: PublicSeoText,
  view: PublicReportSeoView,
): Array<Record<string, unknown>> {
  const canonicalUrl = `${siteUrl}${canonicalPath}`;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: seo.title,
      description: seo.description,
      url: canonicalUrl,
      about: {
        '@type': 'Thing',
        name: view.airport.name,
        url: view.airport.website,
        additionalProperty: [
          buildPropertyValue('公开分数', formatMetric(view.summary_card.score)),
          buildPropertyValue('状态', formatAirportStatusLabel(view.airport.status)),
          buildPropertyValue('数据日期', view.date),
          buildPropertyValue('30天可用率', `${formatMetric(view.metrics.uptime_percent_30d)}%`),
          buildPropertyValue('风险惩罚', formatMetric(view.score_breakdown.risk_penalty)),
          buildPropertyValue('官网探测扣分', formatMetric(view.score_breakdown.domain_penalty)),
          buildPropertyValue('SSL扣分', formatMetric(view.score_breakdown.ssl_penalty)),
          buildPropertyValue('投诉扣分', formatMetric(view.score_breakdown.complaint_penalty)),
          buildPropertyValue('历史异常扣分', formatMetric(view.score_breakdown.history_penalty)),
          buildPropertyValue('稳定性评级', formatStabilityTierLabel(view.metrics.stability_tier)),
          buildPropertyValue('中位延迟', `${formatMetric(view.metrics.median_latency_ms)} ms`),
          buildPropertyValue('下载速率', `${formatMetric(view.metrics.median_download_mbps)} Mbps`),
          buildPropertyValue('套餐信息', buildPlanSummaryText(view)),
          buildPropertyValue('节点地区', buildRegionSummaryText(view)),
          buildPropertyValue('客户端支持', buildListSummary(view.capabilities.clients, '客户端未收录')),
          buildPropertyValue('售后支持', buildTelegramSummaryText(view)),
        ],
      },
    },
    buildBreadcrumbJsonLd(siteUrl, [
      ['首页', '/'],
      [view.airport.name, canonicalPath],
    ]),
    buildReportRankingItemList(siteUrl, view),
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: buildReportFaqItems(view).map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    },
  ];
}

export const METHODOLOGY_SEO: PublicSeoText = {
  title: `测评方法 | 机场评分规则、权重与风险扣分说明 | ${PUBLIC_SITE_BRAND_NAME}`,
  description: `${PUBLIC_SITE_BRAND_NAME} 测评方法页公开解释机场 VPN 评分规则，拆解稳定性、性能、价格、风险四个维度，以及时间衰减、风险扣分、数据采样和最终分数如何影响机场推荐与排名。`,
  keywords: '机场榜GateRank,机场测评方法,机场测速标准,机场评分规则,机场推荐依据,VPN机场测评,机场榜,GateRank',
};

export const APPLY_SEO: PublicSeoText = {
  title: `申请入驻测试 | ${PUBLIC_SITE_BRAND_NAME}`,
  description: `${PUBLIC_SITE_BRAND_NAME} 申请入驻测试页用于提交机场基础信息、官网地址、测试账号、订阅资料与联系方式，供后台完成资料审核、支付确认、自动测速接入、流程管理和后续运营沟通。`,
  keywords: '机场榜GateRank,申请入驻测试,机场申请,机场收录,机场测试资料,GateRank',
};

export function buildReportPath(airportId: number, date?: string): string {
  return `/reports/${airportId}${buildQuery({ date })}`;
}

export function buildAirportReportPath(slug: string): string {
  return `/airports/${normalizeAirportSlug(slug)}`;
}

export function normalizeAirportSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160)
    .replace(/-+$/g, '');
}

export function buildAirportSlugCandidate(input: { name?: string | null; website?: string | null }): string {
  const websiteSlug = slugFromWebsite(input.website || '');
  if (websiteSlug) {
    return websiteSlug;
  }
  return normalizeAirportSlug(input.name || '');
}

function slugFromWebsite(website: string): string {
  const raw = website.trim();
  if (!raw) {
    return '';
  }

  try {
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    const hostname = new URL(withProtocol).hostname
      .replace(/^www\./i, '')
      .replace(/\.$/, '');
    const parts = hostname.split('.').filter(Boolean);
    if (parts.length >= 2) {
      return normalizeAirportSlug(parts.slice(0, -1).join('-'));
    }
    return normalizeAirportSlug(hostname);
  } catch {
    return normalizeAirportSlug(raw);
  }
}

export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

export function formatAirportStatusLabel(status: string): string {
  if (status === 'normal') return '正常';
  if (status === 'risk') return '风险';
  if (status === 'down') return '跑路';
  return status;
}

export function formatMetric(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function buildListSummary(items: Array<{ label: string }>, emptyLabel: string, limit = 6): string {
  if (items.length === 0) {
    return emptyLabel;
  }
  const labels = items.slice(0, limit).map((item) => item.label);
  const suffix = items.length > limit ? `等 ${items.length} 项` : '';
  return `${labels.join('、')}${suffix}`;
}

function buildPlanSummaryText(view: PublicReportSeoView): string {
  const plan = view.capabilities.plan;
  const parts = [
    `月付${formatNullableSupportText(plan.supports_monthly)}`,
    `季付${formatNullableSupportText(plan.supports_quarterly)}`,
    `半年付${formatNullableSupportText(plan.supports_half_yearly)}`,
    `年付${formatNullableSupportText(plan.supports_annual)}`,
    `试用${formatNullableSupportText(plan.has_trial_plan)}`,
    `不限时套餐${formatNullableSupportText(plan.has_lifetime_plan)}`,
  ];
  return parts.join('，');
}

function buildRegionSummaryText(view: PublicReportSeoView): string {
  const regions = view.capabilities.regions;
  if (regions.length === 0) {
    return '节点地区未收录';
  }
  const labels = regions.slice(0, 5).map((region) => {
    const lineTypes = region.line_types.length > 0 ? ` ${region.line_types.join('/')}` : '';
    const nativeIp = region.has_native_ip ? ' 原生IP' : '';
    const residential = region.has_residential ? ' 家宽' : '';
    return `${region.label}${lineTypes}${nativeIp}${residential}`;
  });
  return `${labels.join('、')}${regions.length > 5 ? `等 ${regions.length} 个地区` : ''}`;
}

function buildTelegramSummaryText(view: PublicReportSeoView): string {
  const telegram = view.capabilities.telegram;
  const memberText = telegram.group_member_count === null ? '群人数未收录' : `群人数 ${formatCount(telegram.group_member_count)} 人`;
  const activeText = telegram.recent_active_at ? `最近活跃 ${telegram.recent_active_at}` : '最近活跃时间未收录';
  return [
    `Telegram 群${formatNullableSupportText(telegram.has_group)}`,
    `频道${formatNullableSupportText(telegram.has_channel)}`,
    `群内发言${formatNullableSupportText(telegram.group_allows_speaking)}`,
    `客服 Bot ${formatNullableSupportText(telegram.has_customer_service_bot)}`,
    `工单系统${formatNullableSupportText(telegram.has_ticket_system)}`,
    memberText,
    activeText,
  ].join('，');
}

function buildTrendDeltaText(points: Array<{ value: number }>, unit: string): string {
  if (points.length < 2) {
    return '暂无足够 30 天趋势样本';
  }
  const first = points[0]?.value;
  const last = points[points.length - 1]?.value;
  if (typeof first !== 'number' || typeof last !== 'number') {
    return '暂无足够 30 天趋势样本';
  }
  const delta = last - first;
  if (delta > 0) {
    return `上升 ${formatMetric(delta)}${unit}`;
  }
  if (delta < 0) {
    return `下降 ${formatMetric(Math.abs(delta))}${unit}`;
  }
  return '持平';
}

function formatNullableSupportText(value: boolean | null | undefined): string {
  if (value === true) return '支持';
  if (value === false) return '不支持';
  return '未收录';
}

function formatOptionalCurrencyText(value: number | null | undefined): string {
  return value === null || value === undefined ? '未收录' : `¥${formatMetric(value)}`;
}

function formatStabilityTierLabel(tier: string): string {
  if (tier === 'stable') return '稳定';
  if (tier === 'minor_fluctuation') return '轻微波动';
  if (tier === 'unstable') return '波动';
  if (tier === 'unknown') return '未收录';
  return tier;
}

function buildScoreGradeText(score: number): string {
  if (score >= 90) return '优秀';
  if (score >= 80) return '稳健';
  if (score >= 70) return '可观察';
  if (score >= 60) return '谨慎';
  return '高风险';
}

function buildReportRiskAnswer(view: PublicReportSeoView): string {
  const airportName = view.airport.name;
  const statusLabel = formatAirportStatusLabel(view.airport.status);
  const riskPenalty = formatMetric(view.score_breakdown.risk_penalty);
  const complaintCount = view.metrics.recent_complaints_count;
  const historyIncidents = view.metrics.history_incidents;

  if (view.airport.status === 'down') {
    return `${airportName} 当前状态为${statusLabel}，GateRank 已将其纳入高风险记录。当前风险惩罚为 ${riskPenalty}，近期投诉 ${complaintCount} 条，历史异常 ${historyIncidents} 次。`;
  }
  if (view.airport.status === 'risk') {
    return `${airportName} 当前状态为${statusLabel}，需要结合风险惩罚、近期投诉和历史异常判断。当前风险惩罚为 ${riskPenalty}，近期投诉 ${complaintCount} 条，历史异常 ${historyIncidents} 次。`;
  }
  return `${airportName} 当前状态为${statusLabel}，未被标记为跑路。当前风险惩罚为 ${riskPenalty}，近期投诉 ${complaintCount} 条，历史异常 ${historyIncidents} 次；这只是当前监测结果，不代表未来没有风险。`;
}

function buildPropertyValue(name: string, value: string): Record<string, string> {
  return {
    '@type': 'PropertyValue',
    name,
    value,
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

function buildReportRankingItemList(siteUrl: string, view: PublicReportSeoView): Record<string, unknown> {
  const rankingPairs: Array<[string, number | null]> = [
    ['今日推荐', view.ranking.today_pick_rank],
    ['长期稳定', view.ranking.most_stable_rank],
    ['性价比', view.ranking.best_value_rank],
    ['新入榜', view.ranking.new_entries_rank],
    ['风险预警', view.ranking.risk_alerts_rank],
  ];
  const rankingItems = rankingPairs.filter((item): item is [string, number] => typeof item[1] === 'number');

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${view.airport.name} 榜单位置`,
    numberOfItems: rankingItems.length,
    itemListElement: rankingItems.map(([name, rank], index) => ({
      '@type': 'ListItem',
      position: rank,
      name,
      item: `${siteUrl}${buildAirportReportPath(view.airport.slug)}`,
      additionalType: index === 0 ? 'today_pick' : undefined,
    })),
  };
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}
