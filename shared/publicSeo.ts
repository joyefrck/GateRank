import { PUBLIC_SITE_BRAND_NAME } from './publicBrand';

export interface PublicSeoText {
  title: string;
  description: string;
  keywords: string;
}

export const PUBLIC_SEO_PATHS = {
  home: '/',
  fullRanking: '/rankings/all',
  methodology: '/methodology',
  apply: '/apply',
  riskMonitor: '/risk-monitor',
} as const;

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
        ? `${input.dateLabel || '今日'} 跑路监测当前收录 ${formatCount(input.total)} 个机场，覆盖管理员确认跑路与命中风险观察标签的对象，默认将已跑路机场置顶展示。`
        : `${PUBLIC_SITE_BRAND_NAME} 跑路监测页汇总管理员确认跑路与命中风险观察标签的机场，帮助用户快速识别高风险对象。`,
    keywords: '机场榜GateRank,跑路监测,风险观察,机场风险,高风险机场,已跑路机场,GateRank',
  };
}

export function buildReportSeo(input?: {
  airportName?: string;
  score?: number;
  statusLabel?: string;
}): PublicSeoText {
  return {
    title: input?.airportName
      ? `${input.airportName} 测评报告 | ${PUBLIC_SITE_BRAND_NAME}`
      : `机场测评报告 | ${PUBLIC_SITE_BRAND_NAME}`,
    description:
      input?.airportName && typeof input.score === 'number' && input.statusLabel
        ? `${input.airportName} 当前公开分数 ${formatMetric(input.score)}，状态为${input.statusLabel}。报告包含榜单位置、评分拆解、关键指标与 30 天趋势。`
        : `${PUBLIC_SITE_BRAND_NAME} 测评报告页展示单个机场的榜单位置、评分拆解、关键指标与 30 天趋势。`,
    keywords: '机场榜GateRank,机场测评报告,机场评分,机场趋势,机场榜,GateRank',
  };
}

export const METHODOLOGY_SEO: PublicSeoText = {
  title: `测评方法 | 机场评分规则、权重与风险扣分说明 | ${PUBLIC_SITE_BRAND_NAME}`,
  description: `${PUBLIC_SITE_BRAND_NAME} 测评方法页公开解释机场评分规则，拆解稳定性、性能、价格、风险四个维度，以及时间衰减、风险扣分与最终分数如何计算。`,
  keywords: '机场榜GateRank,机场测评方法,机场测速标准,机场评分规则,机场推荐依据,VPN机场测评,机场榜,GateRank',
};

export const APPLY_SEO: PublicSeoText = {
  title: `申请入驻测试 | ${PUBLIC_SITE_BRAND_NAME}`,
  description: `${PUBLIC_SITE_BRAND_NAME} 申请入驻测试页用于提交机场基础信息、测试资料与联系方式，供后台审核与后续联系使用。`,
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

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}
