import { PUBLIC_SITE_BRAND_NAME } from './publicBrand';

export interface AirportDirectoryView {
  date: string;
  items: Array<{ name: string; path: string }>;
}

export const AIRPORT_DIRECTORY_SEO = {
  title: `机场大全 | 机场官网、测评与稳定性报告索引 | ${PUBLIC_SITE_BRAND_NAME}`,
  description: '按名称浏览已收录的机场测评报告，查找机场官网入口、套餐价格、稳定性、速度与风险记录。历史报告保留数据日期，便于核对。',
  keywords: '机场大全,机场索引,机场官网,机场测评,机场怎么样,机场稳定性,GateRank',
};

export function buildAirportDirectoryStructuredData(siteUrl: string, view: AirportDirectoryView) {
  return [
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: AIRPORT_DIRECTORY_SEO.title, url: `${siteUrl}/airports` },
    {
      '@context': 'https://schema.org', '@type': 'ItemList', numberOfItems: view.items.length,
      itemListElement: view.items.map((item, i) => ({
        '@type': 'ListItem', position: i + 1, name: item.name, url: `${siteUrl}${item.path}`,
      })),
    },
  ];
}
