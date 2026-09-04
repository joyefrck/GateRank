import {
  SCORE_COMPONENT_KEYS, applyScoreComponents, finalComponentTotal,
  type ManualScoreComponents, type ScoreComponentEditorState, type ScoreComponentKey,
} from '../../../shared/gateRankScore';
import type { ScoreBreakdown, ScoreDetailValue } from '../types/domain';
import type { FinalEngineScoreResult } from './scoringEngine';

type Details = Record<string, ScoreDetailValue>;
export function readManualComponents(details: Details): ManualScoreComponents {
  const result: ManualScoreComponents = {};
  for (const key of SCORE_COMPONENT_KEYS) {
    const value = details[`manual_score_${key}`];
    if (typeof value === 'number' && Number.isFinite(value)) result[key] = value;
  }
  return result;
}

export function componentEditorState(automatic: FinalEngineScoreResult, details: Details): ScoreComponentEditorState {
  const version = details.score_rule_version === 'v2_spncr' ? 'v2_spncr' : 'v1_spcr';
  const overrides = readManualComponents(details);
  const values = { s: automatic.s, p: automatic.p, n: automatic.n, c: automatic.c, r: automatic.r };
  const effective = applyScoreComponents(values, overrides, version);
  const total = finalComponentTotal(effective, version, automatic.cold_start_factor);
  const legacy = typeof details.manual_total_score === 'number' ? details.manual_total_score : null;
  return {
    automatic: values, effective, overrides, rule_version: version,
    cold_start_factor: automatic.cold_start_factor, data_days: automatic.data_days,
    formula_total_score: total, total_score: legacy ?? total, legacy_total_score: legacy,
  };
}

/** Only metadata changes. Raw daily series remain untouched for future dates. */
export function storeComponentCalculation(score: ScoreBreakdown, automatic: FinalEngineScoreResult): ScoreComponentEditorState {
  const state = componentEditorState(automatic, score.details);
  for (const key of SCORE_COMPONENT_KEYS) score.details[`automatic_score_${key}`] = state.automatic[key];
  score.details.component_cold_start_factor = state.cold_start_factor;
  score.details.component_data_days = state.data_days;
  score.details.total_score = state.formula_total_score;
  return state;
}

export function effectiveComponent(score: Partial<ScoreBreakdown>, key: ScoreComponentKey): number {
  const manual = score.details?.[`manual_score_${key}`];
  if (typeof manual === 'number' && Number.isFinite(manual)) return manual;
  const automatic = score.details?.[`automatic_score_${key}`];
  return typeof automatic === 'number' && Number.isFinite(automatic) ? automatic : Number(score[key] ?? 0);
}

export function displayScore(score: Pick<ScoreBreakdown, 'details' | 'final_score'>): number {
  for (const value of [score.details.manual_total_score, score.details.total_score, score.final_score]) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return 0;
}

/** Public summaries expose final formula inputs; callers retain raw observations separately. */
export function publicScoreSummary(score: unknown): unknown {
  if (!score || typeof score !== 'object') return score;
  const row = score as ScoreBreakdown;
  if (!row.details || typeof row.final_score !== 'number') return score;
  return { ...row,
    s: effectiveComponent(row, 's'), p: effectiveComponent(row, 'p'),
    n: row.n != null || row.details.score_rule_version === 'v2_spncr' ? effectiveComponent(row, 'n') : null,
    c: effectiveComponent(row, 'c'), r: effectiveComponent(row, 'r'),
    final_score: displayScore(row),
  };
}
