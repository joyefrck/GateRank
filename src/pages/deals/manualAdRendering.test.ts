import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderDealsPublicPage } from '../../../backend/src/services/publicPageRenderer';
import type { AirportDealView } from '../../../shared/airportAds';

// The client marketing module reads browser attribution during import.
const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
Object.defineProperty(globalThis, 'document', { configurable: true, value: { referrer: '' } });
Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { search: '', origin: 'https://example.com' }, sessionStorage: { getItem: () => null, setItem: () => undefined } } });
const { DealCard } = await import('./DealCard');
if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor); else Reflect.deleteProperty(globalThis, 'document');
if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor); else Reflect.deleteProperty(globalThis, 'window');

const deal: AirportDealView = { campaign_id: 1, airport_id: 1, airport_name: '测试机场', airport_slug: 'test', website: 'https://example.com', report_url: '/airports/test', coupon_code: '', discount_title: '管理员活动标题', discount_description: '', applicable_plan: '全部套餐', starts_at: '2026-10-01T00:00:00+08:00', ends_at: '2026-11-01T00:00:00+08:00', purchased_months: 0, billed_amount: 0, is_stackable: false, refund_supported: false, supports_trial: false, supports_usdt: false, supports_streaming: false, supports_ai: false, low_price_plan: false, discount_percent: null, created_at: '2026-10-01T00:00:00+08:00' };
test('manual ads without coupons display their title and no empty copy action in React and SSR', () => {
  const react = renderToStaticMarkup(createElement(DealCard, { deal, tone: 'blue', pagePath: '/deals', detailHref: '/deals/test' }));
  assert.match(react, /无需优惠码/); assert.match(react, /管理员活动标题/); assert.doesNotMatch(react, /aria-label="复制优惠码"/);
  assert.match(react, /rel="sponsored nofollow noreferrer noopener"/);
  const ssr = renderDealsPublicPage('https://example.com', [deal]);
  assert.match(ssr, /无需优惠码/); assert.match(ssr, /管理员活动标题/);
});
test('merchant coupons retain copy action and original description', () => {
  const react = renderToStaticMarkup(createElement(DealCard, { deal: { ...deal, coupon_code: 'CODE20', discount_description: '原有优惠说明' }, tone: 'blue', pagePath: '/deals', detailHref: '/deals/test' }));
  assert.match(react, /CODE20/); assert.match(react, /aria-label="复制优惠码"/); assert.match(react, /原有优惠说明/);
});
