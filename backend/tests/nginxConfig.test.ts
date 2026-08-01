import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

test('nginx proxies airport report pages to backend prerender route', async () => {
  const config = await readFile(path.join(process.cwd(), 'nginx.conf'), 'utf8');
  assert.match(config, /location\s+\/airports\/\s*\{[\s\S]*?proxy_pass\s+http:\/\/gaterank-api:8787;[\s\S]*?\}/);
});

test('nginx keeps public SEO routes proxied to backend prerender routes', async () => {
  const config = await readFile(path.join(process.cwd(), 'nginx.conf'), 'utf8');
  for (const route of [
    '/',
    '/rankings/all',
    '/monthly-reports',
    '/monthly-reports/',
    '/methodology',
    '/ranking-transparency',
    '/ranking-transparency/',
    '/deals',
    '/apply',
    '/risk-monitor',
    '/risk-watch',
    '/sitemap.xml',
    '/sitemap-ai.xml',
    '/robots.txt',
    '/llms.txt',
    '/llms-full.txt',
    '/openapi.json',
    '/.well-known/ai-plugin.json',
    '/for-ai',
    '/for-ai/',
    '/data',
    '/data/',
    '/data/summary.json',
    '/data/rankings.json',
    '/data/risk-monitor.json',
    '/data/summary.md',
    '/data/rankings.md',
    '/data/risk-monitor.md',
    '/publish-token-docs',
    '/download',
    '/download/',
    '/tools',
    '/tools/',
    '/tools/download',
    '/tools/streaming-check',
    '/tools/ip-check',
    '/tools/dns-leak-test',
  ]) {
    const block = getLocationBlock(config, `= ${route}`);
    assert.match(block, /proxy_pass\s+http:\/\/gaterank-api:8787/);
  }

  assert.match(getLocationBlock(config, '/airports/'), /proxy_pass\s+http:\/\/gaterank-api:8787;/);
  assert.match(getLocationBlock(config, '/reports/'), /proxy_pass\s+http:\/\/gaterank-api:8787;/);
  assert.match(getLocationBlock(config, '^~ /rankings/'), /proxy_pass\s+http:\/\/gaterank-api:8787;/);
  assert.match(getLocationBlock(config, '^~ /monthly-reports/'), /proxy_pass\s+http:\/\/gaterank-api:8787;/);
  assert.match(getLocationBlock(config, '/news'), /proxy_pass\s+http:\/\/gaterank-api:8787;/);
  assert.match(getLocationBlock(config, '^~ /tools/'), /proxy_pass\s+http:\/\/gaterank-api:8787;/);
  assert.match(getLocationBlock(config, '^~ /download/file/'), /proxy_pass\s+http:\/\/gaterank-api:8787;/);
  assert.match(getLocationBlock(config, '= /deals/'), /proxy_pass\s+http:\/\/gaterank-api:8787\/deals\/;/);
});

test('nginx redirects retired report collection aliases to the canonical monthly reports URL', async () => {
  const config = await readFile(path.join(process.cwd(), 'nginx.conf'), 'utf8');

  for (const route of ['/reports', '/reports/']) {
    const block = getLocationBlock(config, `= ${route}`);
    assert.match(block, /return\s+301\s+https:\/\/gate-rank\.com\/monthly-reports;/);
    assert.doesNotMatch(block, /proxy_pass/);
  }

  const legacyDetailBlock = getLocationBlock(config, '/reports/');
  assert.match(legacyDetailBlock, /proxy_pass\s+http:\/\/gaterank-api:8787;/);
});

