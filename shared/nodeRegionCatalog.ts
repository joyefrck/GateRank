export type NodeRegionGroup = 'core' | 'extended';

export interface NodeRegionCatalogEntry {
  code: string;
  key: string;
  label: string;
  group: NodeRegionGroup;
  reportOrder: number;
}

export const NODE_REGION_CATALOG = [
  { code: 'KR', key: 'south_korea', label: '韩国', group: 'core', reportOrder: 70 },
  { code: 'JP', key: 'japan', label: '日本', group: 'core', reportOrder: 40 },
  { code: 'SG', key: 'singapore', label: '新加坡', group: 'core', reportOrder: 50 },
  { code: 'HK', key: 'hong_kong', label: '香港', group: 'core', reportOrder: 10 },
  { code: 'US', key: 'united_states', label: '美国', group: 'core', reportOrder: 60 },
  { code: 'TW', key: 'taiwan', label: '台湾', group: 'extended', reportOrder: 20 },
  { code: 'MO', key: 'macau', label: '澳门', group: 'extended', reportOrder: 30 },
  { code: 'GB', key: 'united_kingdom', label: '英国', group: 'extended', reportOrder: 80 },
  { code: 'DE', key: 'germany', label: '德国', group: 'extended', reportOrder: 90 },
  { code: 'CA', key: 'canada', label: '加拿大', group: 'extended', reportOrder: 170 },
  { code: 'AU', key: 'australia', label: '澳大利亚', group: 'extended', reportOrder: 160 },
  { code: 'FR', key: 'france', label: '法国', group: 'extended', reportOrder: 200 },
  { code: 'NL', key: 'netherlands', label: '荷兰', group: 'extended', reportOrder: 230 },
  { code: 'IN', key: 'india', label: '印度', group: 'extended', reportOrder: 105 },
  { code: 'TH', key: 'thailand', label: '泰国', group: 'extended', reportOrder: 120 },
  { code: 'PH', key: 'philippines', label: '菲律宾', group: 'extended', reportOrder: 130 },
  { code: 'MY', key: 'malaysia', label: '马来西亚', group: 'extended', reportOrder: 140 },
  { code: 'TR', key: 'turkey', label: '土耳其', group: 'extended', reportOrder: 100 },
  { code: 'BR', key: 'brazil', label: '巴西', group: 'extended', reportOrder: 180 },
  { code: 'ZA', key: 'south_africa', label: '南非', group: 'extended', reportOrder: 240 },
  { code: 'AR', key: 'argentina', label: '阿根廷', group: 'extended', reportOrder: 220 },
  { code: 'RU', key: 'russia', label: '俄罗斯', group: 'extended', reportOrder: 250 },
  { code: 'IT', key: 'italy', label: '意大利', group: 'extended', reportOrder: 210 },
  { code: 'ES', key: 'spain', label: '西班牙', group: 'extended', reportOrder: 260 },
  { code: 'CH', key: 'switzerland', label: '瑞士', group: 'extended', reportOrder: 270 },
  { code: 'SE', key: 'sweden', label: '瑞典', group: 'extended', reportOrder: 280 },
  { code: 'FI', key: 'finland', label: '芬兰', group: 'extended', reportOrder: 290 },
  { code: 'NO', key: 'norway', label: '挪威', group: 'extended', reportOrder: 300 },
  { code: 'PL', key: 'poland', label: '波兰', group: 'extended', reportOrder: 310 },
  { code: 'AE', key: 'united_arab_emirates', label: '阿联酋', group: 'extended', reportOrder: 320 },
  { code: 'ID', key: 'indonesia', label: '印度尼西亚', group: 'extended', reportOrder: 110 },
  { code: 'VN', key: 'vietnam', label: '越南', group: 'extended', reportOrder: 150 },
  { code: 'CL', key: 'chile', label: '智利', group: 'extended', reportOrder: 190 },
] as const satisfies readonly NodeRegionCatalogEntry[];

export type NodeRegionCode = (typeof NODE_REGION_CATALOG)[number]['code'];
export type NodeRegionKey = (typeof NODE_REGION_CATALOG)[number]['key'];
