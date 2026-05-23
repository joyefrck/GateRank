import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  FALLBACK_PUBLIC_FRONTEND_ASSETS,
  readManifestAssets,
  resolvePublicFrontendAssets,
} from '../src/services/frontendAssets';

test('readManifestAssets resolves hashed Vite entry script and stylesheet', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'gaterank-manifest-'));
  const manifestPath = path.join(dir, 'manifest.json');
  try {
    await writeFile(manifestPath, JSON.stringify({
      'index.html': {
        file: 'assets/index-CkG9aP2q.js',
        css: ['assets/index-BzS9fL3m.css'],
        isEntry: true,
      },
    }));

    assert.deepEqual(readManifestAssets(manifestPath), {
      script: '/assets/index-CkG9aP2q.js',
      stylesheet: '/assets/index-BzS9fL3m.css',
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('resolvePublicFrontendAssets falls back when Vite manifest is absent', () => {
  assert.deepEqual(
    resolvePublicFrontendAssets(path.join(os.tmpdir(), 'gaterank-missing-manifest.json')),
    FALLBACK_PUBLIC_FRONTEND_ASSETS,
  );
});