test('nginx protects tool installer downloads with rate, connection and internal file serving limits', async () => {
  const config = await readFile(path.join(process.cwd(), 'nginx.conf'), 'utf8');

  assert.match(config, /limit_req_zone\s+\$binary_remote_addr\s+zone=tool_download_req:10m\s+rate=10r\/m;/);
  assert.match(config, /limit_conn_zone\s+\$binary_remote_addr\s+zone=tool_download_conn:10m;/);
  assert.match(config, /limit_conn_zone\s+\$server_name\s+zone=tool_download_global:10m;/);

  const publicDownloadBlock = getLocationBlock(config, '^~ /download/file/');
  assert.match(publicDownloadBlock, /limit_req\s+zone=tool_download_req\s+burst=20\s+nodelay;/);
  assert.match(publicDownloadBlock, /limit_conn\s+tool_download_conn\s+2;/);
  assert.match(publicDownloadBlock, /limit_conn\s+tool_download_global\s+50;/);

  const protectedUploadsBlock = getLocationBlock(config, '^~ /_protected_uploads/tools/files/');
  assert.match(protectedUploadsBlock, /internal;/);
  assert.match(protectedUploadsBlock, /proxy_pass\s+http:\/\/gaterank-api:8787\/uploads\/tools\/files\/;/);
  assert.match(protectedUploadsBlock, /limit_rate_after\s+10m;/);
  assert.match(protectedUploadsBlock, /limit_rate\s+2m;/);
});

test('nginx reserves private SPA fallbacks with noindex headers', async () => {
  const config = await readFile(path.join(process.cwd(), 'nginx.conf'), 'utf8');

  for (const location of ['= /admin', '^~ /admin/', '= /portal', '= /portal/', '^~ /portal/']) {
    const block = getLocationBlock(config, location);
    assert.match(block, /try_files\s+\/index\.html\s+=404;/);
    assert.match(block, /Cache-Control\s+"no-cache"/);
    assert.match(block, /X-Robots-Tag\s+"noindex, nofollow, noarchive, nosnippet"\s+always/);
  }
});

test('nginx proxies API routes and returns hard 404 for unknown public paths', async () => {
  const config = await readFile(path.join(process.cwd(), 'nginx.conf'), 'utf8');
  const apiBlock = getLocationBlock(config, '^~ /api/');
  assert.match(apiBlock, /proxy_pass\s+http:\/\/gaterank-api:8787;/);
  assert.match(apiBlock, /client_max_body_size\s+320m;/);
  assert.match(apiBlock, /proxy_request_buffering\s+off;/);
  assert.match(apiBlock, /proxy_send_timeout\s+300s;/);
  assert.match(apiBlock, /proxy_read_timeout\s+300s;/);
  assert.match(getLocationBlock(config, '^~ /api/v1/admin'), /X-Robots-Tag\s+"noindex, nofollow, noarchive, nosnippet"\s+always/);
  assert.match(getLocationBlock(config, '^~ /api/v1/portal'), /X-Robots-Tag\s+"noindex, nofollow, noarchive, nosnippet"\s+always/);
  assert.match(getLocationBlock(config, '^~ /uploads/'), /proxy_pass\s+http:\/\/gaterank-api:8787\/uploads\/;/);

  const catchAll = getLocationBlock(config, '/');
  assert.match(catchAll, /return\s+404;/);
  assert.doesNotMatch(catchAll, /\/index\.html/);
});

test('nginx keeps stable frontend assets and SPA entry revalidated', async () => {
  const config = await readFile(path.join(process.cwd(), 'nginx.conf'), 'utf8');

  const assets = getLocationBlock(config, '^~ /assets/');
  assert.match(assets, /expires\s+-1;/);
  assert.match(assets, /Cache-Control\s+"no-cache"/);

  const indexHtml = getLocationBlock(config, '= /index.html');
  assert.match(indexHtml, /expires\s+-1;/);
  assert.match(indexHtml, /Cache-Control\s+"no-cache"/);
});

function getLocationBlock(config: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matched = config.match(new RegExp(`location\\s+${escapedSelector}\\s*\\{[\\s\\S]*?\\n  \\}`));
  assert.ok(matched, `missing nginx location ${selector}`);
  return matched[0];
}
