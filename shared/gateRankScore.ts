/** Final formula inputs: S/P/R have already been time-decay weighted. */
export const SCORE_COMPONENT_KEYS = ['s', 'p', 'n', 'c', 'r'] as const;
export type ScoreComponentKey = typeof SCORE_COMPONENT_KEYS[number];
export type ScoreRuleVersion = 'v1_spcr' | 'v2_spncr';
export type ScoreComponents = { s: number; p: number; n: number | null; c: number; r: number };
export type ManualScoreComponents = Partial<Record<ScoreComponentKey, number | null>>;
export const FINAL_ENGINE_WEIGHTS = { s: 0.4, p: 0.3, c: 0.1, r: 0.2 } as const;
export const FINAL_ENGINE_WEIGHTS_V2 = { s: 0.3, p: 0.3, n: 0.2, c: 0.1, r: 0.1 } as const;
export const roundScore = (value: number) => Math.round(value * 100) / 100;

export function weightedGateRankScore(scores: ScoreComponents, version: ScoreRuleVersion): number {
  return version === 'v2_spncr'
    ? FINAL_ENGINE_WEIGHTS_V2.s * scores.s + FINAL_ENGINE_WEIGHTS_V2.p * scores.p
      + FINAL_ENGINE_WEIGHTS_V2.n * (scores.n ?? 0) + FINAL_ENGINE_WEIGHTS_V2.c * scores.c
      + FINAL_ENGINE_WEIGHTS_V2.r * scores.r
    : FINAL_ENGINE_WEIGHTS.s * scores.s + FINAL_ENGINE_WEIGHTS.p * scores.p
      + FINAL_ENGINE_WEIGHTS.c * scores.c + FINAL_ENGINE_WEIGHTS.r * scores.r;
}

export function applyScoreComponents(automatic: ScoreComponents, manual: ManualScoreComponents, version: ScoreRuleVersion): ScoreComponents {
  const effective = { ...automatic };
  for (const key of SCORE_COMPONENT_KEYS) {
    const value = manual[key];
    if (typeof value === 'number' && Number.isFinite(value)) effective[key] = value;
  }
  if (version === 'v1_spcr') effective.n = null;
  return effective;
}

export function finalComponentTotal(scores: ScoreComponents, version: ScoreRuleVersion, factor: number): number {
  return roundScore(weightedGateRankScore(scores, version) * factor);
}

export interface ScoreComponentEditorState {
  automatic: ScoreComponents;
  effective: ScoreComponents;
  overrides: ManualScoreComponents;
  rule_version: ScoreRuleVersion;
  cold_start_factor: number;
  data_days: number;
  formula_total_score: number;
  total_score: number;
  legacy_total_score: number | null;
}
