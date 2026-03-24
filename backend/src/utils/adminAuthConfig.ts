import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'dotenv';

export interface AdminAuthConfig {
  apiKey: string;
  uiPassword: string;
  jwtSecret: string;
  tokenTtlHours: number;
}

let cachedEnv: Record<string, string> | null = null;

export function getAdminAuthConfig(): AdminAuthConfig {
  const env = loadBackendEnvFallback();
  const apiKey = process.env.ADMIN_API_KEY || env.ADMIN_API_KEY || '';
  const uiPassword = process.env.ADMIN_UI_PASSWORD || env.ADMIN_UI_PASSWORD || apiKey;
  const jwtSecret = process.env.ADMIN_JWT_SECRET || env.ADMIN_JWT_SECRET || apiKey;
  const tokenTtlHours = Number(process.env.ADMIN_TOKEN_TTL_HOURS || env.ADMIN_TOKEN_TTL_HOURS || 8);

  return {
    apiKey,
    uiPassword,
    jwtSecret,
    tokenTtlHours,
  };
}

function loadBackendEnvFallback(): Record<string, string> {
  if (cachedEnv) {
    return cachedEnv;
  }

  const envPath = path.resolve(process.cwd(), 'backend/.env');
  if (!existsSync(envPath)) {
    cachedEnv = {};
    return cachedEnv;
  }

  try {
    cachedEnv = parse(readFileSync(envPath, 'utf8'));
    return cachedEnv;
  } catch {
    cachedEnv = {};
    return cachedEnv;
  }
}
