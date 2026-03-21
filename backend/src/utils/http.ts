import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import type { ApiErrorBody } from '../types/domain';

export function getRequestId(req: Request): string {
  const id = req.header('x-request-id') || randomUUID();
  req.headers['x-request-id'] = id;
  return id;
}

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  requestId: string,
): Response<ApiErrorBody> {
  return res.status(status).json({
    code,
    message,
    request_id: requestId,
  });
}
