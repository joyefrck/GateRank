export const PUBLIC_PAGE_CACHE_TTL_MS = 300_000;
export const PUBLIC_PAGE_CACHE_MAX_ENTRIES = 256;
export const PUBLIC_CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';

export interface CacheableResponse {
  setHeader(name: string, value: string): void;
  req?: { originalUrl?: string; path?: string };
}

export interface TimedPromiseCache {
  getOrLoad<T>(key: string, loader: () => Promise<T>): Promise<T>;
  clear(): void;
}

interface TimedPromiseCacheOptions {
  maxEntries?: number;
}

export function setPublicCacheHeaders(res: CacheableResponse): void {
  const path = (res.req?.originalUrl || res.req?.path || '').split('?')[0];
  res.setHeader('Cache-Control', isLiveScorePath(path) ? 'no-store, max-age=0' : PUBLIC_CACHE_CONTROL);
}

export function isLiveScorePath(path: string): boolean {
  return path === '/' || /^\/(?:rankings(?:\/|$)|risk-monitor(?:\/|$)|airports\/|report(?:\/|$))/.test(path)
    || /^(?:\/api\/v1)?\/(?:pages\/(?:home|full-ranking|risk-monitor)(?:\/|$)|airports\/)/.test(path);
}

export function createTimedPromiseCache(
  ttlMs: number,
  options: TimedPromiseCacheOptions = {},
): TimedPromiseCache {
  const cache = new Map<string, { expiresAt: number; promise: Promise<unknown> }>();
  const maxEntries = normalizeMaxEntries(options.maxEntries);

  function deleteExpired(now: number): void {
    for (const [key, entry] of cache) {
      if (entry.expiresAt <= now) {
        cache.delete(key);
      }
    }
  }

  function rememberRecent(key: string, entry: { expiresAt: number; promise: Promise<unknown> }): void {
    cache.delete(key);
    cache.set(key, entry);
  }

  function enforceMaxEntries(): void {
    while (cache.size > maxEntries) {
      const oldestKey = cache.keys().next().value as string | undefined;
      if (oldestKey === undefined) {
        return;
      }
      cache.delete(oldestKey);
    }
  }

  return {
    getOrLoad<T>(key: string, loader: () => Promise<T>): Promise<T> {
      // These views contain wallet-dependent visibility. Never retain their final payload.
      if (/^(?:home|full-ranking|risk-monitor|report|report-view|airport-report):/.test(key)) return loader();
      const now = Date.now();
      deleteExpired(now);
      const cached = cache.get(key);
      if (cached) {
        rememberRecent(key, cached);
        return cached.promise as Promise<T>;
      }

      const promise = loader().catch((error) => {
        const current = cache.get(key);
        if (current?.promise === promise) {
          cache.delete(key);
        }
        throw error;
      });

      cache.set(key, {
        expiresAt: now + ttlMs,
        promise,
      });
      enforceMaxEntries();
      return promise;
    },
    clear(): void {
      cache.clear();
    },
  };
}

function normalizeMaxEntries(value: number | undefined): number {
  if (value === undefined) {
    return PUBLIC_PAGE_CACHE_MAX_ENTRIES;
  }
  const maxEntries = Math.floor(value);
  return Number.isFinite(maxEntries) && maxEntries > 0 ? maxEntries : PUBLIC_PAGE_CACHE_MAX_ENTRIES;
}
