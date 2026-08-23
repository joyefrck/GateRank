import {
  NODE_REGION_CATALOG,
  type NodeRegionCode,
  type NodeRegionGroup,
} from '../../../shared/nodeRegionCatalog';

export type { NodeRegionGroup } from '../../../shared/nodeRegionCatalog';

export interface NodeRegionDefinition {
  code: string;
  reportKey: string;
  name: string;
  group: NodeRegionGroup;
  reportOrder: number;
  aliases: readonly string[];
}

const NODE_REGION_ALIASES: Record<NodeRegionCode, readonly string[]> = {
  KR: ['kr', 'korea', 'south korea', 'seoul', '韩国', '韓國', '首尔', '首爾', '🇰🇷'],
  JP: ['jp', 'japan', 'tokyo', 'osaka', '日本', '东京', '東京', '大阪', '🇯🇵'],
  SG: ['sg', 'singapore', '新加坡', '狮城', '獅城', '🇸🇬'],
  HK: ['hk', 'hong kong', 'hongkong', '香港', '港', '🇭🇰'],
  US: ['us', 'usa', 'america', 'united states', '美国', '美國', '洛杉矶', '洛杉磯', '硅谷', '西雅图', '西雅圖', '纽约', '紐約', '🇺🇸'],
  TW: ['tw', 'taiwan', 'taipei', '台湾', '台灣', '臺灣', '台北', '🇹🇼'],
  MO: ['mo', 'macau', 'macao', '澳门', '澳門', '🇲🇴'],
  GB: ['gb', 'uk', 'united kingdom', 'england', 'london', '英国', '英國', '伦敦', '倫敦', '🇬🇧'],
  DE: ['de', 'germany', 'frankfurt', '德国', '德國', '法兰克福', '法蘭克福', '🇩🇪'],
  CA: ['ca', 'canada', 'toronto', 'vancouver', '加拿大', '多伦多', '多倫多', '温哥华', '溫哥華', '🇨🇦'],
  AU: ['au', 'australia', 'sydney', 'melbourne', '澳大利亚', '澳大利亞', '澳洲', '悉尼', '🇦🇺'],
  FR: ['fr', 'france', 'paris', '法国', '法國', '巴黎', '🇫🇷'],
  NL: ['nl', 'netherlands', 'amsterdam', '荷兰', '荷蘭', '阿姆斯特丹', '🇳🇱'],
  IN: ['in', 'india', 'mumbai', '印度', '孟买', '孟買', '🇮🇳'],
  TH: ['th', 'thailand', 'bangkok', '泰国', '泰國', '曼谷', '🇹🇭'],
  PH: ['ph', 'philippines', 'manila', '菲律宾', '菲律賓', '马尼拉', '馬尼拉', '🇵🇭'],
  MY: ['my', 'malaysia', 'kuala lumpur', '马来西亚', '馬來西亞', '吉隆坡', '🇲🇾'],
  TR: ['tr', 'turkey', 'turkiye', 'istanbul', '土耳其', '伊斯坦布尔', '伊斯坦堡', '🇹🇷'],
  BR: ['br', 'brazil', 'sao paulo', '巴西', '圣保罗', '聖保羅', '🇧🇷'],
  ZA: ['za', 'south africa', 'johannesburg', '南非', '约翰内斯堡', '約翰尼斯堡', '🇿🇦'],
  AR: ['ar', 'argentina', 'buenos aires', '阿根廷', '布宜诺斯艾利斯', '🇦🇷'],
  RU: ['ru', 'russia', 'moscow', '俄罗斯', '俄羅斯', '莫斯科', '🇷🇺'],
  IT: ['it', 'italy', 'milan', '意大利', '義大利', '米兰', '米蘭', '🇮🇹'],
  ES: ['es', 'spain', 'madrid', '西班牙', '马德里', '馬德里', '🇪🇸'],
  CH: ['ch', 'switzerland', 'zurich', '瑞士', '苏黎世', '蘇黎世', '🇨🇭'],
  SE: ['se', 'sweden', 'stockholm', '瑞典', '斯德哥尔摩', '斯德哥爾摩', '🇸🇪'],
  FI: ['fi', 'finland', 'helsinki', '芬兰', '芬蘭', '赫尔辛基', '赫爾辛基', '🇫🇮'],
  NO: ['no', 'norway', 'oslo', '挪威', '奥斯陆', '奧斯陸', '🇳🇴'],
  PL: ['pl', 'poland', 'warsaw', '波兰', '波蘭', '华沙', '華沙', '🇵🇱'],
  AE: ['ae', 'uae', 'united arab emirates', 'dubai', '阿联酋', '阿聯酋', '迪拜', '🇦🇪'],
  ID: ['id', 'idr', 'indonesia', 'jakarta', '印度尼西亚', '印度尼西亞', '印尼', '雅加达', '雅加達', '🇮🇩'],
  VN: ['vn', 'vietnam', 'hanoi', '越南', '河内', '河內', '🇻🇳'],
  CL: ['cl', 'chile', 'santiago', '智利', '圣地亚哥', '聖地牙哥', '🇨🇱'],
};

export const NODE_REGION_DEFINITIONS: readonly NodeRegionDefinition[] = NODE_REGION_CATALOG.map((region) => ({
  code: region.code,
  reportKey: region.key,
  name: region.label,
  group: region.group,
  reportOrder: region.reportOrder,
  aliases: NODE_REGION_ALIASES[region.code],
}));

export const REPORT_NODE_REGION_DEFINITIONS: readonly NodeRegionDefinition[] = [...NODE_REGION_DEFINITIONS]
  .sort((left, right) => left.reportOrder - right.reportOrder);

export function findNodeRegionDefinition(value: string | null | undefined): NodeRegionDefinition | null {
  const normalized = String(value || '').normalize('NFKC').trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  let bestMatch: { definition: NodeRegionDefinition; aliasLength: number } | null = null;
  for (const definition of NODE_REGION_DEFINITIONS) {
    for (const alias of [definition.reportKey, ...definition.aliases]) {
      const normalizedAlias = alias.normalize('NFKC').toLowerCase();
      if (matchesNodeRegionAlias(normalized, normalizedAlias)
        && normalizedAlias.length > (bestMatch?.aliasLength || 0)) {
        bestMatch = { definition, aliasLength: normalizedAlias.length };
      }
    }
  }
  return bestMatch?.definition || null;
}

function matchesNodeRegionAlias(value: string, alias: string): boolean {
  if (/^[a-z0-9]{1,3}$/.test(alias)) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(alias)}([^a-z0-9]|$)`, 'i').test(value);
  }
  return value.includes(alias);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
