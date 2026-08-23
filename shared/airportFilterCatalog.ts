import { NODE_REGION_CATALOG } from './nodeRegionCatalog';

export type AirportFilterCategory =
  | 'payment'
  | 'streaming'
  | 'client'
  | 'import'
  | 'region'
  | 'line';

export interface AirportFilterOption {
  key: string;
  label: string;
  seoLabel: string;
  indexable?: boolean;
}

export interface AirportRegionFilterOption extends AirportFilterOption {
  regionCode: string;
}

export const AIRPORT_PAYMENT_FILTERS: AirportFilterOption[] = [
  { key: 'wechat', label: '微信', seoLabel: '支持微信支付' },
  { key: 'alipay', label: '支付宝', seoLabel: '支持支付宝' },
  { key: 'usdt_trc20', label: 'USDT-TRC20', seoLabel: '支持 USDT-TRC20' },
  { key: 'usdt_erc20', label: 'USDT-ERC20', seoLabel: '支持 USDT-ERC20' },
  { key: 'usdt_bep20', label: 'USDT-BEP20', seoLabel: '支持 USDT-BEP20' },
  { key: 'stripe_card', label: '银行卡', seoLabel: '支持银行卡' },
  { key: 'paypal', label: 'PayPal', seoLabel: '支持 PayPal' },
  { key: 'crypto_other', label: '其他加密货币', seoLabel: '支持加密货币' },
  { key: 'unionpay', label: '银联', seoLabel: '支持银联' },
];

export const AIRPORT_STREAMING_FILTERS: AirportFilterOption[] = [
  { key: 'netflix', label: 'Netflix', seoLabel: '支持 Netflix' },
  { key: 'chatgpt', label: 'ChatGPT', seoLabel: '支持 ChatGPT' },
  { key: 'disney_plus', label: 'Disney+', seoLabel: '支持 Disney+' },
  { key: 'hbo_max', label: 'HBO Max', seoLabel: '支持 HBO Max' },
  { key: 'youtube_premium', label: 'YouTube Premium', seoLabel: '支持 YouTube Premium' },
  { key: 'tiktok', label: 'TikTok', seoLabel: '支持 TikTok' },
  { key: 'spotify', label: 'Spotify', seoLabel: '支持 Spotify' },
];

export const AIRPORT_CLIENT_FILTERS: AirportFilterOption[] = [
  { key: 'self_built_client', label: '自建客户端', seoLabel: '自建客户端' },
  { key: 'clash', label: 'Clash', seoLabel: '支持 Clash' },
  { key: 'clash_verge', label: 'Clash Verge', seoLabel: '支持 Clash Verge' },
  { key: 'clash_mi', label: 'Clash Mi', seoLabel: '支持 Clash Mi' },
  { key: 'clash_party', label: 'Clash Party', seoLabel: '支持 Clash Party' },
  { key: 'shadowrocket', label: 'Shadowrocket', seoLabel: '支持 Shadowrocket' },
  { key: 'quantumult_x', label: 'Quantumult X', seoLabel: '支持 Quantumult X' },
  { key: 'stash', label: 'Stash', seoLabel: '支持 Stash' },
  { key: 'surge', label: 'Surge', seoLabel: '支持 Surge' },
  { key: 'sing_box', label: 'sing-box', seoLabel: '支持 sing-box' },
  { key: 'v2rayn', label: 'v2rayN', seoLabel: '支持 v2rayN' },
  { key: 'v2rayng', label: 'v2rayNG', seoLabel: '支持 v2rayNG' },
  { key: 'nekobox', label: 'NekoBox', seoLabel: '支持 NekoBox' },
  { key: 'surfboard', label: 'Surfboard', seoLabel: '支持 Surfboard' },
  { key: 'xiaohuojian', label: '小火箭', seoLabel: '支持小火箭' },
  { key: 'openclash', label: 'OpenClash', seoLabel: '支持 OpenClash' },
];

export const AIRPORT_IMPORT_FILTERS: AirportFilterOption[] = [
  { key: 'one_click_import', label: '一键导入', seoLabel: '支持一键导入' },
  { key: 'subscription_link', label: '订阅链接', seoLabel: '支持订阅链接' },
  { key: 'universal_subscription', label: '通用订阅', seoLabel: '支持通用订阅' },
  { key: 'qr_code_import', label: '二维码导入', seoLabel: '支持二维码导入' },
  { key: 'tutorials', label: '教程支持', seoLabel: '提供教程' },
];

const INDEXABLE_REGION_KEYS = new Set([
  'hong_kong',
  'taiwan',
  'japan',
  'singapore',
  'united_states',
  'south_korea',
  'united_kingdom',
  'germany',
  'turkey',
  'argentina',
  'india',
]);

export const AIRPORT_REGION_FILTERS: AirportRegionFilterOption[] = NODE_REGION_CATALOG.map((region) => ({
  key: region.key,
  label: region.label,
  seoLabel: `${region.label}节点`,
  regionCode: region.code,
  indexable: INDEXABLE_REGION_KEYS.has(region.key),
}));

export const AIRPORT_LINE_FILTERS: AirportFilterOption[] = [
  { key: 'iepl', label: 'IEPL', seoLabel: 'IEPL 专线' },
  { key: 'iplc', label: 'IPLC', seoLabel: 'IPLC 专线' },
  { key: 'cn2', label: 'CN2', seoLabel: 'CN2 线路' },
  { key: 'bgp', label: 'BGP', seoLabel: 'BGP 线路' },
  { key: 'relay', label: '中转', seoLabel: '中转线路' },
];

export const AIRPORT_FILTER_CATALOG: Record<AirportFilterCategory, AirportFilterOption[]> = {
  payment: AIRPORT_PAYMENT_FILTERS,
  streaming: AIRPORT_STREAMING_FILTERS,
  client: AIRPORT_CLIENT_FILTERS,
  import: AIRPORT_IMPORT_FILTERS,
  region: AIRPORT_REGION_FILTERS,
  line: AIRPORT_LINE_FILTERS,
};

export const AIRPORT_PRIMARY_INDEXABLE_FILTER_CATEGORIES = [
  'payment',
  'streaming',
  'client',
  'region',
  'line',
] as const;

export type AirportPrimaryIndexableFilterCategory = (typeof AIRPORT_PRIMARY_INDEXABLE_FILTER_CATEGORIES)[number];

export function getAirportFilterOption(
  category: AirportFilterCategory,
  key: string,
): AirportFilterOption | undefined {
  return AIRPORT_FILTER_CATALOG[category].find((item) => item.key === key);
}

export function getAirportFilterLabel(category: AirportFilterCategory, key: string): string {
  return getAirportFilterOption(category, key)?.label || key;
}

export function getAirportFilterSeoLabel(category: AirportFilterCategory, key: string): string {
  return getAirportFilterOption(category, key)?.seoLabel || getAirportFilterLabel(category, key);
}
