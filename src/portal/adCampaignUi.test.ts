import test from 'node:test';
import assert from 'node:assert/strict';
import type { PortalAirportAdCampaignView, PortalAirportAdStatus } from '../../shared/airportAds';
import { getCampaignMonthlyPrice, getRenewalEndsAt } from './adCampaignUi';

const status = {
  monthly_price: 1000,
  home_slot_monthly_prices: { 1: 6000, 2: 5000, 3: 4000, 4: 3000, 5: 2000 },
} as PortalAirportAdStatus;

function campaign(overrides: Partial<PortalAirportAdCampaignView> = {}): PortalAirportAdCampaignView {
  return {
    campaign_id: 99,
    airport_id: 11,
    airport_name: '星云机场',
    airport_slug: 'nebula',
    website: 'https://nebula.example.com',
    report_url: '/airports/nebula',
    coupon_code: 'NEW220',
    discount_title: '新用户优惠',
    discount_description: '首单优惠',
    applicable_plan: '月付',
    starts_at: '2026-07-15T10:00:00+08:00',
    ends_at: '2026-08-15T10:00:00+08:00',
    purchased_months: 1,
    billed_amount: 1000,
    is_stackable: false,
    refund_supported: false,
    supports_trial: false,
    supports_usdt: false,
    supports_streaming: false,
    supports_ai: false,
    low_price_plan: false,
    discount_percent: null,
    created_at: '2026-07-15T10:00:00+08:00',
    status: 'active',
    status_label: '投放中',
    is_active: true,
    ...overrides,
  };
}

test('getCampaignMonthlyPrice uses the current saved placement price', () => {
  assert.equal(getCampaignMonthlyPrice(status, campaign()), 1000);
  assert.equal(getCampaignMonthlyPrice(status, campaign({ home_slot: 2, is_homepage: true })), 5000);
  assert.equal(getCampaignMonthlyPrice(status, campaign({ home_slot: 5, is_homepage: true })), 2000);
});

test('getRenewalEndsAt extends active ads from ends_at and expired ads from now', () => {
  const now = new Date('2026-07-31T10:00:00+08:00');
  assert.equal(
    getRenewalEndsAt(campaign(), 1, now).toISOString(),
    new Date('2026-09-15T10:00:00+08:00').toISOString(),
  );
  assert.equal(
    getRenewalEndsAt(campaign({ status: 'expired', is_active: false, ends_at: '2026-07-15T10:00:00+08:00' }), 1, now).toISOString(),
    new Date('2026-08-31T10:00:00+08:00').toISOString(),
  );
});
