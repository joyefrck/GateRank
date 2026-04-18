import { loadBackendEnv } from './backendEnv';

interface RequestLike {
  protocol?: string;
  headers?: Record<string, unknown>;
  header?(name: string): string | undefined;
}

export function getSiteOrigin(req: RequestLike): string {
  const origin = readHeader(req, 'origin');
  if (origin) {
    return trimTrailingSlash(origin);
  }

  const referer = readHeader(req, 'referer');
  if (referer) {
    try {
      const url = new URL(referer);
      return trimTrailingSlash(`${url.protocol}//${url.host}`);
    } catch {
      // Ignore invalid referer and continue to the next source.
    }
  }

  const env = loadBackendEnv();
  const fromEnv = (process.env.VITE_SITE_URL || env.VITE_SITE_URL || '').trim();
  if (fromEnv) {
    return trimTrailingSlash(fromEnv);
  }

  const protocol = firstHeaderValue(readHeader(req, 'x-forwarded-proto')) || req.protocol || 'https';
  const host = firstHeaderValue(readHeader(req, 'x-forwarded-host'))
    || firstHeaderValue(readHeader(req, 'host'))
    || 'localhost:3000';
  return trimTrailingSlash(`${protocol}://${host}`);
}

function readHeader(req: RequestLike, name: string): string {
  const viaMethod = req.header?.(name);
  if (typeof viaMethod === 'string' && viaMethod.trim()) {
    return viaMethod.trim();
  }

  const viaRecord = req.headers?.[name];
  if (typeof viaRecord === 'string' && viaRecord.trim()) {
    return viaRecord.trim();
  }

  return '';
}

function firstHeaderValue(value: string): string {
  return String(value || '').split(',')[0]?.trim() || '';
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}
