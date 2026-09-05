import { getFullRankingFilterCount, type FullRankingFilters } from '../../../shared/fullRankingFilters';

export interface FullRankingLoadGateResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export interface FullRankingLoadGate {
  check(filters: FullRankingFilters): FullRankingLoadGateResult;
}

interface FullRankingLoadGateOptions {
  filterThreshold?: number;
  maxRequests?: number;
  windowMs?: number;
  now?: () => number;
}

export function createFullRankingLoadGate(
  options: FullRankingLoadGateOptions = {},
): FullRankingLoadGate {
  const filterThreshold = positiveInteger(
    options.filterThreshold,
    Number(process.env.FULL_RANKING_COMPLEX_FILTER_THRESHOLD),
    4,
  );
  const maxRequests = positiveInteger(
    options.maxRequests,
    Number(process.env.FULL_RANKING_COMPLEX_RATE_MAX),
    24,
  );
  const windowMs = positiveInteger(
    options.windowMs,
    Number(process.env.FULL_RANKING_COMPLEX_RATE_WINDOW_MS),
    10_000,
  );
  const now = options.now || Date.now;
  let windowStartedAt = 0;
  let requestCount = 0;

  return {
    check(filters): FullRankingLoadGateResult {
      if (getFullRankingFilterCount(filters) < filterThreshold) {
        return { allowed: true };
      }

      const currentTime = now();
      if (windowStartedAt === 0 || currentTime - windowStartedAt >= windowMs) {
        windowStartedAt = currentTime;
        requestCount = 0;
      }
      requestCount += 1;
      if (requestCount <= maxRequests) {
        return { allowed: true };
      }

      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((windowStartedAt + windowMs - currentTime) / 1000)),
      };
    },
  };
}

function positiveInteger(primary: number | undefined, secondary: number, fallback: number): number {
  for (const value of [primary, secondary]) {
    if (Number.isFinite(value) && Number(value) > 0) {
      return Math.floor(Number(value));
    }
  }
  return fallback;
}
