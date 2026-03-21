import type { NextFunction, Request, Response } from 'express';
import { sendError } from '../utils/http';

export class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, 404, 'NOT_FOUND', `Route not found: ${req.path}`, req.requestId || 'unknown');
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    sendError(res, err.status, err.code, err.message, req.requestId || 'unknown');
    return;
  }

  console.error('[error]', err);
  sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', req.requestId || 'unknown');
}
