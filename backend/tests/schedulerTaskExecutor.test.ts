import test from 'node:test';
import assert from 'node:assert/strict';
import { SchedulerTaskExecutor } from '../src/services/schedulerTaskExecutor';

type ExecOptions = {
  cwd: string;
  env: NodeJS.ProcessEnv;
  maxBuffer: number;
  timeout: number;
};

const PERFORMANCE_ENV_KEYS = [
  'LATENCY_ATTEMPTS',
  'LATENCY_SAMPLE_INTERVAL_SECONDS',
  'SPEED_TIMEOUT',
  'SPEED_CONNECTIONS',
  'NODE_AVAILABILITY_CHECK',
  'NIGHTLY_PIPELINE_SCRIPT_TIMEOUT_MS',
] as const;

function createSchedulerTaskExecutor(overrides: Partial<ConstructorParameters<typeof SchedulerTaskExecutor>[0]> = {}) {
  return new SchedulerTaskExecutor({
    airportRepository: {
      listAll: async () => [],
    },
    riskCheckService: {
      inspectAirportForDate: async () => ({ domain_ok: true, ssl_days_left: 20 }),
    },
    aggregationService: {
      aggregateForDate: async () => ({ aggregated: 0 }),
    },
    recomputeService: {
      recomputeForDate: async () => ({ recomputed: 0 }),
    },
    applicantBillingRepository: {
      syncListingStatusByBalance: async () => ({
        checked: 0,
        restored: 0,
        unlisted: 0,
        unchanged: 0,
        skipped: 0,
      }),
    },
    marketingSettingsService: {
      getConfig: async () => ({ click_charge_amount: 0.6 }),
    },
    scoreRepository: {
      getLatestAvailableDate: async () => null,
      getByDate: async () => [],
    },
    sleep: async () => undefined,
    logger: {
      log: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
    ...overrides,
  });
}

async function withSchedulerEnv<T>(
  patch: Partial<Record<(typeof PERFORMANCE_ENV_KEYS)[number], string | undefined>>,
  callback: () => Promise<T>,
): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const key of PERFORMANCE_ENV_KEYS) {
    previous.set(key, process.env[key]);
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      const value = patch[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
      continue;
    }
    delete process.env[key];
  }

  try {
    return await callback();
  } finally {
    for (const key of PERFORMANCE_ENV_KEYS) {
      const value = previous.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test('SchedulerTaskExecutor.runRiskInspection skips down and unlisted airports', async () => {
  const inspected: number[] = [];
  const executor = createSchedulerTaskExecutor({
    airportRepository: {
      listAll: async () => [
        { id: 1, status: 'normal', is_listed: true },
        { id: 2, status: 'down' },
        { id: 3, status: 'risk', is_listed: true },
        { id: 4, status: 'normal', is_listed: false },
      ],
    },
    riskCheckService: {
      inspectAirportForDate: async (airportId: number) => {
        inspected.push(airportId);
        return { domain_ok: true, ssl_days_left: 20 };
      },
    },
    aggregationService: {
      aggregateForDate: async () => ({ aggregated: 0 }),
    },
    recomputeService: {
      recomputeForDate: async () => ({ recomputed: 0 }),
    },
  });

  const result = await executor.runRiskInspection('2026-03-30');
  assert.equal(result.status, 'succeeded');
  assert.deepEqual(inspected, [1, 3]);
});

test('SchedulerTaskExecutor.runStabilityCollection surfaces script failure details from stdout', async () => {
  const executor = createSchedulerTaskExecutor({
    execFileAsync: async () => {
      const error = new Error('Command failed: python3 monitor_stability.py') as Error & {
        stdout: string;
        stderr: string;
      };
      error.stdout = JSON.stringify({
        airport_count: 3,
        success_count: 2,
        failure_count: 1,
        failures: [
          {
            airport_id: 7,
            airport_name: 'Hangzhou',
            error: 'airport 7 has no website configured',
          },
        ],
      });
      error.stderr = '';
      throw error;
    },
  });

  const result = await executor.runStabilityCollection('2026-03-30');
  assert.equal(result.status, 'failed');
  assert.equal(
    result.detail.summary,
    '2/3 succeeded, 1 failed; Hangzhou #7: airport 7 has no website configured',
  );
});

test('SchedulerTaskExecutor.runPerformanceCollection injects scheduler-safe probe defaults', async () => {
  await withSchedulerEnv({}, async () => {
    let capturedEnv: NodeJS.ProcessEnv | null = null;
    const executor = createSchedulerTaskExecutor({
      execFileAsync: async (_file: string, _args: readonly string[], options: ExecOptions) => {
        capturedEnv = options.env;
        return {
          stdout: JSON.stringify({ airport_count: 1, success_count: 1, failure_count: 0 }),
          stderr: '',
        };
      },
    });

    const result = await executor.runPerformanceCollection('2026-07-07');

    assert.equal(result.status, 'succeeded');
    assert.ok(capturedEnv);
    const env = capturedEnv as NodeJS.ProcessEnv;
    assert.equal(env.LATENCY_ATTEMPTS, '3');
    assert.equal(env.LATENCY_SAMPLE_INTERVAL_SECONDS, '1');
    assert.equal(env.SPEED_TIMEOUT, '10');
    assert.equal(env.SPEED_CONNECTIONS, '2');
    assert.equal(env.NODE_AVAILABILITY_CHECK, 'tcp');
    assert.equal(env.SOURCE, 'scheduler-performance');
  });
});

test('SchedulerTaskExecutor.runPerformanceCollection preserves explicitly configured probe settings', async () => {
  await withSchedulerEnv({
    LATENCY_ATTEMPTS: '5',
    LATENCY_SAMPLE_INTERVAL_SECONDS: '2',
    SPEED_TIMEOUT: '15',
    SPEED_CONNECTIONS: '3',
    NODE_AVAILABILITY_CHECK: 'proxy_http',
  }, async () => {
    let capturedEnv: NodeJS.ProcessEnv | null = null;
    const executor = createSchedulerTaskExecutor({
      execFileAsync: async (_file: string, _args: readonly string[], options: ExecOptions) => {
        capturedEnv = options.env;
        return {
          stdout: JSON.stringify({ airport_count: 1, success_count: 1, failure_count: 0 }),
          stderr: '',
        };
      },
    });

    const result = await executor.runPerformanceCollection('2026-07-07');

    assert.equal(result.status, 'succeeded');
    assert.ok(capturedEnv);
    const env = capturedEnv as NodeJS.ProcessEnv;
    assert.equal(env.LATENCY_ATTEMPTS, '5');
    assert.equal(env.LATENCY_SAMPLE_INTERVAL_SECONDS, '2');
    assert.equal(env.SPEED_TIMEOUT, '15');
    assert.equal(env.SPEED_CONNECTIONS, '3');
    assert.equal(env.NODE_AVAILABILITY_CHECK, 'proxy_http');
  });
});

test('SchedulerTaskExecutor.runPerformanceCollection summarizes script timeout explicitly', async () => {
  await withSchedulerEnv({ NIGHTLY_PIPELINE_SCRIPT_TIMEOUT_MS: '1800000' }, async () => {
    const executor = createSchedulerTaskExecutor({
      execFileAsync: async () => {
        const error = new Error('Command failed: python3 /app/scripts/monitor_performance.py') as Error & {
          killed: boolean;
          signal: NodeJS.Signals;
          stdout: string;
          stderr: string;
        };
        error.killed = true;
        error.signal = 'SIGTERM';
        error.stdout = '';
        error.stderr = '';
        throw error;
      },
    });

    const result = await executor.runPerformanceCollection('2026-07-07');

    assert.equal(result.status, 'failed');
    assert.equal(result.detail.summary, '超时：超过 30.0 min');
    assert.equal(result.message, '性能采集失败：超时：超过 30.0 min');
  });
});

test('SchedulerTaskExecutor.runTask syncs billing listing status', async () => {
  let syncedWithAmount: number | null = null;
  const executor = createSchedulerTaskExecutor({
    marketingSettingsService: {
      getConfig: async () => ({ click_charge_amount: 0.6 }),
    },
    applicantBillingRepository: {
      syncListingStatusByBalance: async (amount) => {
        syncedWithAmount = amount;
        return {
          checked: 3,
          restored: 1,
          unlisted: 1,
          unchanged: 1,
          skipped: 0,
        };
      },
    },
  });

  const result = await executor.runTask('billing_listing_sync', '2026-03-30');

  assert.equal(result.status, 'succeeded');
  assert.equal(syncedWithAmount, 0.6);
  assert.equal(result.detail.stage, 'billing_listing_sync');
  assert.equal(result.detail.restored, 1);
  assert.match(result.message, /恢复公开总分 1/);
  assert.match(result.message, /总分暂不公开 1/);
});

test('SchedulerTaskExecutor.runStabilityResampleGuard skips when score data is unavailable', async () => {
  const scriptCalls: string[] = [];
  let aggregateCount = 0;
  let recomputeCount = 0;
  const executor = createSchedulerTaskExecutor({
    scoreRepository: {
      getLatestAvailableDate: async () => null,
      getByDate: async () => [],
    },
    execFileAsync: async (_file: string, args: readonly string[]) => {
      scriptCalls.push(String(args[0]));
      return {
        stdout: JSON.stringify({ airport_count: 1, success_count: 1, failure_count: 0 }),
        stderr: '',
      };
    },
    aggregationService: {
      aggregateForDate: async () => {
        aggregateCount += 1;
        return { aggregated: 1 };
      },
    },
    recomputeService: {
      recomputeForDate: async () => {
        recomputeCount += 1;
        return { recomputed: 1 };
      },
    },
  });

  const result = await executor.runTask('stability_resample_guard', '2026-06-19');

  assert.equal(result.status, 'succeeded');
  assert.equal(result.detail.previous_date, null);
  assert.equal(result.detail.checked_count, 0);
  assert.equal(result.detail.flagged_count, 0);
  assert.equal(result.detail.retested_count, 0);
  assert.deepEqual(scriptCalls, []);
  assert.equal(aggregateCount, 0);
  assert.equal(recomputeCount, 0);
});

test('SchedulerTaskExecutor.runStabilityResampleGuard skips deltas below threshold', async () => {
  const scriptCalls: string[] = [];
  let aggregateCount = 0;
  let recomputeCount = 0;
  const executor = createSchedulerTaskExecutor({
    scoreRepository: {
      getLatestAvailableDate: async () => '2026-06-18',
      getByDate: async (date: string) => date === '2026-06-19'
        ? [{ airport_id: 1, s: 87 }]
        : [{ airport_id: 1, s: 70 }],
    },
    execFileAsync: async (_file: string, args: readonly string[]) => {
      scriptCalls.push(String(args[0]));
      return {
        stdout: JSON.stringify({ airport_count: 1, success_count: 1, failure_count: 0 }),
        stderr: '',
      };
    },
    aggregationService: {
      aggregateForDate: async () => {
        aggregateCount += 1;
        return { aggregated: 1 };
      },
    },
    recomputeService: {
      recomputeForDate: async () => {
        recomputeCount += 1;
        return { recomputed: 1 };
      },
    },
  });

  const result = await executor.runTask('stability_resample_guard', '2026-06-19');

  assert.equal(result.status, 'succeeded');
  assert.equal(result.detail.checked_count, 1);
  assert.equal(result.detail.flagged_count, 0);
  assert.equal(result.detail.retested_count, 0);
  assert.deepEqual(scriptCalls, []);
  assert.equal(aggregateCount, 0);
  assert.equal(recomputeCount, 0);
});

test('SchedulerTaskExecutor.runStabilityResampleGuard retests delta at threshold and recomputes once', async () => {
  const envs: NodeJS.ProcessEnv[] = [];
  let aggregateCount = 0;
  let recomputeCount = 0;
  const executor = createSchedulerTaskExecutor({
    scoreRepository: {
      getLatestAvailableDate: async () => '2026-06-18',
      getByDate: async (date: string) => date === '2026-06-19'
        ? [{ airport_id: 1, s: 50 }]
        : [{ airport_id: 1, s: 70 }],
    },
    execFileAsync: async (_file: string, _args: readonly string[], options: ExecOptions) => {
      envs.push(options.env);
      return {
        stdout: JSON.stringify({ airport_count: 1, success_count: 1, failure_count: 0 }),
        stderr: '',
      };
    },
    aggregationService: {
      aggregateForDate: async (date: string) => {
        assert.equal(date, '2026-06-19');
        aggregateCount += 1;
        return { aggregated: 1 };
      },
    },
    recomputeService: {
      recomputeForDate: async (date: string) => {
        assert.equal(date, '2026-06-19');
        recomputeCount += 1;
        return { recomputed: 1 };
      },
    },
  });

  const result = await executor.runTask('stability_resample_guard', '2026-06-19');

  assert.equal(result.status, 'succeeded');
  assert.equal(result.detail.checked_count, 1);
  assert.equal(result.detail.flagged_count, 1);
  assert.equal(result.detail.retested_count, 1);
  assert.equal(envs[0]?.AIRPORT_ID, '1');
  assert.equal(envs[0]?.SOURCE, 'scheduler-stability-resample');
  assert.equal(envs[0]?.SKIP_AGGREGATE, '1');
  assert.equal(envs[0]?.SKIP_RECOMPUTE, '1');
  assert.equal(aggregateCount, 1);
  assert.equal(recomputeCount, 1);
});

test('SchedulerTaskExecutor.runStabilityResampleGuard retests multiple flagged airports with one final recompute', async () => {
  const airportIds: string[] = [];
  let aggregateCount = 0;
  let recomputeCount = 0;
  const executor = createSchedulerTaskExecutor({
    scoreRepository: {
      getLatestAvailableDate: async () => '2026-06-18',
      getByDate: async (date: string) => date === '2026-06-19'
        ? [
          { airport_id: 1, s: 50 },
          { airport_id: 2, s: 95 },
          { airport_id: 3, s: 80 },
        ]
        : [
          { airport_id: 1, s: 70 },
          { airport_id: 2, s: 70 },
          { airport_id: 3, s: 70 },
        ],
    },
    execFileAsync: async (_file: string, _args: readonly string[], options: ExecOptions) => {
      airportIds.push(String(options.env.AIRPORT_ID));
      return {
        stdout: JSON.stringify({ airport_count: 1, success_count: 1, failure_count: 0 }),
        stderr: '',
      };
    },
    aggregationService: {
      aggregateForDate: async () => {
        aggregateCount += 1;
        return { aggregated: 3 };
      },
    },
    recomputeService: {
      recomputeForDate: async () => {
        recomputeCount += 1;
        return { recomputed: 3 };
      },
    },
  });

  const result = await executor.runTask('stability_resample_guard', '2026-06-19');

  assert.equal(result.status, 'succeeded');
  assert.deepEqual(airportIds, ['1', '2']);
  assert.equal(result.detail.checked_count, 3);
  assert.equal(result.detail.flagged_count, 2);
  assert.equal(result.detail.retested_count, 2);
  assert.equal(aggregateCount, 1);
  assert.equal(recomputeCount, 1);
});

test('SchedulerTaskExecutor.runStabilityResampleGuard continues after one airport retest fails', async () => {
  const airportIds: string[] = [];
  let aggregateCount = 0;
  let recomputeCount = 0;
  const executor = createSchedulerTaskExecutor({
    scoreRepository: {
      getLatestAvailableDate: async () => '2026-06-18',
      getByDate: async (date: string) => date === '2026-06-19'
        ? [
          { airport_id: 1, s: 50 },
          { airport_id: 2, s: 95 },
        ]
        : [
          { airport_id: 1, s: 70 },
          { airport_id: 2, s: 70 },
        ],
    },
    execFileAsync: async (_file: string, _args: readonly string[], options: ExecOptions) => {
      airportIds.push(String(options.env.AIRPORT_ID));
      if (options.env.AIRPORT_ID === '1') {
        const error = new Error('Command failed: python3 monitor_stability.py') as Error & {
          stdout: string;
          stderr: string;
        };
        error.stdout = JSON.stringify({
          airport_count: 1,
          success_count: 0,
          failure_count: 1,
          failures: [{ airport_id: 1, airport_name: 'Bad', error: 'temporary timeout' }],
        });
        error.stderr = '';
        throw error;
      }
      return {
        stdout: JSON.stringify({ airport_count: 1, success_count: 1, failure_count: 0 }),
        stderr: '',
      };
    },
    aggregationService: {
      aggregateForDate: async () => {
        aggregateCount += 1;
        return { aggregated: 2 };
      },
    },
    recomputeService: {
      recomputeForDate: async () => {
        recomputeCount += 1;
        return { recomputed: 2 };
      },
    },
  });

  const result = await executor.runTask('stability_resample_guard', '2026-06-19');

  assert.equal(result.status, 'failed');
  assert.deepEqual(airportIds, ['1', '2']);
  assert.equal(result.detail.flagged_count, 2);
  assert.equal(result.detail.retested_count, 1);
  assert.equal((result.detail.failures as unknown[]).length, 1);
  assert.match(String((result.detail.failures as Array<{ error: string }>)[0]?.error), /temporary timeout/);
  assert.equal(aggregateCount, 1);
  assert.equal(recomputeCount, 1);
});
