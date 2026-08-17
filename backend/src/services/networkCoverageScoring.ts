import { isInformationalNodeName } from '../utils/informationalNode';

export const NETWORK_COVERAGE_RULE_VERSION = 'network_coverage_v1' as const;
export const SCORE_RULE_V1 = 'v1_spcr' as const;
export const SCORE_RULE_V2 = 'v2_spncr' as const;

export type GateRankScoreRuleVersion = typeof SCORE_RULE_V1 | typeof SCORE_RULE_V2;

export interface NetworkCoverageNodeInput {
  key: string;
  name: string;
  type?: string | null;
  healthy: boolean;
  error_code?: string | null;
}

export interface NetworkCoverageNodeResult extends NetworkCoverageNodeInput {
  region_code: string;
  region_name: string;
  region_group: 'core' | 'extended' | 'unknown';
}

export interface NetworkCoverageScoreResult {
  rule_version: typeof NETWORK_COVERAGE_RULE_VERSION;
  detected_nodes_count: number;
  healthy_nodes_count: number;
  unhealthy_nodes_count: number;
  unsupported_nodes_count: number;
  unknown_healthy_nodes_count: number;
  healthy_node_rate: number;
  core_regions: string[];
  extended_regions: string[];
  region_counts: Record<string, number>;
  max_region_code: string | null;
  max_region_share: number;
  node_count_score: number;
  core_coverage_score: number;
  extended_coverage_score: number;
  region_score: number;
  health_rate_score: number;
  balance_score: number;
  score_n: number;
  nodes: NetworkCoverageNodeResult[];
}

interface RegionDefinition {
  code: string;
  name: string;
  group: 'core' | 'extended';
  aliases: readonly string[];
}

