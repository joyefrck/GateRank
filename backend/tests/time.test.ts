import assert from 'node:assert/strict';
import test from 'node:test';
import { formatRelativeTimeFromNow } from '../src/utils/time';

const baseNow = new Date('2026-03-25T12:00:00+08:00');

test('formatRelativeTimeFromNow returns 刚刚 within one minute', () => {
  assert.equal(
    formatRelativeTimeFromNow('2026-03-25T11:59:30+08:00', baseNow),
    '刚刚',
  );
});

test('formatRelativeTimeFromNow returns minutes within one hour', () => {
  assert.equal(
    formatRelativeTimeFromNow('2026-03-25T11:55:00+08:00', baseNow),
    '5 分钟前',
  );
  assert.equal(
    formatRelativeTimeFromNow('2026-03-25T11:01:00+08:00', baseNow),
    '59 分钟前',
  );
});

test('formatRelativeTimeFromNow returns hours between one hour and one day', () => {
  assert.equal(
    formatRelativeTimeFromNow('2026-03-25T11:00:00+08:00', baseNow),
    '1 小时前',
  );
  assert.equal(
    formatRelativeTimeFromNow('2026-03-25T10:00:00+08:00', baseNow),
    '2 小时前',
  );
});

test('formatRelativeTimeFromNow returns days after one day', () => {
  assert.equal(
    formatRelativeTimeFromNow('2026-03-24T10:00:00+08:00', baseNow),
    '1 天前',
  );
});

test('formatRelativeTimeFromNow falls back for empty or invalid values', () => {
  assert.equal(formatRelativeTimeFromNow(null, baseNow), '暂无更新');
  assert.equal(formatRelativeTimeFromNow('invalid-date', baseNow), '暂无更新');
});
