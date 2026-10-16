import { Router } from 'express';

import { HttpError } from '../middleware/errorHandler';
import type { PerformanceProbeId } from '../types/domain';
import type { PerformanceProbeJobService } from '../services/performanceProbeJobService';
import type { WebsiteProbeQueue } from '../services/websiteProbeQueue';

interface PerformanceProbeRoutesDeps {
  jobService: Pick<PerformanceProbeJobService, 'leaseNextJob' | 'submitRun'>;
  websiteProbeQueue?: Pick<WebsiteProbeQueue, 'lease' | 'submit'>;
}

export function createPerformanceProbeRoutes(deps: PerformanceProbeRoutesDeps): Router {
  const router = Router();
  router.get('/website-jobs', async (req, res, next) => {
    try {
      const identity = requireIdentity(req.performanceProbeAuth);
      const job = await deps.websiteProbeQueue?.lease(identity.probe_id);
      if (!job) { res.status(204).end(); return; }
      res.json(job);
    } catch (error) { next(error); }
  });
  router.post('/website-runs', async (req, res, next) => {
    try {
      const identity = requireIdentity(req.performanceProbeAuth);
      if (!deps.websiteProbeQueue) throw new HttpError(503, 'WEBSITE_PROBE_UNAVAILABLE', 'Website probe queue is unavailable');
      if (Buffer.byteLength(JSON.stringify(req.body ?? {}), 'utf8') > 32768) throw new HttpError(413, 'WEBSITE_PROBE_TOO_LARGE', 'Website probe evidence exceeds 32 KiB');
      await deps.websiteProbeQueue.submit(identity.probe_id, req.body);
      res.status(201).json({ accepted: true });
    } catch (error) { next(error); }
  });

  router.get('/jobs', async (req, res, next) => {
    try {
      const identity = requireIdentity(req.performanceProbeAuth);
      const job = await deps.jobService.leaseNextJob(
        identity.probe_id,
        req.header('x-probe-worker') || undefined,
        (req.header('x-probe-capabilities') || '').split(',').includes('network_coverage_proxy_http_v1'),
      );
      if (!job) {
        res.status(204).end();
        return;
      }
      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  router.post('/runs', async (req, res, next) => {
    try {
      const identity = requireIdentity(req.performanceProbeAuth);
      const payload = objectValue(req.body);
      const claimedProbeId = typeof payload.probe_id === 'string' ? payload.probe_id : null;
      if (claimedProbeId && claimedProbeId !== identity.probe_id) {
        throw new HttpError(403, 'PROBE_ID_FORGED', 'probe_id is derived from the bearer token');
      }
      if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > 512 * 1024) {
        throw new HttpError(413, 'PROBE_PAYLOAD_TOO_LARGE', 'Performance probe payload exceeds 512 KiB');
      }
      const result = await deps.jobService.submitRun(identity.probe_id, payload);
      res.status(result.duplicate ? 200 : 201).json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function requireIdentity(identity: Express.Request['performanceProbeAuth']) {
  if (!identity) throw new HttpError(401, 'PROBE_UNAUTHORIZED', 'Performance probe authentication required');
  return identity as Express.Request['performanceProbeAuth'] & { probe_id: PerformanceProbeId };
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
