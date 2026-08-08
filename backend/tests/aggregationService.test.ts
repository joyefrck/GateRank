import test from 'node:test';
import assert from 'node:assert/strict';
import { AggregationService } from '../src/services/aggregationService';
import type { DailyMetrics, PerformanceRun, ProbeSample } from '../src/types/domain';

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
      listAll: async () => [
        { id: 1, status: 'normal', is_listed: true },
        { id: 2, status: 'normal', is_listed: false },
      ],
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

test('aggregateForDate prefers latest performance run metrics over stale performance probe samples', async () => {
  const written: DailyMetrics[] = [];
  const samples: ProbeSample[] = [
    {
      id: 1,
      airport_id: 1,
      sampled_at: '2026-05-27T00:10:00.000Z',
      sample_type: 'download',
      probe_scope: 'performance',
      latency_ms: null,
      download_mbps: 0.47,
      availability: null,
      source: 'manual-performance',
    },
    {
      id: 2,
      airport_id: 1,
      sampled_at: '2026-05-27T00:20:00.000Z',
      sample_type: 'latency',
      probe_scope: 'performance',
      latency_ms: 500,
      download_mbps: null,
      availability: null,
      source: 'manual-performance',
    },
    {
      id: 3,
      airport_id: 1,
      sampled_at: '2026-05-27T00:25:00.000Z',
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
      listAll: async () => [{ id: 1, status: 'normal', is_listed: true }],
    },
    probeSampleRepository: {
      getProbeSamplesInRange: async () => samples,
      getPacketLossSamplesByDate: async () => [95],
    },
    metricsRepository: {
      getLatestByAirportBeforeDate: async () => null,
      upsertDaily: async (input) => {
        written.push(input);
      },
    },
    performanceRunRepository: {
      getLatestByAirportAndDate: async () => ({
        id: 9,
        airport_id: 1,
        sampled_at: '2026-05-27T01:30:52+08:00',
        source: 'manual-performance',
        status: 'success',
        subscription_format: 'base64',
        parsed_nodes_count: 23,
        supported_nodes_count: 23,
        selected_nodes: [],
        tested_nodes: [
          { name: 'US', region: 'US', type: 'vless', status: 'ok', download_mbps: 75.59 },
          { name: 'JP', region: 'JP', type: 'vless', status: 'ok', download_mbps: 167.6 },
          { name: 'HK', region: 'HK', type: 'vless', status: 'ok', download_mbps: 208.2 },
        ],
        available_nodes_count: 23,
        unavailable_nodes_count: 0,
        node_availability_percent: 100,
        node_unavailability_percent: 0,
        median_latency_ms: 62.79,
        median_download_mbps: 167.6,
        packet_loss_percent: 0,
        error_code: null,
        error_message: null,
        diagnostics: {
          packet_loss_measurement: 'proxy_http_request_failure_rate_v1',
        },
      }),
    },
  });

  const result = await service.aggregateForDate('2026-05-27');

  assert.equal(result.aggregated, 1);
  assert.equal(written[0].median_latency_ms, 62.79);
  assert.equal(written[0].median_download_mbps, 167.6);
  assert.deepEqual(written[0].download_samples_mbps, [75.59, 167.6, 208.2]);
  assert.equal(written[0].packet_loss_percent, 0);
  assert.equal(written[0].packet_loss_measurement, 'proxy_http_request_failure_rate_v1');
});

