import type { NextFunction, Request, Response } from 'express';
import { sendError } from '../utils/http';
import { getPortalAuthConfig } from '../utils/portalAuthConfig';
import { verifyApplicantToken } from '../utils/token';
import { PORTAL_AUTH_COOKIE, readCookie } from '../utils/authCookies';

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
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : readCookie(req, PORTAL_AUTH_COOKIE);
  if (!token) {
    sendError(res, 401, 'PORTAL_AUTH_REQUIRED', '请先登录', req.requestId || 'unknown');
    return;
  }

  const config = getPortalAuthConfig();
  const payload = verifyApplicantToken(config.jwtSecret, token);

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
