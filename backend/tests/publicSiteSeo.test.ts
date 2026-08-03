import test from 'node:test';
import assert from 'node:assert/strict';
import { withPublicBrandTitle } from '../../shared/publicBrand';
import {
  buildAirportDealDetailSeo,
  buildAirportDealDetailStructuredData,
  getPublicOgImageForPath as resolvePageOgImageMeta,
} from '../../shared/publicSeo';
import {
  buildAirportDealDetailPath,
  type AirportDealDetailView,
  type AirportDealView,
} from '../../shared/airportAds';

test('withPublicBrandTitle appends and normalizes the public brand suffix', () => {
  assert.equal(withPublicBrandTitle('IP 检测'), 'IP 检测 | 机场榜GateRank');
  assert.equal(withPublicBrandTitle('IP 检测 | GateRank'), 'IP 检测 | 机场榜GateRank');
  assert.equal(withPublicBrandTitle('IP 检测 | 机场榜GateRank'), 'IP 检测 | 机场榜GateRank');
});

test('resolvePageOgImageMeta returns the monthly reports default OG image', () => {
  const meta = resolvePageOgImageMeta('/monthly-reports');

  assert.deepEqual(meta, {
    path: '/og/monthly-reports.png',
    alt: 'GateRank 机场 VPN 月度报告分享图',
    width: 1200,
    height: 630,
    type: 'image/png',
  });
});

test('resolvePageOgImageMeta returns the download page OG image', () => {
  const meta = resolvePageOgImageMeta('/tools/download');

  assert.deepEqual(meta, {
    path: '/og/download.png',
    alt: 'GateRank 翻墙工具下载页分享图',
    width: 1200,
    height: 630,
    type: 'image/png',
  });
});

test('resolvePageOgImageMeta returns dedicated tool OG images', () => {
  assert.deepEqual(resolvePageOgImageMeta('/tools'), {
    path: '/og/tools.png',
    alt: 'GateRank 网络检测与科学上网工具箱分享图',
    width: 1200,
    height: 630,
    type: 'image/png',
  });

  assert.deepEqual(resolvePageOgImageMeta('/tools/streaming-check'), {
    path: '/og/tools-streaming-check.png',
    alt: 'GateRank 流媒体解锁检测工具分享图',
    width: 1200,
    height: 630,
    type: 'image/png',
  });

  assert.deepEqual(resolvePageOgImageMeta('/tools/ip-check'), {
    path: '/og/tools-ip-check.png',
    alt: 'GateRank IP 地理位置查询工具分享图',
    width: 1200,
    height: 630,
    type: 'image/png',
  });

  assert.deepEqual(resolvePageOgImageMeta('/tools/dns-leak-test'), {
    path: '/og/tools-dns-leak-test.png',
    alt: 'GateRank DNS 泄漏检测工具分享图',
    width: 1200,
    height: 630,
    type: 'image/png',
  });
});

test('resolvePageOgImageMeta returns static OG images for indexable public utility pages', () => {
  assert.deepEqual(resolvePageOgImageMeta('/apply'), {
    path: '/og/apply.png',
    alt: 'GateRank 申请入驻测试分享图',
    width: 1200,
    height: 630,
    type: 'image/png',
  });

  assert.deepEqual(resolvePageOgImageMeta('/for-ai'), {
    path: '/og/for-ai.png',
    alt: 'GateRank for AI 数据入口分享图',
    width: 1200,
    height: 630,
    type: 'image/png',
  });

  assert.deepEqual(resolvePageOgImageMeta('/ranking-transparency'), {
    path: '/og/methodology.png',
    alt: 'GateRank 评分收费与排名独立性声明分享图',
    width: 1200,
    height: 630,
    type: 'image/png',
  });

  assert.deepEqual(resolvePageOgImageMeta('/airports/nebula'), {
    path: '/og/airport-report.png',
    alt: 'GateRank 机场测评报告分享图',
    width: 1200,
    height: 630,
    type: 'image/png',
  });
});

