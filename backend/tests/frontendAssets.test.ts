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

test('readManifestAssets resolves Vite entry script and stylesheet with deploy version', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'gaterank-manifest-'));
  const manifestPath = path.join(dir, 'manifest.json');
  const previousVersion = process.env.PUBLIC_FRONTEND_ASSET_VERSION;
  process.env.PUBLIC_FRONTEND_ASSET_VERSION = 'commit-sha-123';
  try {
    await writeFile(manifestPath, JSON.stringify({
      'index.html': {
        file: 'assets/index.js',
        css: ['assets/index.css'],
        isEntry: true,
      },
    }));

    assert.deepEqual(readManifestAssets(manifestPath), {
      script: '/assets/index.js?v=commit-sha-123',
      stylesheet: '/assets/index.css?v=commit-sha-123',
    });
  } finally {
    if (previousVersion === undefined) {
      delete process.env.PUBLIC_FRONTEND_ASSET_VERSION;
    } else {
      process.env.PUBLIC_FRONTEND_ASSET_VERSION = previousVersion;
    }
    await rm(dir, { recursive: true, force: true });
  }
});

test('readManifestAssets preserves one module URL for release-isolated Vite assets', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'gaterank-manifest-'));
  const manifestPath = path.join(dir, 'manifest.json');
  const previousVersion = process.env.PUBLIC_FRONTEND_ASSET_VERSION;
  process.env.PUBLIC_FRONTEND_ASSET_VERSION = 'commit-sha-123';
  try {
    await writeFile(manifestPath, JSON.stringify({
      'index.html': {
        file: 'assets/commit-sha-123/index.js',
        css: ['assets/commit-sha-123/index.css'],
        isEntry: true,
      },
    }));

    assert.deepEqual(readManifestAssets(manifestPath), {
      script: '/assets/commit-sha-123/index.js',
      stylesheet: '/assets/commit-sha-123/index.css',
    });
  } finally {
    if (previousVersion === undefined) {
      delete process.env.PUBLIC_FRONTEND_ASSET_VERSION;
    } else {
      process.env.PUBLIC_FRONTEND_ASSET_VERSION = previousVersion;
    }
    await rm(dir, { recursive: true, force: true });
  }
});

test('resolvePublicFrontendAssets falls back when Vite manifest is absent', () => {
  const previousVersion = process.env.PUBLIC_FRONTEND_ASSET_VERSION;
  delete process.env.PUBLIC_FRONTEND_ASSET_VERSION;
  try {
    assert.deepEqual(
      resolvePublicFrontendAssets(path.join(os.tmpdir(), 'gaterank-missing-manifest.json')),
      FALLBACK_PUBLIC_FRONTEND_ASSETS,
    );
  } finally {
    if (previousVersion !== undefined) {
      process.env.PUBLIC_FRONTEND_ASSET_VERSION = previousVersion;
    }
  }
});

test('resolvePublicFrontendAssets falls back to the configured release directory', () => {
  const previousVersion = process.env.PUBLIC_FRONTEND_ASSET_VERSION;
  process.env.PUBLIC_FRONTEND_ASSET_VERSION = 'deploy-42';
  try {
    assert.deepEqual(
      resolvePublicFrontendAssets(path.join(os.tmpdir(), 'gaterank-missing-manifest.json')),
      {
        script: '/assets/deploy-42/index.js',
        stylesheet: '/assets/deploy-42/index.css',
      },
    );
  } finally {
    if (previousVersion === undefined) {
      delete process.env.PUBLIC_FRONTEND_ASSET_VERSION;
    } else {
      process.env.PUBLIC_FRONTEND_ASSET_VERSION = previousVersion;
    }
  }
});
