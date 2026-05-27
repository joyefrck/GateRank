export const PUBLIC_PAGE_CACHE_TTL_MS = 300_000;
export const PUBLIC_PAGE_CACHE_MAX_ENTRIES = 256;
export const PUBLIC_CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';

export interface CacheableResponse {
  setHeader(name: string, value: string): void;
}

export interface TimedPromiseCache {
  getOrLoad<T>(key: string, loader: () => Promise<T>): Promise<T>;
  clear(): void;
}

interface TimedPromiseCacheOptions {
  maxEntries?: number;
}

export function setPublicCacheHeaders(res: CacheableResponse): void {
  res.setHeader('Cache-Control', PUBLIC_CACHE_CONTROL);
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