test('resolvePageOgImageMeta returns category OG images for indexable ranking filter pages', () => {
  const checks = [
    ['/rankings/payment/alipay', '/og/rankings-payment.png', 'GateRank 支持支付宝机场排行分享图'],
    ['/rankings/unlock/chatgpt', '/og/rankings-unlock.png', 'GateRank 支持 ChatGPT 机场排行分享图'],
    ['/rankings/client/clash-verge', '/og/rankings-client.png', 'GateRank 支持 Clash Verge 机场排行分享图'],
    ['/rankings/region/hong-kong', '/og/rankings-region.png', 'GateRank 香港节点机场排行分享图'],
    ['/rankings/line/iepl', '/og/rankings-line.png', 'GateRank IEPL 专线机场排行分享图'],
  ] as const;

  for (const [path, imagePath, alt] of checks) {
    assert.deepEqual(resolvePageOgImageMeta(path), {
      path: imagePath,
      alt,
      width: 1200,
      height: 630,
      type: 'image/png',
    }, path);
  }
});

test('airport deal detail SEO keeps multiple campaigns on one airport URL', () => {
  const view = createAirportDealDetailView([createDeal(6, 'ABIDTEF'), createDeal(8, 'ELEPHANT20')]);
  const path = buildAirportDealDetailPath('elphantroute');
  const seo = buildAirportDealDetailSeo(view, 2026);
  const jsonLd = buildAirportDealDetailStructuredData('https://gate-rank.com', view, 2026);
  const serialized = JSON.stringify(jsonLd);

  assert.equal(path, '/deals/elphantroute');
  assert.match(seo.title, /^大象网络优惠码 2026/);
  assert.match(seo.description, /2 个有效优惠活动/);
  assert.match(serialized, /https:\/\/gate-rank\.com\/deals\/elphantroute/);
  assert.equal(serialized.match(/ABIDTEF/g)?.length, 1);
  assert.equal(serialized.match(/ELEPHANT20/g)?.length, 1);
  assert.doesNotMatch(serialized, /\/deals\/(6|8)/);
});

test('airport deal detail SEO remains truthful without an active campaign', () => {
  const seo = buildAirportDealDetailSeo(createAirportDealDetailView([]), 2026);

  assert.match(seo.description, /当前暂无有效优惠码/);
  assert.doesNotMatch(seo.description, /有效优惠活动/);
});

test('airport deal detail paths reuse the deals OG image', () => {
  assert.deepEqual(resolvePageOgImageMeta('/deals/elphantroute'), {
    path: '/og/deals-coupons.png',
    alt: 'GateRank 机场优惠码大全分享图',
    width: 1200,
    height: 630,
    type: 'image/png',
  });
});

function createAirportDealDetailView(activeDeals: AirportDealView[]): AirportDealDetailView {
  return {
    airport: {
      id: 1,
      slug: 'elphantroute',
      name: '大象网络',
      website: 'https://www.elephant-ipcheck.com/',
      status: 'normal',
      plan_price_month: 12,
      has_trial: true,
      payment_methods: ['alipay', 'usdt_trc20'],
      airport_intro: '专注稳定高速网络服务。',
      tags: ['支持试用'],
    },
    active_deals: activeDeals,
    generated_at: '2026-08-03T10:00:00+08:00',
  };
}

function createDeal(campaignId: number, couponCode: string): AirportDealView {
  return {
    campaign_id: campaignId,
    airport_id: 1,
    airport_name: '大象网络',
    airport_slug: 'elphantroute',
    website: 'https://www.elephant-ipcheck.com/',
    report_url: '/airports/elphantroute',
    coupon_code: couponCode,
    discount_title: campaignId === 6 ? '新老用户九折' : '月付套餐优惠',
    discount_description: campaignId === 6 ? '新老用户一律九折优惠' : '指定月付套餐可用',
    applicable_plan: campaignId === 6 ? '季付 / 半年付' : '月付',
    starts_at: campaignId === 6 ? '2026-07-25T19:29:52+08:00' : '2026-08-01T00:02:02+08:00',
    ends_at: campaignId === 6 ? '2026-10-25T19:29:52+08:00' : '2026-09-01T00:02:02+08:00',
    purchased_months: campaignId === 6 ? 3 : 1,
    billed_amount: campaignId === 6 ? 3000 : 1000,
    is_stackable: false,
    refund_supported: campaignId === 6,
    supports_trial: true,
    supports_usdt: true,
    supports_streaming: true,
    supports_ai: true,
    low_price_plan: true,
    discount_percent: campaignId === 6 ? 10 : 20,
    created_at: campaignId === 6 ? '2026-07-25T19:29:52+08:00' : '2026-08-01T00:02:02+08:00',
  };
}
