import { loadBackendEnv } from './backendEnv';

export interface PortalAuthConfig {
  jwtSecret: string;
  tokenTtlHours: number;
}

export function getPortalAuthConfig(): PortalAuthConfig {
  const env = loadBackendEnv();
  const jwtSecret =
    process.env.APPLICANT_PORTAL_JWT_SECRET
    || env.APPLICANT_PORTAL_JWT_SECRET
    || process.env.ADMIN_JWT_SECRET
    || env.ADMIN_JWT_SECRET
    || process.env.ADMIN_API_KEY
    || env.ADMIN_API_KEY
    || 'gaterank-applicant-portal';
  const tokenTtlHours = Number(
    process.env.APPLICANT_PORTAL_TOKEN_TTL_HOURS || env.APPLICANT_PORTAL_TOKEN_TTL_HOURS || 24,
  );

  return {
    jwtSecret,
    tokenTtlHours,
  };
}
