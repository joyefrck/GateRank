import test from 'node:test';
import assert from 'node:assert/strict';
import { parseManualAdInput } from '../src/utils/manualAdInput';

export const validManualAd = {
  airport_id: 1, home_slot: 1, coupon_code: ' NATIONAL20 ', discount_title: ' 国庆优惠 ', discount_description: '全场八折', applicable_plan: '所有', discount_percent: 20, is_stackable: false, refund_supported: true,
  starts_at: '2026-10-01T12:00:00+08:00', ends_at: '2026-11-01T12:00:00+08:00',
};
test('manual ad trims text, accepts optional coupon and normalizes explicit timezone', () => {
  const result = parseManualAdInput(validManualAd);
  assert.equal(result.coupon_code, 'NATIONAL20'); assert.equal(result.discount_title, '国庆优惠');
  assert.equal(result.starts_at, '2026-10-01T04:00:00.000Z');
  assert.equal(parseManualAdInput({ ...validManualAd, home_slot: null, coupon_code: '', discount_percent: null }).coupon_code, '');
});
for (const [label, patch] of Object.entries({
  'missing airport': { airport_id: 0 }, 'string airport': { airport_id: '1' }, 'invalid slot': { home_slot: 6 }, 'missing slot': { home_slot: undefined }, 'blank title': { discount_title: ' ' }, 'oversize coupon': { coupon_code: 'x'.repeat(65) }, 'wrong boolean': { is_stackable: 'false' }, 'zero discount': { discount_percent: 0 }, 'tiny discount': { discount_percent: 0.001 }, 'excess discount': { discount_percent: 101 }, 'timezone missing': { starts_at: '2026-10-01T12:00' }, 'invalid calendar': { starts_at: '2026-02-30T12:00:00+08:00' }, 'end before start': { ends_at: '2026-09-01T12:00:00+08:00' }, 'equal time': { ends_at: validManualAd.starts_at },
})) test(`manual ad rejects ${label}`, () => assert.throws(() => parseManualAdInput({ ...validManualAd, ...patch }), error => (error as { status?: number }).status === 400));

test('manual ad rejects subsecond intervals that collapse at database precision', () => {
  assert.throws(() => parseManualAdInput({ ...validManualAd, starts_at: '2026-10-01T12:00:00.100+08:00', ends_at: '2026-10-01T12:00:00.200+08:00' }), /结束时间必须晚于开始时间/);
});
