import test from 'node:test';
import assert from 'node:assert/strict';
import { AggregationService } from '../src/services/aggregationService';
import type { DailyMetrics, ProbeSample } from '../src/types/domain';

test('aggregateForDate converts samples to daily metrics', async () => {
  const written: DailyMetrics[] = [];
  const samples: ProbeSample[] = [
    {
      id: 1,
      airport_id: 1,
      sampled_at: '2026-03-22T01:00:00.000Z',
      sample_type: 'latency',
      probe_scope: 'stability',
      latency_ms: 100,
      download_mbps: null,
      availability: null,
      source: 'agent',
    },
    {
      id: 2,
      airport_id: 1,
      sampled_at: '2026-03-22T02:00:00.000Z',
      sample_type: 'latency',
      probe_scope: 'stability',
      latency_ms: 120,
      download_mbps: null,
      availability: null,
      source: 'agent',
    },
    {
      id: 3,
      airport_id: 1,
      sampled_at: '2026-03-22T02:10:00.000Z',
      sample_type: 'latency',
      probe_scope: 'performance',
      latency_ms: 190,
      download_mbps: null,
      availability: null,
      source: 'agent',
    },
    {
      id: 4,
      airport_id: 1,
      sampled_at: '2026-03-22T02:15:00.000Z',
      sample_type: 'latency',
      probe_scope: 'performance',
      latency_ms: 210,
      download_mbps: null,
      availability: null,
      source: 'agent',
    },
    {
      id: 5,
      airport_id: 1,
      sampled_at: '2026-03-22T02:20:00.000Z',
      sample_type: 'download',
      probe_scope: 'performance',
      latency_ms: null,
      download_mbps: 200,
      availability: null,
      source: 'agent',
    },
    {
      id: 6,
      airport_id: 1,
      sampled_at: '2026-03-22T02:25:00.000Z',
      sample_type: 'availability',
      probe_scope: 'stability',
      latency_ms: null,
      download_mbps: null,
      availability: true,
      source: 'agent',
    },
    {
      id: 7,
      airport_id: 1,
      sampled_at: '2026-03-21T02:20:00.000Z',
      sample_type: 'availability',
      probe_scope: 'stability',
      latency_ms: null,
      download_mbps: null,
      availability: true,
      source: 'agent',
    },
  ];

  const service = new AggregationService({
    airportRepository: {
      listAll: async () => [{ id: 1 }],
    },
    probeSampleRepository: {
      getProbeSamplesInRange: async () => samples,
      getPacketLossSamplesByDate: async () => [0.4, 0.6],
    },
    metricsRepository: {
      getLatestByAirportBeforeDate: async () => null,
      upsertDaily: async (input) => {
        written.push(input);
      },
    },
  });

  const result = await service.aggregateForDate('2026-03-22');
  assert.equal(result.aggregated, 1);
  assert.equal(written.length, 1);
  assert.equal(written[0].median_latency_ms, 200);
  assert.equal(written[0].packet_loss_percent, 0.5);
  assert.equal(written[0].uptime_percent_today, 100);
  assert.equal(written[0].latency_mean_ms, 110);
  assert.equal(written[0].latency_std_ms, 10);
  assert.equal(written[0].latency_cv, 0.0909);
  assert.equal(written[0].is_stable_day, true);
  assert.equal(written[0].stable_days_streak, 1);
  assert.equal(written[0].ssl_days_left, null);
});
