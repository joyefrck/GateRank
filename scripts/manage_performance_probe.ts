import 'dotenv/config';

import { createHash, randomBytes } from 'node:crypto';

import { getDbPool } from '../backend/src/db/mysql';
import { PerformanceProbeRepository } from '../backend/src/repositories/performanceProbeRepository';
import type { PerformanceProbeId } from '../backend/src/types/domain';
import { applyBackendEnvToProcessEnv } from '../backend/src/utils/backendEnv';

const ALLOWED_PROBE_IDS = new Set<PerformanceProbeId>(['cn-shanghai', 'cn-guangzhou']);
const ALLOWED_ACTIONS = new Set(['issue-token', 'revoke-token', 'enable', 'disable']);

async function main(): Promise<void> {
  rejectSecretArguments(process.argv.slice(2));
  applyBackendEnvToProcessEnv();

  const probeId = requireProbeId(process.env.PROBE_ID);
  const action = requireAction(process.env.PROBE_ACTION);
  const pool = getDbPool();
  const repository = new PerformanceProbeRepository(pool);

  try {
    await repository.ensureSchema();
    const probe = await repository.getById(probeId);
    if (!probe) throw new Error('probe_not_registered');

    if (action === 'issue-token') {
      const token = randomBytes(32).toString('base64url');
      const tokenHash = createHash('sha256').update(token, 'utf8').digest('hex');
      await repository.setTokenHash(probeId, tokenHash);
      process.stdout.write(`Token issued for ${probeId}. Store the next line now; it will not be shown again.\n`);
      process.stdout.write(`${['PROBE_API_TOKEN', token].join('=')}\n`);
      return;
    }

    if (action === 'revoke-token') {
      await repository.revokeToken(probeId);
      process.stdout.write(`Token revoked for ${probeId}.\n`);
      return;
    }

    const enabled = action === 'enable';
    await repository.setGloballyEnabled(probeId, enabled);
    process.stdout.write(`Probe ${probeId} is now ${enabled ? 'enabled' : 'disabled'}.\n`);
  } finally {
    await pool.end();
  }
}

function requireProbeId(value: string | undefined): PerformanceProbeId {
  const normalized = value?.trim() as PerformanceProbeId | undefined;
  if (!normalized || !ALLOWED_PROBE_IDS.has(normalized)) {
    throw new Error('PROBE_ID must be cn-shanghai or cn-guangzhou; legacy-control is managed by the backend');
  }
  return normalized;
}

function requireAction(value: string | undefined): 'issue-token' | 'revoke-token' | 'enable' | 'disable' {
  const normalized = value?.trim();
  if (!normalized || !ALLOWED_ACTIONS.has(normalized)) {
    throw new Error('PROBE_ACTION must be issue-token, revoke-token, enable, or disable');
  }
  return normalized as 'issue-token' | 'revoke-token' | 'enable' | 'disable';
}

function rejectSecretArguments(args: string[]): void {
  if (args.length > 0) {
    throw new Error('Command-line arguments are not accepted; use PROBE_ID and PROBE_ACTION environment variables');
  }
}

void main().catch(() => {
  console.error('Performance probe management failed. Check PROBE_ID, PROBE_ACTION, and database connectivity.');
  process.exitCode = 1;
});
