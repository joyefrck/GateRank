import type { Request, Response } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { sendError } from '../utils/http';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;

export function createAdminLoginRateLimit() {
  return rateLimit({
    windowMs: numberFromEnv('LOGIN_RATE_LIMIT_WINDOW_MS', FIFTEEN_MINUTES_MS),
    limit: numberFromEnv('ADMIN_LOGIN_RATE_LIMIT_MAX', 10),
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: rateLimitHandler,
  });
}

export function createPortalLoginRateLimit() {
  return rateLimit({
    windowMs: numberFromEnv('LOGIN_RATE_LIMIT_WINDOW_MS', FIFTEEN_MINUTES_MS),
    limit: numberFromEnv('PORTAL_LOGIN_RATE_LIMIT_MAX', 10),
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      return `${ipKeyGenerator(req.ip || '')}:${email}`;
    },
    handler: rateLimitHandler,
  });
}

export function createPortalLoginFlowRateLimit() {
  return rateLimit({
    windowMs: numberFromEnv('LOGIN_FLOW_RATE_LIMIT_WINDOW_MS', TEN_MINUTES_MS),
    limit: numberFromEnv('LOGIN_FLOW_RATE_LIMIT_MAX', 20),
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
  });
}

export function createPerformanceProbeRateLimit() {
  return rateLimit({
    windowMs: numberFromEnv('PERFORMANCE_PROBE_RATE_LIMIT_WINDOW_MS', 60 * 1000),
    limit: numberFromEnv('PERFORMANCE_PROBE_RATE_LIMIT_MAX', 120),
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
  });
}

function rateLimitHandler(req: Request, res: Response): void {
  sendError(
    res,
    429,
    'RATE_LIMITED',
    '请求过于频繁，请稍后再试',
    req.requestId || 'unknown',
  );
}

function numberFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
