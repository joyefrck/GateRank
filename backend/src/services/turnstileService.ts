import { HttpError } from '../middleware/errorHandler';

export type TurnstileAction = 'portal_login' | 'airport_apply';
export interface TurnstileVerifier {
  publicConfig(): { enabled: boolean; site_key: string };
  verify(token: unknown, action: TurnstileAction): Promise<void>;
}

export function createTurnstileService(
  env: NodeJS.ProcessEnv = process.env,
  fetcher: typeof fetch = fetch,
): TurnstileVerifier {
  const enabled = env.TURNSTILE_ENABLED === '1' || (env.TURNSTILE_ENABLED !== '0' && env.NODE_ENV === 'production');
  const siteKey = env.TURNSTILE_SITE_KEY?.trim() || '';
  const secretKey = env.TURNSTILE_SECRET_KEY?.trim() || '';
  const hostnames = (env.TURNSTILE_HOSTNAMES || 'gate-rank.com,www.gate-rank.com')
    .split(',').map((host) => host.trim().toLowerCase()).filter(Boolean);
  const unavailable = () => new HttpError(503, 'TURNSTILE_UNAVAILABLE', '真人校验暂时不可用，请稍后重试');
  const assertConfigured = () => {
    if (enabled && (!siteKey || !secretKey || !hostnames.length)) throw unavailable();
  };
  return {
    publicConfig() {
      assertConfigured();
      return { enabled, site_key: enabled ? siteKey : '' };
    },
    async verify(token, action) {
      if (!enabled) return;
      assertConfigured();
      if (typeof token !== 'string' || !token.trim() || token.length > 2048) {
        throw new HttpError(400, 'TURNSTILE_REQUIRED', '请先完成人机验证');
      }
      let result: Record<string, unknown>;
      try {
        const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: secretKey, response: token }),
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) throw unavailable();
        const payload = await response.json();
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw unavailable();
        result = payload as Record<string, unknown>;
      } catch {
        // Never log the token, secret, or upstream request body.
        throw unavailable();
      }
      if (result.success !== true || result.action !== action || typeof result.hostname !== 'string' || !hostnames.includes(result.hostname.toLowerCase())) {
        throw new HttpError(400, 'TURNSTILE_FAILED', '真人校验未通过或已过期，请重新验证');
      }
    },
  };
}
