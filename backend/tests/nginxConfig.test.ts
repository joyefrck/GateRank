import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

test('nginx proxies airport report pages to backend prerender route', async () => {
  const config = await readFile(path.join(process.cwd(), 'nginx.conf'), 'utf8');
  assert.match(config, /location\s+\/airports\/\s*\{[\s\S]*?proxy_pass\s+http:\/\/gaterank-api:8787;[\s\S]*?\}/);
});
