import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getDbPool } from '../backend/src/db/mysql';
import {
  NewsPublicationTimeRepairService,
  type NewsPublicationTimeRepairEntry,
} from '../backend/src/services/newsPublicationTimeRepairService';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const allowedFlags = new Set(['--apply', '--rollback']);
  for (const arg of args) {
    if (arg.startsWith('--') && !arg.startsWith('--mapping=') && !arg.startsWith('--run-id=') && !allowedFlags.has(arg)) {
      throw new Error(`unknown argument: ${arg}`);
    }
  }

  const mappingPath = readValueArg(args, '--mapping');
  const runId = readValueArg(args, '--run-id');
  const shouldApply = args.includes('--apply');
  const shouldRollback = args.includes('--rollback');
  if (!mappingPath || !path.isAbsolute(mappingPath)) {
    throw new Error('--mapping must be an absolute JSON file path');
  }
  if (shouldApply && shouldRollback) {
    throw new Error('--apply and --rollback cannot be used together');
  }
  if ((shouldApply || shouldRollback) && !runId) {
    throw new Error('--run-id is required for apply and rollback');
  }
  if (!shouldApply && !shouldRollback && runId) {
    throw new Error('--run-id is only valid with --apply or --rollback');
  }

  const parsed: unknown = JSON.parse(await readFile(mappingPath, 'utf8'));
  if (!Array.isArray(parsed)) {
    throw new Error('mapping JSON must contain an array');
  }
  const entries = parsed as NewsPublicationTimeRepairEntry[];
  const pool = getDbPool();
  const service = new NewsPublicationTimeRepairService(pool);
  try {
    const mode = shouldRollback ? 'rollback' : shouldApply ? 'apply' : 'dry-run';
    const report = shouldRollback
      ? await service.rollback(entries, runId as string)
      : shouldApply
        ? await service.apply(entries, runId as string)
        : await service.dryRun(entries);
    process.stdout.write(`${JSON.stringify({
      mode,
      mapping: entries.map((entry) => ({
        id: entry.id,
        expected_published_at: entry.expected_published_at,
        published_at: entry.published_at,
        expected_updated_at: entry.expected_updated_at,
        updated_at: entry.updated_at,
        source: entry.source,
      })),
      report,
    }, null, 2)}\n`);
  } finally {
    await pool.end();
  }
}

function readValueArg(args: string[], name: string): string | undefined {
  const prefix = `${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`news publication time repair failed: ${message}\n`);
  process.exitCode = 1;
});
