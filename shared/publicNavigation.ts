export type PublicNavigationKind = 'home' | 'full_ranking' | 'deals' | 'risk_monitor' | 'methodology' | 'news';

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
    label: '全量榜单',
    href: '/rankings/all',
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
    kind: 'methodology',
    label: '测评方法',
    href: '/methodology',
  },
  {
    kind: 'news',
    label: 'News',
    href: '/news',
  },
];
