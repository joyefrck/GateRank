import { createHash } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

import { HttpError } from './errorHandler';
import type { PerformanceProbe, PerformanceProbeId, PerformanceScoringRuleVersion } from '../types/domain';

export interface PerformanceProbeAuthIdentity {
  probe_id: PerformanceProbeId;
  display_name: string;
  region_code: string;
  provider: string;
  bandwidth_mbps: number | null;
  test_profile: string;
  scoring_rule_version: PerformanceScoringRuleVersion;
}

declare global {
  namespace Express {
    interface Request {
      performanceProbeAuth?: PerformanceProbeAuthIdentity;
    }
  }
}

interface PerformanceProbeAuthRepository {
  findEnabledByTokenHash(tokenHash: string): Promise<PerformanceProbe | null>;
  touchLastSeen(probeId: PerformanceProbeId): Promise<void>;
}

export function performanceProbeAuth(repository: PerformanceProbeAuthRepository) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const token = parseBearerToken(req.header('authorization'));
      const tokenHash = createHash('sha256').update(token).digest('hex');
      const probe = await repository.findEnabledByTokenHash(tokenHash);
      if (!probe) {
        throw new HttpError(401, 'PROBE_UNAUTHORIZED', 'Invalid performance probe token');
      }
      req.performanceProbeAuth = {
        probe_id: probe.probe_id,
        display_name: probe.display_name,
        region_code: probe.region_code,
        provider: probe.provider,
        bandwidth_mbps: probe.bandwidth_mbps,
        test_profile: probe.test_profile,
        scoring_rule_version: probe.scoring_rule_version,
      };
      await repository.touchLastSeen(probe.probe_id);
      next();
    } catch (error) {
      next(error);
    }
  };
}

function parseBearerToken(header: string | undefined): string {
  if (!header?.startsWith('Bearer ')) {
    throw new HttpError(401, 'PROBE_UNAUTHORIZED', 'Performance probe bearer token required');
  }
  const token = header.slice('Bearer '.length);
  if (token.length < 24 || token.length > 512) {
    throw new HttpError(401, 'PROBE_UNAUTHORIZED', 'Invalid performance probe token');
  }
  for (const character of token) {
    const code = character.charCodeAt(0);
    if (code < 33 || code > 126) {
      throw new HttpError(401, 'PROBE_UNAUTHORIZED', 'Invalid performance probe token');
    }
  }
  return token;
}
