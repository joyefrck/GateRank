import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFullRankingFilters } from '../../shared/fullRankingFilters';
import { createFullRankingLoadGate } from '../src/utils/fullRankingLoadGate';

test('full ranking load gate limits only high-complexity filter bursts', () => {
  let now = 1_000;
  const gate = createFullRankingLoadGate({
    filterThreshold: 4,
    maxRequests: 2,
    windowMs: 10_000,
    now: () => now,
  });
  const simple = parseFullRankingFilters(new URLSearchParams('client=clash&region=hong_kong'));
  const complex = parseFullRankingFilters(new URLSearchParams(
    'client=clash&client=shadowrocket&region=hong_kong&streaming=chatgpt',
  ));

  for (let index = 0; index < 10; index += 1) {
    assert.deepEqual(gate.check(simple), { allowed: true });
  }
  assert.deepEqual(gate.check(complex), { allowed: true });
  assert.deepEqual(gate.check(complex), { allowed: true });
  assert.deepEqual(gate.check(complex), { allowed: false, retryAfterSeconds: 10 });

  now += 10_000;
  assert.deepEqual(gate.check(complex), { allowed: true });
});
