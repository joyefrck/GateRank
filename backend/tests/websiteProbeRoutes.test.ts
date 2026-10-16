import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { errorHandler } from '../src/middleware/errorHandler';
import { createPerformanceProbeRoutes } from '../src/routes/performanceProbeRoutes';

async function request(queue: Record<string, unknown>, method = 'GET', payload?: unknown, authenticated = true) {
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { if (authenticated) req.performanceProbeAuth = { probe_id: 'cn-shanghai' } as never; next(); });
  app.use(createPerformanceProbeRoutes({ jobService: {} as never, websiteProbeQueue: queue as never }));
  app.use(errorHandler);
  const server = app.listen(0);
  try {
    return await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/website-${method === 'GET' ? 'jobs' : 'runs'}`, {
      method, headers: { 'Content-Type':'application/json' }, body: payload === undefined ? undefined : JSON.stringify(payload),
    });
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
}
test('website jobs use authenticated identity and return no subscription data', async () => {
  const response = await request({ lease: async (probe: string) => {
    assert.equal(probe,'cn-shanghai'); return { job_id:'job',target_url:'https://example.com/',lease_token:'lease' };
  } });
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{job_id:'job',target_url:'https://example.com/',lease_token:'lease'});
});
test('empty website queue returns 204', async () => {
  assert.equal((await request({lease:async () => null})).status,204);
});
test('unauthenticated website jobs are rejected before queue access', async () => {
  assert.equal((await request({lease:async () => { throw new Error('should not run'); }},'GET',undefined,false)).status,401);
});
test('website submission cannot override the bearer identity', async () => {
  let called = false;
  const response = await request({submit: async (probe: string) => { called = true; assert.equal(probe,'cn-shanghai'); }},'POST',{probe_id:'cn-guangzhou'});
  assert.equal(response.status,201); assert.equal(called,true);
});
test('oversize evidence is rejected before storage', async () => {
  assert.equal((await request({submit:async () => { throw new Error('should not run'); }},'POST',{data:'x'.repeat(33000)})).status,413);
});
