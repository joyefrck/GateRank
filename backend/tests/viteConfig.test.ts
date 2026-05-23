import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

test('vite emits stable public frontend asset filenames for cross-image manifest alignment', async () => {
  const config = await readFile(path.join(process.cwd(), 'vite.config.ts'), 'utf8');

  assert.match(config, /manifest:\s*true/);
  assert.match(config, /entryFileNames:\s*['"]assets\/\[name\]\.js['"]/);
  assert.match(config, /chunkFileNames:\s*['"]assets\/\[name\]\.js['"]/);
  assert.match(config, /assetFileNames:\s*['"]assets\/\[name\]\[extname\]['"]/);
});
