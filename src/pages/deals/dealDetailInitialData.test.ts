import assert from 'node:assert/strict';
import test from 'node:test';

import type { AirportDealDetailView } from '../../../shared/airportAds';
import {
  readDealDetailInitialData,
  shouldFetchDealDetailData,
} from './dealDetailInitialData';

const detailView: AirportDealDetailView = {
  airport: {
    id: 1,
    slug: 'elphantroute',
    name: '大象网络',
    website: 'https://www.elephant-ipcheck.com/',
    status: 'normal',
    plan_price_month: 12,
    has_trial: true,
    payment_methods: ['alipay'],
    airport_intro: '稳定网络服务。',
    tags: ['支持试用'],
  },
  active_deals: [],
  generated_at: '2026-08-03T10:00:00+08:00',
};

test('readDealDetailInitialData accepts the matching slug and prevents refetch', () => {
  const documentRef = documentWithInitialData({
    kind: 'deal_detail',
    params: { slug: 'elphantroute' },
    payload: detailView,
  });
  const initial = readDealDetailInitialData('elphantroute', documentRef);

  assert.deepEqual(initial, detailView);
  assert.equal(shouldFetchDealDetailData(initial), false);
});

test('readDealDetailInitialData rejects another airport slug and invalid JSON', () => {
  const documentRef = documentWithInitialData({
    kind: 'deal_detail',
    params: { slug: 'aurora' },
    payload: detailView,
  });

  assert.equal(readDealDetailInitialData('elphantroute', documentRef), null);
  assert.equal(readDealDetailInitialData('elphantroute', documentWithText('{bad-json')), null);
  assert.equal(shouldFetchDealDetailData(null), true);
});

function documentWithInitialData(envelope: unknown): Document {
  return documentWithText(JSON.stringify(envelope));
}

function documentWithText(textContent: string): Document {
  return {
    getElementById(id: string) {
      return id === '__GATERANK_INITIAL_DATA__' ? { textContent } : null;
    },
  } as Document;
}
