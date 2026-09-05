import type { IpPurityGeo } from './ipPurity';
const countries = new Intl.DisplayNames(['zh-CN'], { type: 'region' });
// Localize names only; never assign a city based on an ASN or a brand.
const cities: Record<string, string> = { Fremont: '弗里蒙特', 'San Francisco': '旧金山', 'Los Angeles': '洛杉矶', 'San Jose': '圣何塞', 'San Diego': '圣迭戈', Sacramento: '萨克拉门托' };
export function ipLocationDisplay(geo: IpPurityGeo | null): string {
  if (!geo) return '';
  const country = /^[A-Z]{2}$/.test(geo.country_code) ? countries.of(geo.country_code) : geo.country;
  const california = geo.country_code === 'US' && (geo.region === 'CA' || geo.region_name === 'California');
  const region = california ? '加利福尼亚州' : geo.region_name;
  const city = california ? cities[geo.city] || geo.city : geo.city;
  return [country, region, city].filter(Boolean).join(' · ');
}
export function ipProviderBrand(geo: IpPurityGeo | null): string | null {
  // BandwagonHost identifies itself as IT7 Networks Inc.: https://bandwagonhost.com/news?id=238
  return geo?.asn === 'AS25820' && /^IT7 Networks Inc\.?$/i.test(geo.isp.trim()) ? '搬瓦工（BandwagonHost）' : null;
}