test('aggregateAirportForDate equally aggregates a complete official mainland set', async () => {
  const written: DailyMetrics[] = [];
  const service = new AggregationService({
    airportRepository: { listAll: async () => [{ id: 9, status: 'normal', is_listed: true }] },
    probeSampleRepository: {
      getProbeSamplesInRange: async () => [regionalAvailabilitySample(9, '2026-08-08')],
      getPacketLossSamplesByDate: async () => [],
    },
    metricsRepository: {
      getLatestByAirportBeforeDate: async () => null,
      upsertDaily: async (input) => { written.push(input); },
    },
    performanceProbeSettingRepository: {
      getByAirport: async () => ({
        airport_id: 9,
        config_version: 4,
        settings: [
          { probe_id: 'legacy-control', test_enabled: true, include_in_result: false, updated_by: null, updated_at: null },
          { probe_id: 'cn-shanghai', test_enabled: true, include_in_result: true, updated_by: null, updated_at: null },
          { probe_id: 'cn-guangzhou', test_enabled: true, include_in_result: true, updated_by: null, updated_at: null },
        ],
      }),
    },
    performanceRunRepository: {
      getLatestByAirportAndDate: async () => null,
      listByAirportAndDate: async () => [
        regionalRun('cn-shanghai', 4, 160, 80),
        regionalRun('cn-guangzhou', 4, 100, 120),
        { ...regionalRun('cn-shanghai', 4, 999, 1), run_mode: 'shadow' },
      ],
    },
  });

  const result = await service.aggregateAirportForDate(9, '2026-08-08');

  assert.equal(result.aggregated, 1);
  assert.deepEqual(result.pending_probe_ids, []);
  assert.deepEqual(written[0].performance_included_probe_ids, ['cn-guangzhou', 'cn-shanghai']);
  assert.equal(written[0].median_download_mbps, 130);
  assert.equal(written[0].median_latency_ms, 100);
  assert.equal(typeof written[0].performance_score, 'number');
  assert.equal(written[0].performance_rule_summary, 'cn_dual_probe_v1');
});

test('aggregateAirportForDate preserves prior metrics when an official region is missing', async () => {
  let writes = 0;
  const service = new AggregationService({
    airportRepository: { listAll: async () => [{ id: 9, status: 'normal', is_listed: true }] },
    probeSampleRepository: {
      getProbeSamplesInRange: async () => [regionalAvailabilitySample(9, '2026-08-08')],
      getPacketLossSamplesByDate: async () => [],
    },
    metricsRepository: {
      getLatestByAirportBeforeDate: async () => null,
      upsertDaily: async () => { writes += 1; },
    },
    performanceProbeSettingRepository: {
      getByAirport: async () => ({
        airport_id: 9,
        config_version: 4,
        settings: [
          { probe_id: 'legacy-control', test_enabled: true, include_in_result: false, updated_by: null, updated_at: null },
          { probe_id: 'cn-shanghai', test_enabled: true, include_in_result: true, updated_by: null, updated_at: null },
          { probe_id: 'cn-guangzhou', test_enabled: true, include_in_result: true, updated_by: null, updated_at: null },
        ],
      }),
    },
    performanceRunRepository: {
      getLatestByAirportAndDate: async () => null,
      listByAirportAndDate: async () => [regionalRun('cn-shanghai', 4, 160, 80)],
    },
  });

  const result = await service.aggregateAirportForDate(9, '2026-08-08');

  assert.deepEqual(result, { aggregated: 0, pending_probe_ids: ['cn-guangzhou'] });
  assert.equal(writes, 0);
});

function regionalAvailabilitySample(airportId: number, date: string): ProbeSample {
  return {
    id: 1,
    airport_id: airportId,
    sampled_at: `${date}T01:00:00.000Z`,
    sample_type: 'availability',
    probe_scope: 'stability',
    latency_ms: null,
    download_mbps: null,
    availability: true,
    source: 'scheduler-stability',
  };
}

