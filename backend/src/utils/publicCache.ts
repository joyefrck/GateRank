export const PUBLIC_PAGE_CACHE_TTL_MS = 300_000;
export const PUBLIC_CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';

export interface CacheableResponse {
  setHeader(name: string, value: string): void;
}

export function setPublicCacheHeaders(res: CacheableResponse): void {
  res.setHeader('Cache-Control', PUBLIC_CACHE_CONTROL);
}
