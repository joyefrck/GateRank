import test from 'node:test';
import assert from 'node:assert/strict';
import { SchedulerTaskExecutor } from '../src/services/schedulerTaskExecutor';

test('SchedulerTaskExecutor.runRiskInspection skips down airports', async () => {
  const inspected: number[] = [];
  const executor = new SchedulerTaskExecutor({
    airportRepository: {
      listAll: async () => [
        { id: 1, status: 'normal' },
        { id: 2, status: 'down' },
        { id: 3, status: 'risk' },
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
    sleep: async () => undefined,
    logger: {
      log: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
  });

  const result = await executor.runRiskInspection('2026-03-30');
  assert.equal(result.status, 'succeeded');
  assert.deepEqual(inspected, [1, 3]);
});

test('SchedulerTaskExecutor.runStabilityCollection surfaces script failure details from stdout', async () => {
  const executor = new SchedulerTaskExecutor({
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
    sleep: async () => undefined,
    logger: {
      log: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
  });

  const result = await executor.runStabilityCollection('2026-03-30');
  assert.equal(result.status, 'failed');
  assert.equal(
    result.detail.summary,
    '2/3 succeeded, 1 failed; Hangzhou #7: airport 7 has no website configured',
  );
});
