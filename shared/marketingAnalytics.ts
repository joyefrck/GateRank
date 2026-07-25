export const MARKETING_PAGE_KIND_LABELS = {
  home: '首页',
  full_ranking: '全量榜单',
  risk_monitor: '跑路监测',
  report: '机场报告',
  deals: '活动优惠',
  methodology: '测评方法',
  news: 'News',
  apply: '申请页',
  publish_token_docs: '发布文档',
  monthly_reports: '月报中心',
  monthly_report: '月报详情',
  ranking_transparency: '排名独立性声明',
  tools_download: '工具下载',
  streaming_check: '流媒体检测',
  ip_check: 'IP 检测',
  dns_leak_test: 'DNS 泄漏检测',
  for_ai: 'AI 数据入口',
} as const;

export type MarketingPageKind = keyof typeof MARKETING_PAGE_KIND_LABELS;

export const MARKETING_PAGE_KINDS = Object.freeze(
  Object.keys(MARKETING_PAGE_KIND_LABELS) as MarketingPageKind[],
);

export function isMarketingPageKind(value: unknown): value is MarketingPageKind {
  return typeof value === 'string'
    && Object.prototype.hasOwnProperty.call(MARKETING_PAGE_KIND_LABELS, value);
}

export function getMarketingPageKindLabel(value: string): string {
  return isMarketingPageKind(value)
    ? MARKETING_PAGE_KIND_LABELS[value]
    : value;
}
