import type {
  PerformanceProbeId,
  PerformanceProbeType,
  PerformanceScoringRuleVersion,
} from '../types/domain';

export interface PerformanceScoringRule {
  speedBadMbps: number;
  speedGoodMbps: number;
  ceilingMbps: number | null;
}

export interface PerformanceProbeDefinition {
  probe_id: PerformanceProbeId;
  display_name: string;
  region_code: string;
  provider: string;
  bandwidth_mbps: number | null;
  probe_type: PerformanceProbeType;
  test_profile: string;
  scoring_rule_version: PerformanceScoringRuleVersion;
}

export const PERFORMANCE_SCORING_RULES: Record<
  PerformanceScoringRuleVersion,
  PerformanceScoringRule
> = {
  legacy_v1: {
    speedBadMbps: 10,
    speedGoodMbps: 300,
    ceilingMbps: null,
  },
  cn_dual_probe_v1: {
    speedBadMbps: 10,
    speedGoodMbps: 160,
    ceilingMbps: 180,
  },
};

export const PERFORMANCE_PROBE_DEFINITIONS: readonly PerformanceProbeDefinition[] = [
  {
    probe_id: 'legacy-control',
    display_name: '现有中心对照',
    region_code: 'legacy',
    provider: 'gaterank',
    bandwidth_mbps: null,
    probe_type: 'legacy',
    test_profile: 'legacy_single_target_v1',
    scoring_rule_version: 'legacy_v1',
  },
  {
    probe_id: 'cn-shanghai',
    display_name: '上海',
    region_code: 'cn-shanghai',
    provider: 'tencent-cloud',
    bandwidth_mbps: 200,
    probe_type: 'mainland',
    test_profile: 'mainland_multi_target_v1',
    scoring_rule_version: 'cn_dual_probe_v1',
  },
  {
    probe_id: 'cn-guangzhou',
    display_name: '广州',
    region_code: 'cn-guangzhou',
    provider: 'tencent-cloud',
    bandwidth_mbps: 200,
    probe_type: 'mainland',
    test_profile: 'mainland_multi_target_v1',
    scoring_rule_version: 'cn_dual_probe_v1',
  },
] as const;

export function getPerformanceScoringRule(
  version: PerformanceScoringRuleVersion,
): PerformanceScoringRule {
  return PERFORMANCE_SCORING_RULES[version];
}
