import test from 'node:test';
import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import express from 'express';

import { errorHandler } from '../src/middleware/errorHandler';
import { createPerformanceProbeRoutes } from '../src/routes/performanceProbeRoutes';

function createProbeApp(service: {
  leaseNextJob: () => Promise<unknown>;
  submitRun: (probeId: string, payload: Record<string, unknown>) => Promise<unknown>;
}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.performanceProbeAuth = {
      probe_id: 'cn-shanghai',
      display_name: '上海',
      region_code: 'cn-shanghai',
      provider: 'tencent-cloud',
      bandwidth_mbps: 200,
      test_profile: 'mainland_multi_target_v1',
      scoring_rule_version: 'cn_dual_probe_v1',
    };
    next();
  });
  app.use('/api/v1/performance-probe', createPerformanceProbeRoutes({
    jobService: service as never,
  }));
  app.use(errorHandler);
  return app;
}

test('GET /jobs returns 204 for an empty queue', async () => {
  const app = createProbeApp({
    leaseNextJob: async () => null,
    submitRun: async () => ({ run_id: 1, job_id: 'job-1', duplicate: false }),
  });
  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/performance-probe/jobs`);
    assert.equal(response.status, 204);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('POST /runs rejects a forged probe id before storing evidence', async () => {
  let submissions = 0;
  const app = createProbeApp({
    leaseNextJob: async () => null,
    submitRun: async () => {
      submissions += 1;
      return { run_id: 1, job_id: 'job-1', duplicate: false };
    },
  });
  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/performance-probe/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: 'job-1',
        probe_id: 'cn-guangzhou',
        sampled_at: '2026-08-08T12:00:00+08:00',
        status: 'success',
      }),
    });
    const body = JSON.stringify(await response.json());

    assert.equal(response.status, 403);
    assert.equal(submissions, 0);
    assert.doesNotMatch(body, /raw_uri|password|token_hash/i);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('POST /runs returns stable ids for an accepted submission', async () => {
  const app = createProbeApp({
    leaseNextJob: async () => null,
    submitRun: async (probeId, payload) => {
      assert.equal(probeId, 'cn-shanghai');
      assert.equal(payload.job_id, 'job-1');
      return { run_id: 44, job_id: 'job-1', duplicate: false };
    },
  });
  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/performance-probe/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: 'job-1',
        sampled_at: '2026-08-08T12:00:00+08:00',
        status: 'success',
        calibration_status: 'passed',
        calibration_mbps: 200,
      }),
    });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { run_id: 44, job_id: 'job-1', duplicate: false });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
