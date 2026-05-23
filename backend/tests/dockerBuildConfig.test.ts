import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

test('API image builds frontend manifest with the same public Vite env as web image', async () => {
  const dockerfile = await readFile(path.join(process.cwd(), 'Dockerfile.api'), 'utf8');
  const workflow = await readFile(path.join(process.cwd(), '.github/workflows/docker-publish.yml'), 'utf8');

  assert.match(dockerfile, /ARG VITE_SITE_URL=https:\/\/gate-rank\.com/);
  assert.match(dockerfile, /ARG VITE_API_BASE=/);
  assert.match(dockerfile, /ARG PUBLIC_FRONTEND_ASSET_VERSION=/);
  assert.match(dockerfile, /ENV VITE_SITE_URL=\$VITE_SITE_URL/);
  assert.match(dockerfile, /ENV VITE_API_BASE=\$VITE_API_BASE/);
  assert.match(dockerfile, /ENV PUBLIC_FRONTEND_ASSET_VERSION=\$PUBLIC_FRONTEND_ASSET_VERSION/);
  assert.match(dockerfile, /FROM node:20-alpine\s+WORKDIR \/app\s+ARG PUBLIC_FRONTEND_ASSET_VERSION=\s+ENV PUBLIC_FRONTEND_ASSET_VERSION=\$PUBLIC_FRONTEND_ASSET_VERSION/);
  assert.match(workflow, /file:\s+\.\/Dockerfile\.api[\s\S]*?build-args:\s*\|[\s\S]*?VITE_SITE_URL=\$\{\{ env\.VITE_SITE_URL \}\}/);
  assert.match(workflow, /file:\s+\.\/Dockerfile\.api[\s\S]*?build-args:\s*\|[\s\S]*?VITE_API_BASE=\$\{\{ env\.VITE_API_BASE \}\}/);
  assert.match(workflow, /file:\s+\.\/Dockerfile\.api[\s\S]*?build-args:\s*\|[\s\S]*?PUBLIC_FRONTEND_ASSET_VERSION=\$\{\{ github\.sha \}\}/);
});
