import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceHomeAirportRotation } from '../src/utils/homeAirportRotation';

const interval = 120;
const duration = interval * 60_000;
const keepOrder = () => 0.999999;

test('five candidates with four slots each get first place and every displayed position once', () => {
  const ids = [1, 2, 3, 4, 5];
  let state = advanceHomeAirportRotation(null, ids, 0, interval, keepOrder);
  const rows: number[][] = [];
  for (let slot = 0; slot < 5; slot++) {
    state = advanceHomeAirportRotation(state, ids, slot * duration, interval, keepOrder);
    rows.push(state.queue.slice(0, 4));
  }
  assert.deepEqual(rows, [[1,2,3,4], [2,3,4,5], [3,4,5,1], [4,5,1,2], [5,1,2,3]]);
  for (let position = 0; position < 4; position++) {
    assert.deepEqual(rows.map(row => row[position]).sort(), ids);
  }
  assert.equal(state.round, 1);
  const next = advanceHomeAirportRotation(state, ids, 5 * duration, interval, keepOrder);
  assert.equal(next.round, 2);
  assert.notEqual(next.queue[0], 5);
});

test('requests before expiry and a deserialized restart retain the same order', () => {
  const first = advanceHomeAirportRotation(null, [1,2,3], 10, interval, keepOrder);
  const restarted = JSON.parse(JSON.stringify(first));
  assert.deepEqual(advanceHomeAirportRotation(restarted, [3,2,1], duration, interval, () => 0), first);
  assert.equal(advanceHomeAirportRotation(first, [1,2,3], duration + 10, interval, keepOrder).queue[0], 2);
});

test('newcomers join behind pending airports and before completed ones', () => {
  let state = advanceHomeAirportRotation(null, [1,2,3], 0, interval, keepOrder);
  state = advanceHomeAirportRotation(state, [1,2,3], duration, interval, keepOrder);
  state = advanceHomeAirportRotation(state, [1,2,3,4], duration + 1, interval, keepOrder);
  assert.deepEqual(state.queue, [2,3,4,1]);
  assert.deepEqual(state.completed, [1]);
});

test('balance loss removes current leader; restoration cannot repeat a completed first place', () => {
  let state = advanceHomeAirportRotation(null, [1,2,3,4], 0, interval, keepOrder);
  state = advanceHomeAirportRotation(state, [1,2,3,4], duration, interval, keepOrder);
  state = advanceHomeAirportRotation(state, [3,4], duration + 100, interval, keepOrder);
  assert.deepEqual(state.queue, [3,4]);
  assert.equal(state.started_at, duration + 100);
  state = advanceHomeAirportRotation(state, [1,2,3,4], duration + 101, interval, keepOrder);
  assert.deepEqual(state.queue, [3,4,2,1]);
  assert.deepEqual(state.completed, [1]);
});

test('interval edits keep progress and start a complete new time slot', () => {
  let state = advanceHomeAirportRotation(null, [1,2], 0, interval, keepOrder);
  state = advanceHomeAirportRotation(state, [1,2], duration, interval, keepOrder);
  const changed = advanceHomeAirportRotation(state, [1,2], duration + 10, 30, keepOrder);
  assert.deepEqual(changed.queue, state.queue);
  assert.deepEqual(changed.completed, [1]);
  assert.equal(changed.started_at, duration + 10);
  assert.equal(changed.interval_minutes, 30);
});

test('empty and single candidate pools work and long inactivity is bounded', () => {
  const empty = advanceHomeAirportRotation(null, [], 0, interval, keepOrder);
  assert.deepEqual(empty.queue, []);
  const one = advanceHomeAirportRotation(empty, [7], 1, interval, keepOrder);
  const later = advanceHomeAirportRotation(one, [7], duration * 1_000_000 + 1, interval, keepOrder);
  assert.deepEqual(later.queue, [7]);
  assert.equal(later.round, 1_000_001);
  assert.equal(later.started_at, duration * 1_000_000 + 1);
});