function regionalRun(
  probeId: 'cn-shanghai' | 'cn-guangzhou',
  configVersion: number,
  downloadMbps: number,
  latencyMs: number,
): PerformanceRun {
  return {
    id: probeId === 'cn-shanghai' ? 91 : 92,
    airport_id: 9,
    sampled_at: '2026-08-08T12:00:00+08:00',
    sampled_date: '2026-08-08',
    source: 'scheduler-performance',
    status: 'success',
    job_id: `job-${probeId}`,
    probe_id: probeId,
    region_code: probeId,
    provider: 'tencent-cloud',
    bandwidth_mbps: 200,
    run_mode: 'official',
    test_profile: 'mainland_multi_target_v1',
    scoring_rule_version: 'cn_dual_probe_v1',
    config_version: configVersion,
    calibration_status: 'passed',
    calibration_mbps: 180,
    review_status: 'normal',
    review_reasons: [],
    subscription_format: 'plain',
    parsed_nodes_count: 2,
    supported_nodes_count: 2,
    selected_nodes: [],
    tested_nodes: [{ name: 'HK', region: 'HK', type: 'vless', status: 'ok', download_mbps: downloadMbps }],
    available_nodes_count: 2,
    unavailable_nodes_count: 0,
    node_availability_percent: 100,
    node_unavailability_percent: 0,
    median_latency_ms: latencyMs,
    median_download_mbps: downloadMbps,
    packet_loss_percent: 0,
    error_code: null,
    error_message: null,
    diagnostics: {},
  };
}

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
      sampled_at: '2026-03-28T01:23:00.000Z',
      sample_type: 'latency',
      probe_scope: 'stability',
      latency_ms: 59.19,
      download_mbps: null,
      availability: null,
      source: 'agent',
    },
    {
      id: 7,
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
      id: 8,
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
      id: 9,
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
  assert.equal(written[0].latency_cv, 1.4909);
  assert.equal(written[0].is_stable_day, true);
  assert.equal(written[0].stable_days_streak, 2);
  assert.equal(written[0].healthy_days_streak, 2);
  assert.equal(written[0].stability_tier, 'stable');
});

