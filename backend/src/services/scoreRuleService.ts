import type { SystemSettingRecord } from '../repositories/systemSettingRepository';
import {
  SCORE_RULE_V1,
  SCORE_RULE_V2,
  type GateRankScoreRuleVersion,
} from './networkCoverageScoring';

export const SCORE_V2_ACTIVATION_SETTING_KEY = 'gaterank_score_v2_activation';

export interface ScoreV2Activation {
  cutover_date: string;
  activated_at: string;
  source_run_id: number;
}

interface ScoreRuleServiceDeps {
  systemSettingRepository: {
    getByKey(key: string): Promise<SystemSettingRecord | null>;
    insertIfAbsent(key: string, value: unknown, updatedBy: string): Promise<boolean>;
  };
  forceV2Disabled?: boolean;
}

export class ScoreRuleService {
  private readonly forceV2Disabled: boolean;

  constructor(private readonly deps: ScoreRuleServiceDeps) {
    this.forceV2Disabled = deps.forceV2Disabled ?? isTruthy(process.env.SCORE_V2_FORCE_DISABLED);
  }

  async activateV2IfAbsent(date: string, runId: number, activatedAt: string): Promise<ScoreV2Activation> {
    const activation: ScoreV2Activation = {
      cutover_date: date,
      activated_at: activatedAt,
      source_run_id: runId,
    };
    await this.deps.systemSettingRepository.insertIfAbsent(
      SCORE_V2_ACTIVATION_SETTING_KEY,
      activation,
      'network-coverage',
    );
    return (await this.getActivation()) || activation;
  }

  async getActivation(): Promise<ScoreV2Activation | null> {
    const record = await this.deps.systemSettingRepository.getByKey(SCORE_V2_ACTIVATION_SETTING_KEY);
    return record ? parseActivation(record.value_json) : null;
  }

  async resolveRuleVersion(date: string): Promise<GateRankScoreRuleVersion> {
    if (this.forceV2Disabled) return SCORE_RULE_V1;
    const activation = await this.getActivation();
    return activation && date >= activation.cutover_date ? SCORE_RULE_V2 : SCORE_RULE_V1;
  }

  isForceDisabled(): boolean {
    return this.forceV2Disabled;
  }
}

function parseActivation(value: unknown): ScoreV2Activation | null {
  const parsed = parseJson(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  const cutoverDate = String(record.cutover_date || '');
  const activatedAt = String(record.activated_at || '');
  const sourceRunId = Number(record.source_run_id);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoverDate) || !activatedAt || !Number.isInteger(sourceRunId) || sourceRunId <= 0) {
    return null;
  }
  return { cutover_date: cutoverDate, activated_at: activatedAt, source_run_id: sourceRunId };
}

function parseJson(value: unknown): unknown {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch { return null; }
}

function isTruthy(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}