const REGION_DEFINITIONS: readonly RegionDefinition[] = [
  { code: 'KR', name: '韩国', group: 'core', aliases: ['kr', 'korea', 'south korea', 'seoul', '韩国', '韓國', '首尔', '首爾', '🇰🇷'] },
  { code: 'JP', name: '日本', group: 'core', aliases: ['jp', 'japan', 'tokyo', 'osaka', '日本', '东京', '東京', '大阪', '🇯🇵'] },
  { code: 'SG', name: '新加坡', group: 'core', aliases: ['sg', 'singapore', '新加坡', '狮城', '獅城', '🇸🇬'] },
  { code: 'HK', name: '香港', group: 'core', aliases: ['hk', 'hong kong', 'hongkong', '香港', '港', '🇭🇰'] },
  { code: 'US', name: '美国', group: 'core', aliases: ['us', 'usa', 'america', 'united states', '美国', '美國', '洛杉矶', '洛杉磯', '硅谷', '西雅图', '西雅圖', '纽约', '紐約', '🇺🇸'] },
  { code: 'TW', name: '台湾', group: 'extended', aliases: ['tw', 'taiwan', 'taipei', '台湾', '台灣', '台北', '🇹🇼'] },
  { code: 'MO', name: '澳门', group: 'extended', aliases: ['mo', 'macau', 'macao', '澳门', '澳門', '🇲🇴'] },
  { code: 'GB', name: '英国', group: 'extended', aliases: ['gb', 'uk', 'united kingdom', 'england', 'london', '英国', '英國', '伦敦', '倫敦', '🇬🇧'] },
  { code: 'DE', name: '德国', group: 'extended', aliases: ['de', 'germany', 'frankfurt', '德国', '德國', '法兰克福', '法蘭克福', '🇩🇪'] },
  { code: 'CA', name: '加拿大', group: 'extended', aliases: ['ca', 'canada', 'toronto', 'vancouver', '加拿大', '多伦多', '多倫多', '温哥华', '溫哥華', '🇨🇦'] },
  { code: 'AU', name: '澳大利亚', group: 'extended', aliases: ['au', 'australia', 'sydney', 'melbourne', '澳大利亚', '澳大利亞', '澳洲', '悉尼', '🇦🇺'] },
  { code: 'FR', name: '法国', group: 'extended', aliases: ['fr', 'france', 'paris', '法国', '法國', '巴黎', '🇫🇷'] },
  { code: 'NL', name: '荷兰', group: 'extended', aliases: ['nl', 'netherlands', 'amsterdam', '荷兰', '荷蘭', '阿姆斯特丹', '🇳🇱'] },
  { code: 'IN', name: '印度', group: 'extended', aliases: ['in', 'india', 'mumbai', '印度', '孟买', '孟買', '🇮🇳'] },
  { code: 'TH', name: '泰国', group: 'extended', aliases: ['th', 'thailand', 'bangkok', '泰国', '泰國', '曼谷', '🇹🇭'] },
  { code: 'PH', name: '菲律宾', group: 'extended', aliases: ['ph', 'philippines', 'manila', '菲律宾', '菲律賓', '马尼拉', '馬尼拉', '🇵🇭'] },
  { code: 'MY', name: '马来西亚', group: 'extended', aliases: ['my', 'malaysia', 'kuala lumpur', '马来西亚', '馬來西亞', '吉隆坡', '🇲🇾'] },
  { code: 'TR', name: '土耳其', group: 'extended', aliases: ['tr', 'turkey', 'turkiye', 'istanbul', '土耳其', '伊斯坦布尔', '伊斯坦堡', '🇹🇷'] },
  { code: 'BR', name: '巴西', group: 'extended', aliases: ['br', 'brazil', 'sao paulo', '巴西', '圣保罗', '聖保羅', '🇧🇷'] },
  { code: 'ZA', name: '南非', group: 'extended', aliases: ['za', 'south africa', 'johannesburg', '南非', '约翰内斯堡', '約翰尼斯堡', '🇿🇦'] },
  { code: 'AR', name: '阿根廷', group: 'extended', aliases: ['ar', 'argentina', 'buenos aires', '阿根廷', '布宜诺斯艾利斯', '🇦🇷'] },
  { code: 'RU', name: '俄罗斯', group: 'extended', aliases: ['ru', 'russia', 'moscow', '俄罗斯', '俄羅斯', '莫斯科', '🇷🇺'] },
  { code: 'IT', name: '意大利', group: 'extended', aliases: ['it', 'italy', 'milan', '意大利', '義大利', '米兰', '米蘭', '🇮🇹'] },
  { code: 'ES', name: '西班牙', group: 'extended', aliases: ['es', 'spain', 'madrid', '西班牙', '马德里', '馬德里', '🇪🇸'] },
  { code: 'CH', name: '瑞士', group: 'extended', aliases: ['ch', 'switzerland', 'zurich', '瑞士', '苏黎世', '蘇黎世', '🇨🇭'] },
  { code: 'SE', name: '瑞典', group: 'extended', aliases: ['se', 'sweden', 'stockholm', '瑞典', '斯德哥尔摩', '斯德哥爾摩', '🇸🇪'] },
  { code: 'FI', name: '芬兰', group: 'extended', aliases: ['fi', 'finland', 'helsinki', '芬兰', '芬蘭', '赫尔辛基', '赫爾辛基', '🇫🇮'] },
  { code: 'NO', name: '挪威', group: 'extended', aliases: ['no', 'norway', 'oslo', '挪威', '奥斯陆', '奧斯陸', '🇳🇴'] },
  { code: 'PL', name: '波兰', group: 'extended', aliases: ['pl', 'poland', 'warsaw', '波兰', '波蘭', '华沙', '華沙', '🇵🇱'] },
  { code: 'AE', name: '阿联酋', group: 'extended', aliases: ['ae', 'uae', 'united arab emirates', 'dubai', '阿联酋', '阿聯酋', '迪拜', '🇦🇪'] },
  { code: 'ID', name: '印度尼西亚', group: 'extended', aliases: ['id', 'indonesia', 'jakarta', '印度尼西亚', '印度尼西亞', '印尼', '雅加达', '雅加達', '🇮🇩'] },
  { code: 'VN', name: '越南', group: 'extended', aliases: ['vn', 'vietnam', 'hanoi', '越南', '河内', '河內', '🇻🇳'] },
];

const UNKNOWN_REGION = { code: 'UNKNOWN', name: '未知地区', group: 'unknown' as const };

export function classifyNetworkCoverageRegion(value: string): Pick<NetworkCoverageNodeResult, 'region_code' | 'region_name' | 'region_group'> {
  if (isInformationalNodeName(value)) {
    return {
      region_code: UNKNOWN_REGION.code,
      region_name: UNKNOWN_REGION.name,
      region_group: UNKNOWN_REGION.group,
    };
  }
  const normalized = value.normalize('NFKC').toLowerCase();
  for (const definition of REGION_DEFINITIONS) {
    if (definition.aliases.some((alias) => matchesAlias(normalized, alias.toLowerCase()))) {
      return {
        region_code: definition.code,
        region_name: definition.name,
        region_group: definition.group,
      };
    }
  }
  return {
    region_code: UNKNOWN_REGION.code,
    region_name: UNKNOWN_REGION.name,
    region_group: UNKNOWN_REGION.group,
  };
}

