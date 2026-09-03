import { Router, type Response } from 'express';
import { createHash } from 'node:crypto';
import type { BillingEligibilityService } from '../services/billingEligibilityService';

/** One shared database poll for all viewers, never one poll per browser. */
export function createLiveScoreRoutes(eligibility: Pick<BillingEligibilityService, 'getSnapshot'>): Router {
  const router = Router();
  const clients = new Set<Response>();
  let version = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let stopped = false;
  let lastHeartbeat = 0;

  async function poll() {
    if (running || !clients.size) return;
    running = true;
    try {
      const state = [...await eligibility.getSnapshot()];
      const next = createHash('sha256').update(JSON.stringify(state)).digest('hex');
      if (next !== version) {
        version = next;
        for (const client of clients) client.write(`data: ${version}\n\n`);
      } else if (Date.now() - lastHeartbeat > 15_000) {
        for (const client of clients) client.write(': heartbeat\n\n');
        lastHeartbeat = Date.now();
      }
    } catch {
      // Don't reveal database errors; make clients discard stale score state and retry.
      for (const client of clients) client.write('event: unavailable\ndata: retry\n\n');
    } finally {
      running = false;
      if (!stopped && clients.size) {
        timer = setTimeout(() => { void poll(); }, 1000);
        timer.unref();
      }
    }
  }

  router.get('/scores/events', (_req, res) => {
    if (clients.size >= 2000) { res.status(503).end(); return; }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write('retry: 3000\n\n');
    clients.add(res);
    stopped = false;
    if (version) res.write(`data: ${version}\n\n`);
    if (!timer && !running) void poll();
    res.on('close', () => {
      clients.delete(res);
      if (!clients.size) {
        stopped = true;
        if (timer) clearTimeout(timer);
        timer = undefined;
      }
    });
  });
  return router;
}
