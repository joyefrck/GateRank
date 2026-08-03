import test from 'node:test';
import assert from 'node:assert/strict';
import { AirportDealDetailService } from '../src/services/airportDealDetailService';
import type { Airport, AirportStatus } from '../src/types/domain';
import type { AirportDealView } from '../../shared/airportAds';

test('AirportDealDetailService groups every active campaign under one airport slug', async () => {
  const service = createService({}, [
    createDeal(6, 1, 'elphantroute', '2026-10-25T19:29:52+08:00'),
    createDeal(8, 1, 'elphantroute', '2026-09-01T00:02:02+08:00'),
    createDeal(9, 2, 'aurora', '2026-08-30T00:00:00+08:00'),
  ]);

  const view = await service.getBySlug(
    'elphantroute',
    new Date('2026-08-03T10:00:00+08:00'),
  );

  assert.equal(view?.airport.slug, 'elphantroute');
  assert.deepEqual(view?.active_deals.map((deal) => deal.campaign_id), [8, 6]);
  assert.equal(view?.generated_at, '2026-08-03T10:00:00+08:00');
});

test('AirportDealDetailService keeps a listed airport page when no deal is active', async () => {
  const view = await createService({}, []).getBySlug('elphantroute');

  assert.equal(view?.airport.name, '大象网络');
  assert.deepEqual(view?.active_deals, []);
});

test('AirportDealDetailService hides unknown and unlisted airports', async () => {
  const missingService = new AirportDealDetailService({
    airportRepository: { getBySlug: async () => null },
    airportAdCampaignRepository: { listActiveDeals: async () => [] },
  });
  const hiddenService = createService({ is_listed: false }, []);

  assert.equal(await missingService.getBySlug('missing'), null);
  assert.equal(await hiddenService.getBySlug('hidden'), null);
});

test('AirportDealDetailService rejects a malformed active campaign', async () => {
  const malformed = createDeal(6, 1, 'elphantroute', '2026-10-25T19:29:52+08:00');
  malformed.coupon_code = '';

  await assert.rejects(
    createService({}, [malformed]).getBySlug('elphantroute'),
    /invalid active airport deal 6: coupon_code/,
  );
});

function createService(airportOverrides: Partial<Airport>, deals: AirportDealView[]) {
  const airport: Airport = {
    id: 1,
    slug: 'elphantroute',
    name: '大象网络',
    website: 'https://www.elephant-ipcheck.com/',
    status: 'normal' as AirportStatus,
    is_listed: true,
    plan_price_month: 12,
    has_trial: true,
    payment_methods: ['alipay', 'usdt_trc20'],
    airport_intro: '专注稳定高速网络服务。',
    tags: ['支持试用'],
    created_at: '2026-03-21T21:01:54+08:00',
    ...airportOverrides,
  };
  return new AirportDealDetailService({
    airportRepository: { getBySlug: async () => airport },
    airportAdCampaignRepository: { listActiveDeals: async () => deals },
  });
}

function createDeal(
  campaignId: number,
  airportId: number,
  airportSlug: string,
  endsAt: string,
): AirportDealView {
  return {
    campaign_id: campaignId,
    airport_id: airportId,
    airport_name: airportId === 1 ? '大象网络' : '极光机场',
    airport_slug: airportSlug,
    website: airportId === 1 ? 'https://www.elephant-ipcheck.com/' : 'https://aurora.example.com/',
    report_url: `/airports/${airportSlug}`,
    coupon_code: `CODE${campaignId}`,
    discount_title: '新用户优惠',
    discount_description: '指定套餐可用',
    applicable_plan: '月付',
    starts_at: '2026-08-01T00:00:00+08:00',
    ends_at: endsAt,
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
    created_at: '2026-08-01T00:00:00+08:00',
  };
}
