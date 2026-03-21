import type { NextFunction, Request, Response } from 'express';
import { getRequestId } from '../utils/http';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const requestId = getRequestId(req);
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}
