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
