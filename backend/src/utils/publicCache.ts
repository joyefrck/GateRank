export const PUBLIC_PAGE_CACHE_TTL_MS = 300_000;
export const PUBLIC_CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';

export interface CacheableResponse {
  setHeader(name: string, value: string): void;
}

export interface TimedPromiseCache {
  getOrLoad<T>(key: string, loader: () => Promise<T>): Promise<T>;
  clear(): void;
}

export function setPublicCacheHeaders(res: CacheableResponse): void {
  res.setHeader('Cache-Control', PUBLIC_CACHE_CONTROL);
}

export function createTimedPromiseCache(ttlMs: number): TimedPromiseCache {
  const cache = new Map<string, { expiresAt: number; promise: Promise<unknown> }>();

  return {
    getOrLoad<T>(key: string, loader: () => Promise<T>): Promise<T> {
      const now = Date.now();
      const cached = cache.get(key);
      if (cached && cached.expiresAt > now) {
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
      return promise;
    },
    clear(): void {
      cache.clear();
    },
  };
}
