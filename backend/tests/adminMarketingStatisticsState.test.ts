import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAdminMarketingStatisticsSearch,
  readAdminMarketingStatisticsQuery,
  updateAdminMarketingStatisticsQuery,
} from '../../src/admin/marketing/marketingStatisticsState';

test('admin marketing statistics query normalizes invalid and default values', () => {
  assert.deepEqual(readAdminMarketingStatisticsQuery(''), {
    page: 1,
    q: '',
    status: 'all',
    placement: 'all',
  });
  assert.deepEqual(readAdminMarketingStatisticsQuery('?page=-3&status=nope&placement=home_9&q=%20YH%20'), {
    page: 1,
    q: 'YH',
    status: 'all',
    placement: 'all',
  });
  assert.deepEqual(readAdminMarketingStatisticsQuery('?placement=home_5'), {
    page: 1,
    q: '',
    status: 'all',
    placement: 'home_5',
  });
});

test('admin marketing statistics query serializes only non-default values', () => {
  assert.equal(buildAdminMarketingStatisticsSearch({
    page: 2,
    q: 'YH',
    status: 'expired',
    placement: 'home_2',
  }), '?q=YH&status=expired&placement=home_2&page=2');
  assert.equal(buildAdminMarketingStatisticsSearch({
    page: 1,
    q: '',
    status: 'all',
    placement: 'home_5',
  }), '?placement=home_5');
  assert.equal(buildAdminMarketingStatisticsSearch({
    page: 1,
    q: '',
    status: 'all',
    placement: 'all',
  }), '');
});

test('admin marketing statistics filter updates reset page while pagination preserves filters', () => {
  const current = { page: 3, q: 'YH', status: 'active' as const, placement: 'home_5' as const };
  assert.deepEqual(updateAdminMarketingStatisticsQuery(current, { status: 'expired' }), {
    page: 1,
    q: 'YH',
    status: 'expired',
    placement: 'home_5',
  });
  assert.deepEqual(updateAdminMarketingStatisticsQuery(current, { page: 4 }), {
    ...current,
    page: 4,
  });
});
