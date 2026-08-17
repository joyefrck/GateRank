import { isInformationalNodeName } from '../utils/informationalNode';
import {
  findNodeRegionDefinition,
  NODE_REGION_DEFINITIONS,
  type NodeRegionGroup,
} from '../utils/nodeRegion';

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

const UNKNOWN_REGION = { code: 'UNKNOWN', name: '未知地区', group: 'unknown' as const };

export function classifyNetworkCoverageRegion(value: string): Pick<NetworkCoverageNodeResult, 'region_code' | 'region_name' | 'region_group'> {
  if (isInformationalNodeName(value)) {
    return {
      region_code: UNKNOWN_REGION.code,
      region_name: UNKNOWN_REGION.name,
      region_group: UNKNOWN_REGION.group,
    };
  }
  const definition = findNodeRegionDefinition(value);
  if (definition) {
    return {
      region_code: definition.code,
      region_name: definition.name,
      region_group: definition.group,
    };
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

function regionCodesByGroup(regionCounts: Record<string, number>, group: NodeRegionGroup): string[] {
  return NODE_REGION_DEFINITIONS
    .filter((definition) => definition.group === group && (regionCounts[definition.code] || 0) > 0)
    .map((definition) => definition.code);
}

function round2(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}
