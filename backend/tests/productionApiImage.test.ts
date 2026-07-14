import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('production API image installs PyYAML for Clash subscription parsing', async () => {
  const dockerfile = await readFile(new URL('../../Dockerfile.api', import.meta.url), 'utf8');

  assert.match(dockerfile, /apk add --no-cache[\s\\]*curl[\s\\]*python3[\s\\]*py3-yaml[\s\\]*sing-box/);
});
