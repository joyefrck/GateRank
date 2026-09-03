import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createLiveScoreRoutes } from '../src/routes/liveScoreRoutes';
import { allocateBillingEligibility } from '../src/services/billingEligibilityService';

test('SSE emits a private-data-free invalidation when a wallet loses eligibility', async () => {
  let balance = 10;
  const app = express();
  app.use(createLiveScoreRoutes({ getSnapshot: async () => allocateBillingEligibility([
    { airport_id: 102, balance, display_score: 94, rankable: true },
  ], { click_charge_amount: 1.5 }) }));
  const server = app.listen(0);
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/scores/events`, { signal: controller.signal });
    assert.equal(res.headers.get('content-type'), 'text/event-stream');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(res.headers.get('x-accel-buffering'), 'no');
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    async function nextVersion() {
      let text = '';
      while (!/data: ([a-f0-9]{64})/.test(text)) {
        const chunk = await reader.read();
        if (chunk.done) throw new Error('stream ended before invalidation');
        text += decoder.decode(chunk.value);
      }
      assert.doesNotMatch(text, /balance|94\.88|airport_id/);
      return text.match(/data: ([a-f0-9]{64})/)![1];
    }
    const before = await nextVersion();
    balance = 0.9;
    assert.notEqual(await nextVersion(), before);
  } finally {
    clearTimeout(deadline);
    controller.abort();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
