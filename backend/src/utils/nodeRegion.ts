export type NodeRegionGroup = 'core' | 'extended';

export interface NodeRegionDefinition {
  code: string;
  reportKey: string;
  name: string;
  group: NodeRegionGroup;
  reportOrder: number;
  aliases: readonly string[];
}

export const NODE_REGION_DEFINITIONS: readonly NodeRegionDefinition[] = [
  { code: 'KR', reportKey: 'south_korea', name: '韩国', group: 'core', reportOrder: 70, aliases: ['kr', 'korea', 'south korea', 'seoul', '韩国', '韓國', '首尔', '首爾', '🇰🇷'] },
  { code: 'JP', reportKey: 'japan', name: '日本', group: 'core', reportOrder: 40, aliases: ['jp', 'japan', 'tokyo', 'osaka', '日本', '东京', '東京', '大阪', '🇯🇵'] },
  { code: 'SG', reportKey: 'singapore', name: '新加坡', group: 'core', reportOrder: 50, aliases: ['sg', 'singapore', '新加坡', '狮城', '獅城', '🇸🇬'] },
  { code: 'HK', reportKey: 'hong_kong', name: '香港', group: 'core', reportOrder: 10, aliases: ['hk', 'hong kong', 'hongkong', '香港', '港', '🇭🇰'] },
  { code: 'US', reportKey: 'united_states', name: '美国', group: 'core', reportOrder: 60, aliases: ['us', 'usa', 'america', 'united states', '美国', '美國', '洛杉矶', '洛杉磯', '硅谷', '西雅图', '西雅圖', '纽约', '紐約', '🇺🇸'] },
  { code: 'TW', reportKey: 'taiwan', name: '台湾', group: 'extended', reportOrder: 20, aliases: ['tw', 'taiwan', 'taipei', '台湾', '台灣', '臺灣', '台北', '🇹🇼'] },
  { code: 'MO', reportKey: 'macau', name: '澳门', group: 'extended', reportOrder: 30, aliases: ['mo', 'macau', 'macao', '澳门', '澳門', '🇲🇴'] },
  { code: 'GB', reportKey: 'united_kingdom', name: '英国', group: 'extended', reportOrder: 80, aliases: ['gb', 'uk', 'united kingdom', 'england', 'london', '英国', '英國', '伦敦', '倫敦', '🇬🇧'] },
  { code: 'DE', reportKey: 'germany', name: '德国', group: 'extended', reportOrder: 90, aliases: ['de', 'germany', 'frankfurt', '德国', '德國', '法兰克福', '法蘭克福', '🇩🇪'] },
  { code: 'CA', reportKey: 'canada', name: '加拿大', group: 'extended', reportOrder: 170, aliases: ['ca', 'canada', 'toronto', 'vancouver', '加拿大', '多伦多', '多倫多', '温哥华', '溫哥華', '🇨🇦'] },
  { code: 'AU', reportKey: 'australia', name: '澳大利亚', group: 'extended', reportOrder: 160, aliases: ['au', 'australia', 'sydney', 'melbourne', '澳大利亚', '澳大利亞', '澳洲', '悉尼', '🇦🇺'] },
  { code: 'FR', reportKey: 'france', name: '法国', group: 'extended', reportOrder: 200, aliases: ['fr', 'france', 'paris', '法国', '法國', '巴黎', '🇫🇷'] },
  { code: 'NL', reportKey: 'netherlands', name: '荷兰', group: 'extended', reportOrder: 230, aliases: ['nl', 'netherlands', 'amsterdam', '荷兰', '荷蘭', '阿姆斯特丹', '🇳🇱'] },
  { code: 'IN', reportKey: 'india', name: '印度', group: 'extended', reportOrder: 105, aliases: ['in', 'india', 'mumbai', '印度', '孟买', '孟買', '🇮🇳'] },
  { code: 'TH', reportKey: 'thailand', name: '泰国', group: 'extended', reportOrder: 120, aliases: ['th', 'thailand', 'bangkok', '泰国', '泰國', '曼谷', '🇹🇭'] },
  { code: 'PH', reportKey: 'philippines', name: '菲律宾', group: 'extended', reportOrder: 130, aliases: ['ph', 'philippines', 'manila', '菲律宾', '菲律賓', '马尼拉', '馬尼拉', '🇵🇭'] },
  { code: 'MY', reportKey: 'malaysia', name: '马来西亚', group: 'extended', reportOrder: 140, aliases: ['my', 'malaysia', 'kuala lumpur', '马来西亚', '馬來西亞', '吉隆坡', '🇲🇾'] },
  { code: 'TR', reportKey: 'turkey', name: '土耳其', group: 'extended', reportOrder: 100, aliases: ['tr', 'turkey', 'turkiye', 'istanbul', '土耳其', '伊斯坦布尔', '伊斯坦堡', '🇹🇷'] },
  { code: 'BR', reportKey: 'brazil', name: '巴西', group: 'extended', reportOrder: 180, aliases: ['br', 'brazil', 'sao paulo', '巴西', '圣保罗', '聖保羅', '🇧🇷'] },
  { code: 'ZA', reportKey: 'south_africa', name: '南非', group: 'extended', reportOrder: 240, aliases: ['za', 'south africa', 'johannesburg', '南非', '约翰内斯堡', '約翰尼斯堡', '🇿🇦'] },
  { code: 'AR', reportKey: 'argentina', name: '阿根廷', group: 'extended', reportOrder: 220, aliases: ['ar', 'argentina', 'buenos aires', '阿根廷', '布宜诺斯艾利斯', '🇦🇷'] },
  { code: 'RU', reportKey: 'russia', name: '俄罗斯', group: 'extended', reportOrder: 250, aliases: ['ru', 'russia', 'moscow', '俄罗斯', '俄羅斯', '莫斯科', '🇷🇺'] },
  { code: 'IT', reportKey: 'italy', name: '意大利', group: 'extended', reportOrder: 210, aliases: ['it', 'italy', 'milan', '意大利', '義大利', '米兰', '米蘭', '🇮🇹'] },
  { code: 'ES', reportKey: 'spain', name: '西班牙', group: 'extended', reportOrder: 260, aliases: ['es', 'spain', 'madrid', '西班牙', '马德里', '馬德里', '🇪🇸'] },
  { code: 'CH', reportKey: 'switzerland', name: '瑞士', group: 'extended', reportOrder: 270, aliases: ['ch', 'switzerland', 'zurich', '瑞士', '苏黎世', '蘇黎世', '🇨🇭'] },
  { code: 'SE', reportKey: 'sweden', name: '瑞典', group: 'extended', reportOrder: 280, aliases: ['se', 'sweden', 'stockholm', '瑞典', '斯德哥尔摩', '斯德哥爾摩', '🇸🇪'] },
  { code: 'FI', reportKey: 'finland', name: '芬兰', group: 'extended', reportOrder: 290, aliases: ['fi', 'finland', 'helsinki', '芬兰', '芬蘭', '赫尔辛基', '赫爾辛基', '🇫🇮'] },
  { code: 'NO', reportKey: 'norway', name: '挪威', group: 'extended', reportOrder: 300, aliases: ['no', 'norway', 'oslo', '挪威', '奥斯陆', '奧斯陸', '🇳🇴'] },
  { code: 'PL', reportKey: 'poland', name: '波兰', group: 'extended', reportOrder: 310, aliases: ['pl', 'poland', 'warsaw', '波兰', '波蘭', '华沙', '華沙', '🇵🇱'] },
  { code: 'AE', reportKey: 'united_arab_emirates', name: '阿联酋', group: 'extended', reportOrder: 320, aliases: ['ae', 'uae', 'united arab emirates', 'dubai', '阿联酋', '阿聯酋', '迪拜', '🇦🇪'] },
  { code: 'ID', reportKey: 'indonesia', name: '印度尼西亚', group: 'extended', reportOrder: 110, aliases: ['id', 'idr', 'indonesia', 'jakarta', '印度尼西亚', '印度尼西亞', '印尼', '雅加达', '雅加達', '🇮🇩'] },
  { code: 'VN', reportKey: 'vietnam', name: '越南', group: 'extended', reportOrder: 150, aliases: ['vn', 'vietnam', 'hanoi', '越南', '河内', '河內', '🇻🇳'] },
  { code: 'CL', reportKey: 'chile', name: '智利', group: 'extended', reportOrder: 190, aliases: ['cl', 'chile', 'santiago', '智利', '圣地亚哥', '聖地牙哥', '🇨🇱'] },
];

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
