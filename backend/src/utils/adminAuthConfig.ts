import { loadBackendEnv } from './backendEnv';

export interface AdminAuthConfig {
  apiKey: string;
  uiPassword: string;
  jwtSecret: string;
  tokenTtlHours: number;
}

export function getAdminAuthConfig(): AdminAuthConfig {
  const env = loadBackendEnv();
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
