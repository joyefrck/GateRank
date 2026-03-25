import test from 'node:test';
import assert from 'node:assert/strict';
import { NightlyMaintenanceJob } from '../src/jobs/nightlyMaintenanceJob';

test('nightly maintenance runs stages in order and aggregates only once', async () => {
  const steps: string[] = [];
  await withEnv({
    NIGHTLY_PIPELINE_ENABLED: '1',
    NIGHTLY_PIPELINE_STAGE_GAP_MS: '0',
    NIGHTLY_PIPELINE_RISK_AIRPORT_GAP_MS: '0',
    ADMIN_API_KEY: 'test-admin-key',
  }, async () => {
    const job = new NightlyMaintenanceJob({
      airportRepository: {
        listAll: async () => [
          { id: 1, status: 'normal' },
          { id: 2, status: 'risk' },
        ],
      },
      riskCheckService: {
        inspectAirportForDate: async (airportId: number, date: string) => {
          steps.push(`risk:${airportId}:${date}`);
          return { domain_ok: true, ssl_days_left: 30 };
        },
      },
      aggregationService: {
        aggregateForDate: async (date: string) => {
          steps.push(`aggregate:${date}`);
          return { aggregated: 2 };
        },
      },
      recomputeService: {
        recomputeForDate: async (date: string) => {
          steps.push(`recompute:${date}`);
          return { recomputed: 2 };
        },
      },
      execFileAsync: async (_file, args, options) => {
        steps.push(`${args[0]?.includes('stability') ? 'stability' : 'performance'}:${options.env.SOURCE}`);
        return {
          stdout: JSON.stringify({ airport_count: 2, success_count: 2, failure_count: 0 }),
          stderr: '',
        };
      },
      sleep: async () => {},
      logger: silentLogger(),
    });

    const result = await job.runPipeline('2026-03-26');

    assert.deepEqual(
      steps,
      [
        'stability:nightly-stability',
        'performance:nightly-performance',
        'risk:1:2026-03-26',
        'risk:2:2026-03-26',
        'aggregate:2026-03-26',
        'recompute:2026-03-26',
      ],
    );
    assert.deepEqual(
      result.map((item) => `${item.stage}:${item.status}`),
      [
        'stability:succeeded',
        'performance:succeeded',
        'risk:succeeded',
        'aggregate:succeeded',
        'recompute:succeeded',
      ],
    );
  });
});

test('nightly maintenance only triggers once per shanghai date after start time', async () => {
  const runs: string[] = [];
  await withEnv({
    NIGHTLY_PIPELINE_ENABLED: '1',
    NIGHTLY_PIPELINE_START_AT: '00:00',
    NIGHTLY_PIPELINE_TRIGGER_WINDOW_MINUTES: '30',
    NIGHTLY_PIPELINE_STAGE_GAP_MS: '0',
    NIGHTLY_PIPELINE_RISK_AIRPORT_GAP_MS: '0',
    ADMIN_API_KEY: 'test-admin-key',
  }, async () => {
    const job = new NightlyMaintenanceJob({
      airportRepository: {
        listAll: async () => [],
      },
      riskCheckService: {
        inspectAirportForDate: async () => ({ domain_ok: true, ssl_days_left: 30 }),
      },
      aggregationService: {
        aggregateForDate: async (date: string) => {
          runs.push(`aggregate:${date}`);
          return { aggregated: 0 };
        },
      },
      recomputeService: {
        recomputeForDate: async (date: string) => {
          runs.push(`recompute:${date}`);
          return { recomputed: 0 };
        },
      },
      execFileAsync: async () => ({
        stdout: JSON.stringify({ airport_count: 0, success_count: 0, failure_count: 0 }),
        stderr: '',
      }),
      sleep: async () => {},
      logger: silentLogger(),
    });

    await job.tick(new Date('2026-03-25T15:59:00.000Z'));
    await job.tick(new Date('2026-03-25T16:00:00.000Z'));
    await job.tick(new Date('2026-03-25T16:30:00.000Z'));
    await job.tick(new Date('2026-03-26T16:00:00.000Z'));

    assert.deepEqual(runs, [
      'aggregate:2026-03-26',
      'recompute:2026-03-26',
      'aggregate:2026-03-27',
      'recompute:2026-03-27',
    ]);
  });
});

function silentLogger() {
  return {
    log: () => {},
    warn: () => {},
    error: () => {},
  };
}

async function withEnv(env: Record<string, string>, callback: () => Promise<void>): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(env)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }
  try {
    await callback();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
        continue;
      }
      process.env[key] = value;
    }
  }
}
