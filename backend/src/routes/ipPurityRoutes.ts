import { Router } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import type { IpPurityService } from '../services/ipPurityService';
import { normalizePurityIp } from '../services/ipPurityService';
import { resolveVisitorIp } from '../utils/visitorNetwork';
import { HttpError } from '../middleware/errorHandler';
import { sendError } from '../utils/http';

export function createIpPurityPublicRoutes(service: Pick<IpPurityService, 'lookup'>): Router {
  const router = Router();
  router.use('/tools/ip-purity-check', (_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });
  const limit = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(resolveVisitorIp(req)),
    handler: (req, res) => sendError(res, 429, 'IP_PURITY_RATE_LIMITED', '查询过于频繁，请稍后重试。', req.requestId || 'unknown'),
  });
  router.post('/tools/ip-purity-check', limit, async (req, res, next) => {
    try {
      let ip: string;
      if (req.body?.query === undefined) {
        try { ip = normalizePurityIp(resolveVisitorIp(req)); }
        catch { throw new HttpError(422, 'IP_PURITY_CLIENT_IP_REQUIRED', '暂时无法识别出口 IP，请输入公网 IP 地址。'); }
      } else { ip = normalizePurityIp(req.body.query); }
      res.json(await service.lookup(ip));
    } catch (error) { next(error); }
  });
  return router;
}
