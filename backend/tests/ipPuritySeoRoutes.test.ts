import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createIpPurityPublicRoutes } from '../src/routes/ipPurityRoutes';
import { errorHandler } from '../src/middleware/errorHandler';
import { renderIpPurityPublicPage } from '../src/services/publicPageRenderer';
import { DEFAULT_IP_PURITY_CONFIG, buildIpPuritySeo, IP_PURITY_PATH } from '../../shared/ipPurity';
import { PUBLIC_TOOL_DEFINITIONS } from '../../shared/publicTools';
import { toMarketingPageKind } from '../../src/site/marketingRoutes';

test('SSR emits configured metadata, matching JSON-LD and config only; escapes script content', () => {
  const config = { ...DEFAULT_IP_PURITY_CONFIG, seo_title: '独立标题', seo_description: '</script><script>alert(1)</script>', og_image_url: '/og/custom.png' };
  const html = renderIpPurityPublicPage('https://example.com', config);
  const seo = buildIpPuritySeo(config, 'https://example.com');
  assert.ok(html.includes(`<title>${seo.title}</title>`));
  assert.ok(html.includes('href="https://example.com/tools/ip-purity-check"'));
  assert.ok(html.includes('content="https://example.com/og/custom.png"'));
  assert.ok(!html.includes('</script><script>alert(1)</script>'));
  const payload = JSON.parse(html.match(/id="__GATERANK_INITIAL_DATA__"[^>]*>(.*?)<\/script>/s)![1]);
  assert.equal(payload.kind, 'ip_purity'); assert.deepEqual(payload.payload, config);
  assert.equal(payload.payload.ip, undefined);
  assert.ok(html.includes('FAQPage')); assert.ok(html.includes('原生 IP'));
  assert.ok(PUBLIC_TOOL_DEFINITIONS.some((tool) => tool.href === IP_PURITY_PATH));
  assert.equal(toMarketingPageKind('ip_purity'), 'ip_purity');
});
test('routes validate input, keep results private and remove configuration endpoints', async () => {
  const app = express(); app.use(express.json());
  const queries: string[] = [];
  app.use('/api/v1', createIpPurityPublicRoutes({ lookup: async (ip) => { queries.push(ip); return { ip, checked_at: 'now', geo: null, risk: null, risk_error: 'quota' }; } }));
  app.use(errorHandler);
  const server = app.listen(0); const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const response = await fetch(`${base}/api/v1/tools/ip-purity-check`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '8.8.8.8' }, body: '{}' });
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal((await response.json() as { risk_error: string }).risk_error, 'quota'); assert.deepEqual(queries, ['8.8.8.8']);
    for (const query of ['127.0.0.1', 'example.com', 'http://8.8.8.8', '8.8.8.8,1.1.1.1']) {
      const invalid = await fetch(`${base}/api/v1/tools/ip-purity-check`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query }) });
      assert.equal(invalid.status, 400);
    }
    assert.equal(queries.length, 1);
    const auto = await fetch(`${base}/api/v1/tools/ip-purity-check`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal((await auto.json() as { code: string }).code, 'IP_PURITY_CLIENT_IP_REQUIRED');
    assert.equal((await fetch(`${base}/api/v1/tools/ip-purity-page`)).status, 404);
    assert.equal((await fetch(`${base}/api/v1/admin/tools/ip-purity-page`, { method: 'PATCH' })).status, 404);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});

test('fixed SEO includes brand long tails and matching FAQ content', () => {
  const seo = buildIpPuritySeo(DEFAULT_IP_PURITY_CONFIG, 'https://gate-rank.com');
  const html = renderIpPurityPublicPage('https://gate-rank.com', DEFAULT_IP_PURITY_CONFIG);
  assert.ok(seo.title.endsWith('机场榜GateRank'));
  for (const term of ['机场榜IP纯净度检测', 'GateRank原生IP查询', '机场节点IP检测']) assert.ok(html.includes(term));
  assert.ok(html.includes('机场榜 GateRank 如何查询机场节点出口 IP？'));
});
