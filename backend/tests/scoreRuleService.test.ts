import test from 'node:test';
import assert from 'node:assert/strict';
import { SCORE_RULE_V1, SCORE_RULE_V2 } from '../src/services/networkCoverageScoring';
import { SCORE_V2_ACTIVATION_SETTING_KEY, ScoreRuleService } from '../src/services/scoreRuleService';

test('score rule service atomically keeps the first successful coverage date', async () => {
  let value: unknown = null;
  const service = new ScoreRuleService({
    forceV2Disabled: false,
    systemSettingRepository: {
      async getByKey() {
        return value === null ? null : {
          setting_key: SCORE_V2_ACTIVATION_SETTING_KEY,
          value_json: value,
          updated_by: 'network-coverage',
          created_at: '',
          updated_at: '',
        };
      },
      async insertIfAbsent(_key, next) {
        if (value !== null) return false;
        value = next;
        return true;
      },
    },
  });

  await service.activateV2IfAbsent('2026-08-11', 10, '2026-08-11T02:00:00+08:00');
  await service.activateV2IfAbsent('2026-08-12', 11, '2026-08-12T02:00:00+08:00');

  assert.equal((await service.getActivation())?.cutover_date, '2026-08-11');
  assert.equal(await service.resolveRuleVersion('2026-08-10'), SCORE_RULE_V1);
  assert.equal(await service.resolveRuleVersion('2026-08-11'), SCORE_RULE_V2);
});

test('score rule emergency switch forces v1 without deleting activation', async () => {
  const service = new ScoreRuleService({
    forceV2Disabled: true,
    systemSettingRepository: {
      async getByKey() {
        return {
          setting_key: SCORE_V2_ACTIVATION_SETTING_KEY,
          value_json: { cutover_date: '2026-08-11', activated_at: 'now', source_run_id: 1 },
          updated_by: 'network-coverage', created_at: '', updated_at: '',
        };
      },
      async insertIfAbsent() { return false; },
    },
  });
  assert.equal(await service.resolveRuleVersion('2026-08-12'), SCORE_RULE_V1);
  assert.equal(service.isForceDisabled(), true);
});
