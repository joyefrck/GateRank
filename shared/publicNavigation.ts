export type PublicNavigationKind = 'home' | 'full_ranking' | 'monthly_reports' | 'deals' | 'risk_monitor' | 'methodology' | 'news';

export interface PublicNavigationItem {
  kind: PublicNavigationKind;
  label: string;
  href: string;
  badge?: string;
}

export const PUBLIC_NAVIGATION_ITEMS: PublicNavigationItem[] = [
  {
    kind: 'home',
    label: '今日推荐',
    href: '/',
  },
  {
    kind: 'full_ranking',
    label: '机场排行',
    href: '/rankings/all',
  },
  {
    kind: 'monthly_reports',
    label: '月度报告',
    href: '/monthly-reports',
  },
  {
    kind: 'deals',
    label: '活动优惠',
    href: '/deals',
  },
  {
    kind: 'risk_monitor',
    label: '跑路监测',
    href: '/risk-monitor',
    badge: '快照',
  },
  {
    kind: 'news',
    label: 'News',
    href: '/news',
  },
];
