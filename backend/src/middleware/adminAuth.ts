import type { NextFunction, Request, Response } from 'express';
import { sendError } from '../utils/http';

export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.header('x-api-key');
  const expected = process.env.ADMIN_API_KEY;

  if (!expected) {
    sendError(
      res,
      500,
      'ADMIN_KEY_NOT_CONFIGURED',
      'ADMIN_API_KEY is not configured on server',
      req.requestId,
    );
    return;
  }

  if (!apiKey || apiKey !== expected) {
    sendError(res, 401, 'UNAUTHORIZED', 'Invalid or missing x-api-key', req.requestId);
    return;
  }

  next();
}
