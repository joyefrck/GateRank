import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyBackendEnvToProcessEnv, loadBackendEnv } from '../src/utils/backendEnv';

test('loadBackendEnv prefers backend/.env from repo root style cwd', () => {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'gaterank-env-root-'));
  try {
    mkdirSync(path.join(tempRoot, 'backend'), { recursive: true });
    writeFileSync(path.join(tempRoot, 'backend/.env'), 'ADMIN_API_KEY=from-backend\nADMIN_JWT_SECRET=jwt-1\n');
    writeFileSync(path.join(tempRoot, '.env'), 'ADMIN_API_KEY=from-root\n');

    const env = loadBackendEnv({ cwd: tempRoot });

    assert.equal(env.ADMIN_API_KEY, 'from-backend');
    assert.equal(env.ADMIN_JWT_SECRET, 'jwt-1');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('applyBackendEnvToProcessEnv only fills missing keys', () => {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'gaterank-env-apply-'));
  const previousApiKey = process.env.ADMIN_API_KEY;
  const previousJwtSecret = process.env.ADMIN_JWT_SECRET;
  try {
    mkdirSync(path.join(tempRoot, 'backend'), { recursive: true });
    writeFileSync(path.join(tempRoot, 'backend/.env'), 'ADMIN_API_KEY=file-key\nADMIN_JWT_SECRET=file-secret\n');
    process.env.ADMIN_API_KEY = 'runtime-key';
    delete process.env.ADMIN_JWT_SECRET;

    applyBackendEnvToProcessEnv({ cwd: tempRoot });

    assert.equal(process.env.ADMIN_API_KEY, 'runtime-key');
    assert.equal(process.env.ADMIN_JWT_SECRET, 'file-secret');
  } finally {
    if (previousApiKey === undefined) {
      delete process.env.ADMIN_API_KEY;
    } else {
      process.env.ADMIN_API_KEY = previousApiKey;
    }
    if (previousJwtSecret === undefined) {
      delete process.env.ADMIN_JWT_SECRET;
    } else {
      process.env.ADMIN_JWT_SECRET = previousJwtSecret;
    }
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
