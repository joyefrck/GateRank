import assert from 'node:assert/strict';
import test from 'node:test';

import { manualTotalScoreInputValue } from '../../src/admin/scoreInput.ts';

test('manual total score input stays empty when only formula score is displayed', () => {
  const formulaDisplayScore = 32.89;
  const manualScore = null;

  assert.equal(manualTotalScoreInputValue(manualScore), '');
  assert.equal(formulaDisplayScore, 32.89);
});

test('manual total score input uses the saved manual score when present', () => {
  assert.equal(manualTotalScoreInputValue(66.66), '66.66');
});

test('manual total score input returns empty after manual score is cleared', () => {
  const formulaDisplayScore = 32.89;
  const clearedManualScore = null;

  assert.equal(manualTotalScoreInputValue(clearedManualScore), '');
  assert.equal(formulaDisplayScore, 32.89);
});
