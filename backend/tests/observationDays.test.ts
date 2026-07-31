import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateObservationDays } from '../../shared/observationDays';

test('calculateObservationDays counts onboarding day as day one', () => {
  assert.equal(calculateObservationDays('2026-03-21', '2026-07-31'), 133);
  assert.equal(calculateObservationDays('2026-07-31', '2026-07-31'), 1);
});

test('calculateObservationDays clamps future onboarding and rejects invalid dates', () => {
  assert.equal(calculateObservationDays('2026-08-01', '2026-07-31'), 0);
  assert.equal(calculateObservationDays(null, '2026-07-31'), null);
  assert.equal(calculateObservationDays('invalid', '2026-07-31'), null);
  assert.equal(calculateObservationDays('2026-02-31', '2026-07-31'), null);
});
