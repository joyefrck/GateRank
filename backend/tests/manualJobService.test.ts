import test from 'node:test';
import assert from 'node:assert/strict';
import { ManualJobService } from '../src/services/manualJobService';
import { getDateInTimezone } from '../src/utils/time';
import type { ManualJob } from '../src/types/domain';

test('full manual job continues remaining stages after one stage fails', async () => {
  const steps: string[] = [];
  const service = new ManualJobService({
    manualJobRepository: {
      create: async () => {
        throw new Error('not implemented');
      },
      getById: async () => null,
      findActive: async () => null,
      markRunning: async () => {},
      markFinished: async () => {},
      failActiveJobs: async () => {},
    },
    aggregationService: {
      aggregateAirportForDate: async (airportId: number, date: string) => {
        steps.push(`aggregate:${airportId}:${date}`);
        return { aggregated: 1 };
      },
    },
    recomputeService: {
      recomputeAirportForDate: async (date: string, airportId: number) => {
        steps.push(`recompute:${airportId}:${date}`);
        return { recomputed: 1 };
      },
    },
    riskCheckService: {
      inspectAirportForDate: async (airportId: number, date: string) => {
        steps.push(`risk:${airportId}:${date}`);
        return { domain_ok: true, ssl_days_left: 30 };
      },
    },
    auditRepository: {
      log: async () => {},
    },
  });

  (service as unknown as Record<string, unknown>).runStabilityScript = async (airportId: number) => {
    steps.push(`stability:${airportId}`);
  };
  (service as unknown as Record<string, unknown>).runPerformanceScript = async (airportId: number) => {
    steps.push(`performance:${airportId}`);
    throw new Error('subscription fetch failed');
  };

  const today = getDateInTimezone();
  const job: ManualJob = {
    id: 1,
    airport_id: 7,
    date: today,
    kind: 'full',
    status: 'queued',
    message: null,
    created_by: 'tester',
    request_id: 'req-1',
    started_at: null,
    finished_at: null,
    created_at: `${today}T00:00:00+08:00`,
    updated_at: `${today}T00:00:00+08:00`,
  };

  await assert.rejects(
    async () => (service as any).executeJob(job),
    /性能采集失败/,
  );

  assert.deepEqual(steps, [
    'stability:7',
    'performance:7',
    `risk:7:${today}`,
    `aggregate:7:${today}`,
    `recompute:7:${today}`,
  ]);
});
