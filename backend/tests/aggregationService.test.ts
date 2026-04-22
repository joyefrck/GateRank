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
  assert.equal(written[0].healthy_days_streak, 1);
  assert.equal(written[0].stability_tier, 'stable');
  assert.equal(written[0].ssl_days_left, null);
});

test('aggregateForDate keeps raw latency_cv and classifies healthy jitter separately from strict stable days', async () => {
  const written: DailyMetrics[] = [];
  const samples: ProbeSample[] = [
    {
      id: 1,
      airport_id: 1,
      sampled_at: '2026-03-28T01:00:00.000Z',
      sample_type: 'latency',
      probe_scope: 'stability',
      latency_ms: 3.7,
      download_mbps: null,
      availability: null,
      source: 'agent',
    },
    {
      id: 2,
      airport_id: 1,
      sampled_at: '2026-03-28T01:05:00.000Z',
      sample_type: 'latency',
      probe_scope: 'stability',
      latency_ms: 6.03,
      download_mbps: null,
      availability: null,
      source: 'agent',
    },
    {
      id: 3,
      airport_id: 1,
      sampled_at: '2026-03-28T01:10:00.000Z',
      sample_type: 'latency',
      probe_scope: 'stability',
      latency_ms: 3.74,
      download_mbps: null,
      availability: null,
      source: 'agent',
    },
    {
      id: 4,
      airport_id: 1,
      sampled_at: '2026-03-28T01:15:00.000Z',
      sample_type: 'latency',
      probe_scope: 'stability',
      latency_ms: 5.89,
      download_mbps: null,
      availability: null,
      source: 'agent',
    },
    {
      id: 5,
      airport_id: 1,
      sampled_at: '2026-03-28T01:20:00.000Z',
      sample_type: 'latency',
      probe_scope: 'stability',
      latency_ms: 3.48,
      download_mbps: null,
      availability: null,
      source: 'agent',
    },
    {
      id: 6,
      airport_id: 1,
      sampled_at: '2026-03-28T01:25:00.000Z',
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
      sampled_at: '2026-03-27T01:25:00.000Z',
      sample_type: 'availability',
      probe_scope: 'stability',
      latency_ms: null,
      download_mbps: null,
      availability: true,
      source: 'agent',
    },
    {
      id: 8,
      airport_id: 1,
      sampled_at: '2026-03-27T01:20:00.000Z',
      sample_type: 'latency',
      probe_scope: 'stability',
      latency_ms: 4,
      download_mbps: null,
      availability: null,
      source: 'agent',
    },
  ];

  const service = new AggregationService({
    airportRepository: {
      listAll: async () => [{ id: 1 }],
    },
    probeSampleRepository: {
      getProbeSamplesInRange: async () => samples,
      getPacketLossSamplesByDate: async () => [],
    },
    metricsRepository: {
      getLatestByAirportBeforeDate: async () => null,
      upsertDaily: async (input) => {
        written.push(input);
      },
    },
  });

  const result = await service.aggregateForDate('2026-03-28');
  assert.equal(result.aggregated, 1);
  assert.equal(written.length, 1);
  assert.equal(written[0].latency_cv, 0.2498);
  assert.equal(written[0].is_stable_day, true);
  assert.equal(written[0].stable_days_streak, 2);
  assert.equal(written[0].healthy_days_streak, 2);
  assert.equal(written[0].stability_tier, 'stable');
});

