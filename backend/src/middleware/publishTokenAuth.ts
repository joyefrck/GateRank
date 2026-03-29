import type { NextFunction, Request, Response } from 'express';
import type { AccessTokenService } from '../services/accessTokenService';
import type { AccessTokenScope } from '../utils/accessToken';

declare global {
  namespace Express {
    interface Request {
      publishTokenAuth?: {
        id: number;
        name: string;
        scopes: AccessTokenScope[];
        actor: string;
      };
    }
  }
}

export function publishTokenAuth(
  accessTokenService: AccessTokenService,
  requiredScopes: readonly AccessTokenScope[],
) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const authHeader = req.header('authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
      req.publishTokenAuth = await accessTokenService.authenticateToken(token, requiredScopes, clientIpFromReq(req));
      next();
    } catch (error) {
      next(error);
    }
  };
}

function clientIpFromReq(req: Request): string | null {
  const forwardedFor = req.header('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || null;
  }
  return req.ip || null;
}
