import type { NextFunction, Request, Response } from 'express';
import { sendError } from '../utils/http';
import { getAdminAuthConfig } from '../utils/adminAuthConfig';
import { verifyAdminToken } from '../utils/token';

export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.header('x-api-key');
  const config = getAdminAuthConfig();
  const authHeader = req.header('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
  const tokenSecret = config.jwtSecret;

  if (token && tokenSecret && verifyAdminToken(tokenSecret, token)) {
    next();
    return;
  }

  if (!config.apiKey) {
    sendError(
      res,
      500,
      'ADMIN_KEY_NOT_CONFIGURED',
      'ADMIN_API_KEY is not configured on server',
      req.requestId,
    );
    return;
  }

  if (!apiKey || apiKey !== config.apiKey) {
    sendError(res, 401, 'UNAUTHORIZED', 'Invalid or missing x-api-key', req.requestId);
    return;
  }

  next();
}
