import { loadBackendEnv } from './backendEnv';

export interface XOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizeUrl: string;
  tokenUrl: string;
  meUrl: string;
}

export function getXOAuthConfig(): XOAuthConfig {
  const env = loadBackendEnv();
  const clientId = stringFromEnv('X_OAUTH_CLIENT_ID', env);
  const clientSecret = stringFromEnv('X_OAUTH_CLIENT_SECRET', env);
  const redirectUri = stringFromEnv('X_OAUTH_REDIRECT_URI', env);

  return {
    clientId,
    clientSecret,
    redirectUri,
    authorizeUrl: stringFromEnv('X_OAUTH_AUTHORIZE_URL', env) || 'https://x.com/i/oauth2/authorize',
    tokenUrl: stringFromEnv('X_OAUTH_TOKEN_URL', env) || 'https://api.x.com/2/oauth2/token',
    meUrl: stringFromEnv('X_OAUTH_ME_URL', env) || 'https://api.x.com/2/users/me',
  };
}

export function isXOAuthConfigured(config = getXOAuthConfig()): boolean {
  return Boolean(config.clientId && config.redirectUri);
}

function stringFromEnv(key: string, env: Record<string, string>): string {
  return String(process.env[key] || env[key] || '').trim();
}
