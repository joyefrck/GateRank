import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('production API image installs subscription parsing and DNS transport dependencies', async () => {
  const dockerfile = await readFile(new URL('../../Dockerfile.api', import.meta.url), 'utf8');

  const packages = dockerfile.match(/apk add --no-cache([^\n]*(?:\\\n[^\n]*)*)/)?.[1]?.split(/[\s\\]+/) ?? [];
  for (const dependency of ['curl', 'python3', 'py3-yaml', 'py3-dnspython', 'py3-httpx', 'py3-h2', 'sing-box']) {
    assert.ok(packages.includes(dependency), `Missing runtime dependency: ${dependency}`);
  }
});
