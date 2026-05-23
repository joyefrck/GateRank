import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

test('vite keeps content-hashed frontend assets for deploy cache busting', async () => {
  const config = await readFile(path.join(process.cwd(), 'vite.config.ts'), 'utf8');

  assert.match(config, /manifest:\s*true/);
  assert.doesNotMatch(config, /entryFileNames:\s*['"]assets\/\[name\]\.js['"]/);
  assert.doesNotMatch(config, /chunkFileNames:\s*['"]assets\/\[name\]\.js['"]/);
  assert.doesNotMatch(config, /assetFileNames:\s*['"]assets\/\[name\]\[extname\]['"]/);
});