test('aggregateForDate uses the latest stability latency batch for current-day latency metrics', async () => {
  const written: DailyMetrics[] = [];
  const samples: ProbeSample[] = [
    {
      id: 1,
      airport_id: 1,
      sampled_at: '2026-05-31T05:35:26+08:00',
      sample_type: 'availability',
      probe_scope: 'stability',
      latency_ms: null,
      download_mbps: null,
      availability: true,
      source: 'manual-stability',
    },
    {
      id: 2,
      airport_id: 1,
      sampled_at: '2026-05-31T05:35:29+08:00',
      sample_type: 'latency',
      probe_scope: 'stability',
      latency_ms: 51.62,
      download_mbps: null,
      availability: null,
      source: 'manual-stability',
    },
    {
      id: 3,
      airport_id: 1,
      sampled_at: '2026-05-31T05:35:32+08:00',
      sample_type: 'latency',
      probe_scope: 'stability',
      latency_ms: 43.62,
      download_mbps: null,
      availability: null,
      source: 'manual-stability',
    },
    {
      id: 4,
      airport_id: 1,
      sampled_at: '2026-05-31T05:48:47+08:00',
      sample_type: 'availability',
      probe_scope: 'stability',
      latency_ms: null,
      download_mbps: null,
      availability: true,
      source: 'manual-stability',
    },
    {
      id: 5,
      airport_id: 1,
      sampled_at: '2026-05-31T05:48:50+08:00',
      sample_type: 'latency',
      probe_scope: 'stability',
      latency_ms: 3.55,
      download_mbps: null,
      availability: null,
      source: 'manual-stability',
    },
    {
      id: 6,
      airport_id: 1,
      sampled_at: '2026-05-31T05:48:53+08:00',
      sample_type: 'latency',
      probe_scope: 'stability',
      latency_ms: 3.45,
      download_mbps: null,
      availability: null,
      source: 'manual-stability',
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

  const result = await service.aggregateForDate('2026-05-31');
  assert.equal(result.aggregated, 1);
  assert.deepEqual(written[0].latency_samples_ms, [3.55, 3.45]);
  assert.equal(written[0].latency_mean_ms, 3.5);
});

test('aggregateAirportForDate replaces stale availability failures with the latest manual recheck', async () => {
  const samples: ProbeSample[] = [
    availabilitySample(1, '2026-07-11T01:00:00.000Z', false, 'scheduler-stability'),
    availabilitySample(2, '2026-07-11T02:00:00.000Z', true, 'manual-stability'),
    latencySample(3, '2026-07-11T02:01:00.000Z', 10, 'manual-stability'),
    availabilitySample(4, '2026-07-12T01:00:00.000Z', false, 'scheduler-stability'),
    availabilitySample(5, '2026-07-12T02:00:00.000Z', false, 'scheduler-stability'),
    availabilitySample(6, '2026-07-12T03:00:00.000Z', false, 'scheduler-stability'),
    availabilitySample(7, '2026-07-12T04:00:00.000Z', true, 'scheduler-stability'),
    availabilitySample(8, '2026-07-12T05:00:00.000Z', true, 'manual-stability'),
    latencySample(9, '2026-07-12T05:01:00.000Z', 5.33, 'manual-stability'),
    latencySample(10, '2026-07-12T05:02:00.000Z', 5.28, 'manual-stability'),
  ];

  const written = await aggregateSamplesForDate(samples, '2026-07-12');

  assert.equal(written.uptime_percent_today, 100);
  assert.equal(written.uptime_percent_30d, 100);
  assert.equal(written.stability_tier, 'stable');
  assert.equal(written.stable_days_streak, 2);
  assert.equal(written.healthy_days_streak, 2);
});

test('aggregateAirportForDate keeps ordinary availability observations cumulative', async () => {
  const samples: ProbeSample[] = [
    availabilitySample(1, '2026-07-12T01:00:00.000Z', false, 'scheduler-stability'),
    availabilitySample(2, '2026-07-12T02:00:00.000Z', true, 'cron-stability'),
    latencySample(3, '2026-07-12T02:01:00.000Z', 5, 'cron-stability'),
  ];

  const written = await aggregateSamplesForDate(samples, '2026-07-12');

  assert.equal(written.uptime_percent_today, 50);
});

test('aggregateAirportForDate includes ordinary observations recorded after a recheck', async () => {
  const samples: ProbeSample[] = [
    availabilitySample(1, '2026-07-12T01:00:00.000Z', false, 'scheduler-stability'),
    availabilitySample(2, '2026-07-12T02:00:00.000Z', true, 'manual-stability'),
    availabilitySample(3, '2026-07-12T03:00:00.000Z', false, 'cron-stability'),
    latencySample(4, '2026-07-12T03:01:00.000Z', 5, 'cron-stability'),
  ];

  const written = await aggregateSamplesForDate(samples, '2026-07-12');

  assert.equal(written.uptime_percent_today, 50);
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
      latency_ms: 350,
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
      latency_ms: 380,
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
      latency_ms: 420,
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
      latency_ms: 460,
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
      latency_ms: 490,
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

function availabilitySample(
  id: number,
  sampledAt: string,
  availability: boolean,
  source: string,
): ProbeSample {
  return {
    id,
    airport_id: 1,
    sampled_at: sampledAt,
    sample_type: 'availability',
    probe_scope: 'stability',
    latency_ms: null,
    download_mbps: null,
    availability,
    source,
  };
}

function latencySample(
  id: number,
  sampledAt: string,
  latencyMs: number,
  source: string,
): ProbeSample {
  return {
    id,
    airport_id: 1,
    sampled_at: sampledAt,
    sample_type: 'latency',
    probe_scope: 'stability',
    latency_ms: latencyMs,
    download_mbps: null,
    availability: null,
    source,
  };
}

async function aggregateSamplesForDate(samples: ProbeSample[], date: string): Promise<DailyMetrics> {
  const written: DailyMetrics[] = [];
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

  const result = await service.aggregateAirportForDate(1, date);
  assert.equal(result.aggregated, 1);
  assert.equal(written.length, 1);
  return written[0];
}
