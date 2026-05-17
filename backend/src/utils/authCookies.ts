import type { Request, Response } from 'express';

export const ADMIN_AUTH_COOKIE = 'gaterank_admin_token';
export const PORTAL_AUTH_COOKIE = 'gaterank_portal_token';

export function readCookie(req: Request, name: string): string {
  const cookieHeader = String(req.headers.cookie || '');
  for (const part of cookieHeader.split(';')) {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (rawKey !== name) {
      continue;
    }
    try {
      return decodeURIComponent(rawValue.join('='));
    } catch {
      return rawValue.join('=');
    }
  }
  return '';
}

export function setAuthCookie(
  res: Response,
  req: Request,
  name: string,
  token: string,
  expiresAt: string,
): void {
  const maxAge = maxAgeMsFromExpiresAt(expiresAt);
  res.cookie(name, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureCookie(req),
    path: '/',
    maxAge,
  });
}

export function clearAuthCookie(res: Response, req: Request, name: string): void {
  res.clearCookie(name, {
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureCookie(req),
    path: '/',
  });
}

function shouldUseSecureCookie(req: Request): boolean {
  const override = String(process.env.AUTH_COOKIE_SECURE || '').trim().toLowerCase();
  if (override === 'false' || override === '0' || override === 'no') {
    return false;
  }
  if (override === 'true' || override === '1' || override === 'yes') {
    return true;
  }
  const forwardedProto = String(req.header('x-forwarded-proto') || '').split(',')[0]?.trim();
  return process.env.NODE_ENV === 'production' || forwardedProto === 'https' || req.secure;
}

function maxAgeMsFromExpiresAt(expiresAt: string): number | undefined {
  const expiresAtMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs)) {
    return undefined;
  }
  return Math.max(0, expiresAtMs - Date.now());
}
