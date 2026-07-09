import type { NextFunction, Request, Response } from 'express';

export const PRIVATE_SEO_ROBOTS = 'noindex, nofollow, noarchive, nosnippet';

const PRIVATE_SEO_PATH_PREFIXES = [
  '/admin',
  '/portal',
  '/api/v1/admin',
  '/api/v1/portal',
];

export function isPrivateSeoPath(pathname: string): boolean {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return PRIVATE_SEO_PATH_PREFIXES.some((prefix) => (
    normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
  ));
}

export function privateSeoGuard(req: Request, res: Response, next: NextFunction): void {
  if (isPrivateSeoPath(req.path)) {
    res.setHeader('X-Robots-Tag', PRIVATE_SEO_ROBOTS);
  }
  next();
}
