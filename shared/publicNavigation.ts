import {
  PUBLIC_TOOL_DEFINITIONS,
  PUBLIC_TOOLS_INDEX_PATH,
} from './publicTools';

export type PublicNavigationKind = 'home' | 'full_ranking' | 'monthly_reports' | 'deals' | 'risk_monitor' | 'tools' | 'methodology' | 'news';

export interface PublicNavigationItem {
  kind: PublicNavigationKind;
  label: string;
  href?: string;
  badge?: string;
  children?: Array<{
    label: string;
    href: string;
    badge?: string;
  }>;
}

export const PUBLIC_NAVIGATION_ITEMS: PublicNavigationItem[] = [
  {
    kind: 'home',
    label: '首页',
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
    kind: 'methodology',
    label: '测评方法',
    href: '/methodology',
  },
  {
    kind: 'tools',
    label: '工具',
    href: PUBLIC_TOOLS_INDEX_PATH,
    children: PUBLIC_TOOL_DEFINITIONS.map(({ label, href }) => ({ label, href })),
  },
  {
    kind: 'news',
    label: 'News',
    href: '/news',
  },
];