test('aggregateForDate keeps healthy streak across minor fluctuation days while strict streak resets', async () => {
  const written: DailyMetrics[] = [];
  const samples: ProbeSample[] = [
    {
      id: 1,
      airport_id: 1,
      sampled_at: '2026-04-02T01:00:00.000Z',
      sample_type: 'latency',
      probe_scope: 'stability',
      latency_ms: 10,
      download_mbps: null,
      availability: null,
      source: 'agent',
    },
    {
      id: 2,
      airport_id: 1,
      sampled_at: '2026-04-02T01:05:00.000Z',
      sample_type: 'latency',
      probe_scope: 'stability',
      latency_ms: 12,
      download_mbps: null,
      availability: null,
      source: 'agent',
    },
    {
      id: 3,
      airport_id: 1,
      sampled_at: '2026-04-02T01:10:00.000Z',
      sample_type: 'latency',
      probe_scope: 'stability',
      latency_ms: 22,
      download_mbps: null,
      availability: null,
      source: 'agent',
    },
    {
      id: 4,
      airport_id: 1,
      sampled_at: '2026-04-02T01:15:00.000Z',
      sample_type: 'latency',
      probe_scope: 'stability',
      latency_ms: 20,
      download_mbps: null,
      availability: null,
      source: 'agent',
    },
    {
      id: 5,
      airport_id: 1,
      sampled_at: '2026-04-02T01:20:00.000Z',
      sample_type: 'latency',
      probe_scope: 'stability',
      latency_ms: 14,
      download_mbps: null,
      availability: null,
      source: 'agent',
    },
    {
      id: 6,
      airport_id: 1,
      sampled_at: '2026-04-02T01:25:00.000Z',
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
      sampled_at: '2026-04-01T01:00:00.000Z',
      sample_type: 'latency',
      probe_scope: 'stability',
      latency_ms: 4,
      download_mbps: null,
      availability: null,
      source: 'agent',
    },
    {
      id: 8,
      airport_id: 1,
      sampled_at: '2026-04-01T01:05:00.000Z',
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
      getPacketLossSamplesByDate: async () => [],
    },
    metricsRepository: {
      getLatestByAirportBeforeDate: async () => null,
      upsertDaily: async (input) => {
        written.push(input);
      },
    },
  });

  const result = await service.aggregateForDate('2026-04-02');
  assert.equal(result.aggregated, 1);
  assert.equal(written.length, 1);
  assert.equal(written[0].stability_tier, 'minor_fluctuation');
  assert.equal(written[0].is_stable_day, false);
  assert.equal(written[0].stable_days_streak, 0);
  assert.equal(written[0].healthy_days_streak, 2);
});

test('aggregateForDate preserves current-day domain_ok from prior risk inspection', async () => {
  const written: DailyMetrics[] = [];
  const samples: ProbeSample[] = [
    {
      id: 1,
      airport_id: 1,
      sampled_at: '2026-04-03T01:00:00.000Z',
      sample_type: 'availability',
      probe_scope: 'stability',
      latency_ms: null,
      download_mbps: null,
      availability: false,
      source: 'agent',
    },
    {
      id: 2,
      airport_id: 1,
      sampled_at: '2026-04-03T01:05:00.000Z',
      sample_type: 'latency',
      probe_scope: 'stability',
      latency_ms: 80,
      download_mbps: null,
      availability: null,
      source: 'agent',
    },
  ];

  const service = new AggregationService({
    airportRepository: {
      listAll: async () => [{ id: 1 }],
    },
    probeSampleRepository: {
      getProbeSamplesInRange: async () => samples,
      getPacketLossSamplesByDate: async () => [],
    },
    metricsRepository: {
      getLatestByAirportBeforeDate: async () => ({
        airport_id: 1,
        date: '2026-04-03',
        uptime_percent_30d: 100,
        uptime_percent_today: 100,
        latency_samples_ms: [],
        latency_mean_ms: null,
        latency_std_ms: null,
        latency_cv: null,
        download_samples_mbps: [],
        median_latency_ms: 90,
        median_download_mbps: 100,
        packet_loss_percent: 0,
        stable_days_streak: 5,
        healthy_days_streak: 5,
        is_stable_day: true,
        stability_tier: 'stable',
        domain_ok: true,
        ssl_days_left: 47,
        recent_complaints_count: 0,
        history_incidents: 0,
      }),
      upsertDaily: async (input) => {
        written.push(input);
      },
    },
  });

  const result = await service.aggregateForDate('2026-04-03');
  assert.equal(result.aggregated, 1);
  assert.equal(written.length, 1);
  assert.equal(written[0].uptime_percent_today, 0);
  assert.equal(written[0].domain_ok, true);
  assert.equal(written[0].ssl_days_left, 47);
});
