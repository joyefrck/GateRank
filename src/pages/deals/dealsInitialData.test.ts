import assert from 'node:assert/strict';
import test from 'node:test';

import type { AirportDealView } from '../../../shared/airportAds';
import {
  readDealsInitialData,
  shouldFetchDealsData,
  type DealsResponse,
} from './dealsInitialData';

test('readDealsInitialData returns SSR deals payload and disables the client refetch', () => {
  const payload: DealsResponse = {
    items: [createDealView()],
    total: 1,
  };
  const documentRef = createDocumentWithInitialData({
    kind: 'deals',
    payload,
  });

  const initialData = readDealsInitialData(documentRef);

  assert.deepEqual(initialData, payload);
  assert.equal(shouldFetchDealsData(initialData), false);
});

test('readDealsInitialData keeps the API fallback enabled when SSR data is absent or invalid', () => {
  assert.equal(readDealsInitialData(createDocumentWithInitialData(null)), null);
  assert.equal(readDealsInitialData(createDocumentWithInitialData({ kind: 'home', payload: { items: [], total: 0 } })), null);
  assert.equal(readDealsInitialData(createDocumentWithRawText('{bad-json')), null);
  assert.equal(shouldFetchDealsData(null), true);
});

function createDocumentWithInitialData(envelope: unknown): Document {
  return createDocumentWithRawText(envelope === null ? null : JSON.stringify(envelope));
}

function createDocumentWithRawText(textContent: string | null): Document {
  return {
    getElementById(id: string) {
      if (id !== '__GATERANK_INITIAL_DATA__' || textContent === null) {
        return null;
      }
      return { textContent };
    },
  } as Document;
}

function createDealView(): AirportDealView {
  return {
    campaign_id: 1,
    airport_id: 1,
    airport_name: '星云机场',
    airport_slug: 'nebula',
    website: 'https://nebula.example.com',
    report_url: '/airports/nebula',
    coupon_code: 'NEW220',
    discount_title: '新用户优惠',
    discount_description: '新用户首单 8 折',
    applicable_plan: '月付',
    starts_at: '2026-05-24T10:00:00+08:00',
    ends_at: '2026-06-24T10:00:00+08:00',
    purchased_months: 1,
    billed_amount: 1000,
    is_stackable: false,
    refund_supported: false,
    supports_trial: true,
    supports_usdt: true,
    supports_streaming: true,
    supports_ai: true,
    low_price_plan: true,
    discount_percent: 20,
    created_at: '2026-05-24T10:00:00+08:00',
  };
}
