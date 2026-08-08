import test from 'node:test';
import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import { createHash } from 'node:crypto';
import express from 'express';

import { performanceProbeAuth } from '../src/middleware/performanceProbeAuth';
import { errorHandler } from '../src/middleware/errorHandler';

test('performanceProbeAuth binds a bearer token to a sanitized probe identity', async () => {
  const rawToken = 'probe-token-with-enough-entropy-123456';
  const expectedHash = createHash('sha256').update(rawToken).digest('hex');
  let touched = '';
  const app = express();
  app.use(performanceProbeAuth({
    findEnabledByTokenHash: async (hash) => {
      assert.equal(hash, expectedHash);
      return {
        probe_id: 'cn-shanghai',
        display_name: '上海',
        region_code: 'cn-shanghai',
        provider: 'tencent-cloud',
        bandwidth_mbps: 200,
        probe_type: 'mainland',
        test_profile: 'mainland_multi_target_v1',
        scoring_rule_version: 'cn_dual_probe_v1',
        globally_enabled: true,
        token_configured: true,
        token_last_rotated_at: null,
        last_seen_at: null,
        created_at: '2026-08-08T00:00:00+08:00',
        updated_at: '2026-08-08T00:00:00+08:00',
      };
    },
    touchLastSeen: async (probeId) => {
      touched = probeId;
    },
  }));
  app.get('/whoami', (req, res) => res.json(req.performanceProbeAuth));
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/whoami`, {
      headers: { Authorization: `Bearer ${rawToken}` },
    });
    const body = await response.json() as Record<string, unknown>;

    assert.equal(response.status, 200);
    assert.equal(body.probe_id, 'cn-shanghai');
    assert.equal('token_hash' in body, false);
    assert.equal(touched, 'cn-shanghai');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('performanceProbeAuth rejects missing and control-character tokens without lookup', async () => {
  let lookups = 0;
  const app = express();
  app.use(performanceProbeAuth({
    findEnabledByTokenHash: async () => {
      lookups += 1;
      return null;
    },
    touchLastSeen: async () => undefined,
  }));
  app.get('/whoami', (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const missing = await fetch(`http://127.0.0.1:${port}/whoami`);
    const malformed = await fetch(`http://127.0.0.1:${port}/whoami`, {
      headers: { Authorization: 'Basic abc' },
    });
    assert.equal(missing.status, 401);
    assert.equal(malformed.status, 401);
    assert.equal(lookups, 0);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
