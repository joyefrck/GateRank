import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';

import { createPerformanceProbeRateLimit } from '../src/middleware/rateLimit';

test('performance probe rate limit ignores untrusted forwarded IP headers behind the production proxy', async () => {
  const app = express();
  app.use(createPerformanceProbeRateLimit());
  app.get('/probe', (_req, res) => res.json({ ok: true }));

  const loggedErrors: unknown[][] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => loggedErrors.push(args);
  const server = app.listen(0);

  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/probe`, {
      headers: { 'X-Forwarded-For': '198.51.100.8' },
    });

    assert.equal(response.status, 200);
    assert.equal(
      loggedErrors.some((args) => args.some((arg) => String(arg).includes('ERR_ERL_UNEXPECTED_X_FORWARDED_FOR'))),
      false,
    );
  } finally {
    console.error = originalConsoleError;
    await closeServer(server);
  }
});

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
