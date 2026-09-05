import type { MarketingPageKind } from '../../shared/marketingAnalytics';

export type AppRouteKind =
  | 'home'
  | 'report'
  | 'apply'
  | 'portal'
  | 'full_ranking'
  | 'monthly_reports'
  | 'monthly_report'
  | 'deals'
  | 'deal_detail'
  | 'risk_monitor'
  | 'methodology'
  | 'ranking_transparency'
  | 'publish_token_docs'
  | 'tools_index'
  | 'tools_download'
  | 'streaming_check'
  | 'ip_purity'
  | 'ip_check'
  | 'dns_leak_test'
  | 'not_found';

export const MARKETING_PAGE_KIND_BY_ROUTE = {
  home: 'home',
  report: 'report',
  apply: 'apply',
  portal: null,
  full_ranking: 'full_ranking',
  monthly_reports: 'monthly_reports',
  monthly_report: 'monthly_report',
  deals: 'deals',
  deal_detail: 'deals',
  risk_monitor: 'risk_monitor',
  methodology: 'methodology',
  ranking_transparency: 'ranking_transparency',
  publish_token_docs: 'publish_token_docs',
  tools_index: 'tools_index',
  tools_download: 'tools_download',
  streaming_check: 'streaming_check',
  ip_check: 'ip_check',
  ip_purity: 'ip_purity',
  dns_leak_test: 'dns_leak_test',
  not_found: null,
} as const satisfies Record<AppRouteKind, MarketingPageKind | null>;

export function toMarketingPageKind(routeKind: AppRouteKind): MarketingPageKind | null {
  return MARKETING_PAGE_KIND_BY_ROUTE[routeKind];
}