export function computeNetworkCoverageScore(
  inputNodes: readonly NetworkCoverageNodeInput[],
  unsupportedNodesCount = 0,
): NetworkCoverageScoreResult {
  const nodes = inputNodes.map((node) => ({
    ...node,
    ...classifyNetworkCoverageRegion(node.name),
  }));
  const detectedNodesCount = nodes.length;
  const healthyNodes = nodes.filter((node) => node.healthy);
  const healthyNodesCount = healthyNodes.length;
  const unhealthyNodesCount = detectedNodesCount - healthyNodesCount;
  const healthyNodeRate = detectedNodesCount > 0
    ? round2((healthyNodesCount / detectedNodesCount) * 100)
    : 0;

  const regionCounts: Record<string, number> = {};
  for (const node of healthyNodes) {
    regionCounts[node.region_code] = (regionCounts[node.region_code] || 0) + 1;
  }
  const coreRegions = regionCodesByGroup(regionCounts, 'core');
  const extendedRegions = regionCodesByGroup(regionCounts, 'extended');
  const unknownHealthyNodesCount = regionCounts.UNKNOWN || 0;
  const [maxRegionCode, maxRegionCount] = Object.entries(regionCounts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0] || [null, 0];
  const maxRegionShare = healthyNodesCount > 0 ? round2((maxRegionCount / healthyNodesCount) * 100) : 0;

  const nodeCountScore = scoreHealthyNodeCount(healthyNodesCount);
  const coreCoverageScore = coreRegions.length * 20;
  const extendedCoverageScore = scoreExtendedRegionCount(extendedRegions.length);
  const uncappedRegionScore = coreCoverageScore * 0.8 + extendedCoverageScore * 0.2;
  const regionScore = round2(coreRegions.length < 3 ? Math.min(60, uncappedRegionScore) : uncappedRegionScore);
  const healthRateScore = healthyNodeRate;
  const balanceScore = scoreRegionBalance(maxRegionShare, healthyNodesCount);
  const scoreN = round2(
    nodeCountScore * 0.3
    + regionScore * 0.45
    + healthRateScore * 0.15
    + balanceScore * 0.1,
  );

  return {
    rule_version: NETWORK_COVERAGE_RULE_VERSION,
    detected_nodes_count: detectedNodesCount,
    healthy_nodes_count: healthyNodesCount,
    unhealthy_nodes_count: unhealthyNodesCount,
    unsupported_nodes_count: Math.max(0, Math.floor(unsupportedNodesCount)),
    unknown_healthy_nodes_count: unknownHealthyNodesCount,
    healthy_node_rate: healthyNodeRate,
    core_regions: coreRegions,
    extended_regions: extendedRegions,
    region_counts: regionCounts,
    max_region_code: maxRegionCode,
    max_region_share: maxRegionShare,
    node_count_score: nodeCountScore,
    core_coverage_score: coreCoverageScore,
    extended_coverage_score: extendedCoverageScore,
    region_score: regionScore,
    health_rate_score: healthRateScore,
    balance_score: balanceScore,
    score_n: scoreN,
    nodes,
  };
}

export function scoreHealthyNodeCount(count: number): number {
  if (count <= 0) return 0;
  if (count <= 5) return 20;
  if (count <= 10) return 40;
  if (count <= 20) return 60;
  if (count <= 30) return 75;
  if (count <= 50) return 90;
  return 100;
}

export function scoreExtendedRegionCount(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 30;
  if (count === 2) return 50;
  if (count === 3) return 65;
  if (count === 4) return 75;
  if (count === 5) return 85;
  if (count <= 7) return 92;
  return 100;
}

export function scoreRegionBalance(maxRegionShare: number, healthyNodesCount: number): number {
  if (healthyNodesCount <= 0) return 0;
  if (maxRegionShare <= 40) return 100;
  if (maxRegionShare <= 50) return 90;
  if (maxRegionShare <= 60) return 75;
  if (maxRegionShare <= 70) return 60;
  if (maxRegionShare <= 80) return 40;
  if (maxRegionShare <= 90) return 20;
  return 0;
}

function regionCodesByGroup(regionCounts: Record<string, number>, group: RegionDefinition['group']): string[] {
  return REGION_DEFINITIONS
    .filter((definition) => definition.group === group && (regionCounts[definition.code] || 0) > 0)
    .map((definition) => definition.code);
}

function matchesAlias(value: string, alias: string): boolean {
  if (/^[a-z0-9]{1,3}$/.test(alias)) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(alias)}([^a-z0-9]|$)`, 'i').test(value);
  }
  return value.includes(alias);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function round2(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}
