import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  frontendAssetCompatibilitySources,
  frontendAssetDirectory,
} from '../../shared/frontendAssetPaths';

test('vite isolates entry, lazy chunks and styles by release with stable cross-image filenames', async () => {
  const config = await readFile(path.join(process.cwd(), 'vite.config.ts'), 'utf8');

  assert.match(config, /manifest:\s*true/);
  assert.match(config, /entryFileNames:\s*`\$\{assetDirectory\}\/\[name\]\.js`/);
  assert.match(config, /chunkFileNames:\s*`\$\{assetDirectory\}\/\[name\]\.js`/);
  assert.match(config, /assetFileNames:\s*`\$\{assetDirectory\}\/\[name\]\[extname\]`/);
  assert.equal(frontendAssetDirectory(), 'assets');
  assert.equal(frontendAssetDirectory('release-123'), 'assets/release-123');
  assert.notEqual(frontendAssetDirectory('release-123'), frontendAssetDirectory('release-456'));
  assert.throws(() => frontendAssetDirectory('../invalid/path'));
});

test('versioned builds emit stable compatibility entrypoints for cached HTML', async () => {
  const config = await readFile(path.join(process.cwd(), 'vite.config.ts'), 'utf8');

  assert.match(config, /frontendAssetCompatibilitySources\(assetDirectory\)/);
  assert.match(config, /fileName:\s*'assets\/index\.js'/);
  assert.match(config, /fileName:\s*'assets\/index\.css'/);
  assert.deepEqual(frontendAssetCompatibilitySources('assets/release-123'), {
    script: 'import "/assets/release-123/index.js";\n',
    stylesheet: '@import url("/assets/release-123/index.css");\n',
  });
  assert.equal(frontendAssetCompatibilitySources('assets'), null);
});

test('IP check bundles Leaflet with the entry instead of a cache-sensitive dynamic chunk', async () => {
  const source = await readFile(
    path.join(process.cwd(), 'src/pages/ipCheck/IpCheckMap.tsx'),
    'utf8',
  );

  assert.match(source, /import L from ['"]leaflet['"]/);
  assert.match(source, /import ['"]leaflet\/dist\/leaflet\.css['"]/);
  assert.doesNotMatch(source, /await import\(['"]leaflet['"]\)/);
  assert.doesNotMatch(source, /await import\(['"]leaflet\/dist\/leaflet\.css['"]\)/);
});
