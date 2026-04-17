import type { NextFunction, Request, Response } from 'express';
import { sendError } from '../utils/http';
import { getPortalAuthConfig } from '../utils/portalAuthConfig';
import { verifyApplicantToken } from '../utils/token';

declare global {
  namespace Express {
    interface Request {
      applicantSession?: {
        applicant_id: number;
        email: string;
      };
    }
  }
}

export function portalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.header('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
  const config = getPortalAuthConfig();
  const payload = token ? verifyApplicantToken(config.jwtSecret, token) : null;

  if (!payload) {
    sendError(res, 401, 'UNAUTHORIZED', '登录已失效，请重新登录', req.requestId || 'unknown');
    return;
  }

  req.applicantSession = {
    applicant_id: payload.applicant_id,
    email: payload.email,
  };
  next();
}
