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
    '/methodology',
    '/apply',
    '/risk-monitor',
    '/risk-watch',
    '/sitemap.xml',
    '/llms.txt',
    '/llms-full.txt',
    '/openapi.json',
    '/.well-known/ai-plugin.json',
    '/data/summary.json',
    '/data/rankings.json',
    '/data/risk-monitor.json',
    '/data/summary.md',
    '/data/rankings.md',
    '/data/risk-monitor.md',
    '/publish-token-docs',
  ]) {
    const block = getLocationBlock(config, `= ${route}`);
    assert.match(block, /proxy_pass\s+http:\/\/gaterank-api:8787/);
  }

  assert.match(getLocationBlock(config, '/airports/'), /proxy_pass\s+http:\/\/gaterank-api:8787;/);
  assert.match(getLocationBlock(config, '/reports/'), /proxy_pass\s+http:\/\/gaterank-api:8787;/);
  assert.match(getLocationBlock(config, '/news'), /proxy_pass\s+http:\/\/gaterank-api:8787;/);
});

test('nginx reserves SPA fallback only for admin and portal entry routes', async () => {
  const config = await readFile(path.join(process.cwd(), 'nginx.conf'), 'utf8');

  assert.match(getLocationBlock(config, '= /admin'), /try_files\s+\/index\.html\s+=404;/);
  assert.match(getLocationBlock(config, '^~ /admin/'), /try_files\s+\$uri\s+\$uri\/\s+\/index\.html;/);
  assert.match(getLocationBlock(config, '= /portal'), /try_files\s+\/index\.html\s+=404;/);
  assert.match(getLocationBlock(config, '= /portal/'), /try_files\s+\/index\.html\s+=404;/);
});

test('nginx proxies API routes and returns hard 404 for unknown public paths', async () => {
  const config = await readFile(path.join(process.cwd(), 'nginx.conf'), 'utf8');
  assert.match(getLocationBlock(config, '^~ /api/'), /proxy_pass\s+http:\/\/gaterank-api:8787;/);
  assert.match(getLocationBlock(config, '^~ /uploads/'), /proxy_pass\s+http:\/\/gaterank-api:8787\/uploads\/;/);

  const catchAll = getLocationBlock(config, '/');
  assert.match(catchAll, /return\s+404;/);
  assert.doesNotMatch(catchAll, /\/index\.html/);
});

function getLocationBlock(config: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matched = config.match(new RegExp(`location\\s+${escapedSelector}\\s*\\{[\\s\\S]*?\\n  \\}`));
  assert.ok(matched, `missing nginx location ${selector}`);
  return matched[0];
}
