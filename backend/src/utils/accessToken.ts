import { createHash, randomBytes } from 'node:crypto';

export const ACCESS_TOKEN_SCOPES = [
  'news:create',
  'news:update',
  'news:publish',
  'news:archive',
  'news:upload',
] as const;

export type AccessTokenScope = typeof ACCESS_TOKEN_SCOPES[number];

const ACCESS_TOKEN_PREFIX = 'grpt_';

export function generateAccessToken(): string {
  return `${ACCESS_TOKEN_PREFIX}${randomBytes(24).toString('base64url')}`;
}

export function hashAccessToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function maskAccessToken(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length <= 12) {
    return `${trimmed.slice(0, 4)}***${trimmed.slice(-4)}`;
  }
  return `${trimmed.slice(0, 9)}***${trimmed.slice(-4)}`;
}

export function normalizeAccessTokenScopes(scopes: unknown): AccessTokenScope[] {
  if (!Array.isArray(scopes)) {
    return [];
  }

  const normalized = scopes
    .map((scope) => String(scope || '').trim())
    .filter((scope): scope is AccessTokenScope => (ACCESS_TOKEN_SCOPES as readonly string[]).includes(scope));

  return [...new Set(normalized)];
}

export function hasRequiredScopes(
  grantedScopes: readonly AccessTokenScope[],
  requiredScopes: readonly AccessTokenScope[],
): boolean {
  if (requiredScopes.length === 0) {
    return true;
  }

  const scopeSet = new Set(grantedScopes);
  return requiredScopes.every((scope) => scopeSet.has(scope));
}
