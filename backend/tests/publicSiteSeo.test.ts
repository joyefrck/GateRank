import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePageOgImageMeta } from '../../src/site/publicSite';

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
  const meta = resolvePageOgImageMeta('/download');

  assert.deepEqual(meta, {
    path: '/og/download.png',
    alt: 'GateRank 翻墙工具下载页分享图',
    width: 1200,
    height: 630,
    type: 'image/png',
  });
});

test('resolvePageOgImageMeta reuses the unlock OG image for streaming check', () => {
  assert.deepEqual(resolvePageOgImageMeta('/tools/streaming-check'), {
    path: '/og/rankings-unlock.png',
    alt: 'GateRank 流媒体与 AI 服务检测工具分享图',
    width: 1200,
    height: 630,
    type: 'image/png',
  });
});

test('resolvePageOgImageMeta returns static OG images for indexable public utility pages', () => {
  assert.deepEqual(resolvePageOgImageMeta('/tools/dns-leak-test'), {
    path: '/og/rankings-region.png',
    alt: 'GateRank DNS 泄漏与解析器检测工具分享图',
    width: 1200,
    height: 630,
    type: 'image/png',
  });

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
