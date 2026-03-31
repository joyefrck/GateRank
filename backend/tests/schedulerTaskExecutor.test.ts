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
