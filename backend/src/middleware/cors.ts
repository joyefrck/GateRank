import type { NextFunction, Request, Response } from 'express';
import { loadBackendEnv } from '../utils/backendEnv';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://gate-rank.com',
  'https://www.gate-rank.com',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'http://127.0.0.1:8787',
  'http://localhost:8787',
];

const ALLOWED_HEADERS = 'Content-Type, Authorization, x-api-key, x-request-id, x-admin-actor';
const ALLOWED_METHODS = 'GET, POST, PATCH, DELETE, OPTIONS';

export function corsAllowlist(req: Request, res: Response, next: NextFunction): void {
  const origin = req.header('origin')?.trim();
  if (origin) {
    res.vary('Origin');
    if (getAllowedOrigins().has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  }

  res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
}

function getAllowedOrigins(): Set<string> {
  const env = loadBackendEnv();
  const origins = [
    ...DEFAULT_ALLOWED_ORIGINS,
    process.env.VITE_SITE_URL,
    env.VITE_SITE_URL,
    ...(process.env.CORS_ALLOWED_ORIGINS || env.CORS_ALLOWED_ORIGINS || '').split(','),
  ];

  return new Set(
    origins
      .map((origin) => String(origin || '').trim().replace(/\/+$/, ''))
      .filter(Boolean),
  );
}
