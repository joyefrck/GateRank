import test from 'node:test';
import assert from 'node:assert/strict';
import { SchedulerTaskExecutor } from '../src/services/schedulerTaskExecutor';

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
    sleep: async () => undefined,
    logger: {
      log: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
    ...overrides,
  });
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
  assert.match(result.message, /恢复上架 1/);
  assert.match(result.message, /欠费下架 1/);
});
