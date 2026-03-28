import test from 'node:test';
import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import express from 'express';
import { errorHandler } from '../src/middleware/errorHandler';
import { createAdminRoutes } from '../src/routes/adminRoutes';
import { TelegramSendError } from '../src/services/telegramNotificationService';
import type { PerformanceRunInput, ProbeSampleInput } from '../src/types/domain';

test('POST /performance-runs stores run diagnostics and performance samples', async () => {
  const insertedSamples: ProbeSampleInput[] = [];
  const insertedPacketLoss: ProbeSampleInput[] = [];
  const insertedRuns: PerformanceRunInput[] = [];

  const app = express();
  app.use(express.json());
  app.use(
    createAdminRoutes({
      airportRepository: stubAirportRepository(),
      airportApplicationRepository: stubAirportApplicationRepository(),
      probeSampleRepository: {
        insertProbeSample: async (input) => {
          insertedSamples.push(input);
          return insertedSamples.length;
        },
        insertPacketLossSample: async (input) => {
          insertedPacketLoss.push(input);
          return insertedPacketLoss.length;
        },
        listProbeSamples: async () => [],
        listLatestProbeSamples: async () => [],
      },
      performanceRunRepository: {
        insert: async (input) => {
          insertedRuns.push(input);
          return 42;
        },
        getLatestByAirportAndDate: async () => null,
        getLatestByAirportBeforeDate: async () => null,
      },
      metricsRepository: stubMetricsRepository(),
      scoreRepository: {
        getByAirportAndDate: async () => null,
        getTrend: async () => [],
      },
      recomputeService: stubRecomputeService(),
      aggregationService: stubAggregationService(),
      manualJobService: stubManualJobService(),
      auditRepository: { log: async () => undefined },
      publicViewService: stubPublicViewService(),
    }),
  );

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/performance-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        airport_id: 1,
        sampled_at: '2026-03-22T12:00:00.000Z',
        status: 'partial',
        source: 'cron-performance',
        subscription_format: 'base64',
        parsed_nodes_count: 8,
        supported_nodes_count: 5,
        selected_nodes: [{ name: 'HK-1', region: 'HK', type: 'trojan' }],
        tested_nodes: [{ name: 'HK-1', region: 'HK', type: 'trojan', status: 'ok' }],
        latency_samples_ms: [100, 120],
        download_samples_mbps: [88.8],
        packet_loss_percent: 33.33,
        diagnostics: { unsupported_nodes_count: 3 },
        error_code: 'partial_probe_failure',
        error_message: 'one node failed',
      }),
    });

    assert.equal(response.status, 201);
    assert.equal(insertedSamples.length, 3);
    assert.equal(insertedSamples[0].probe_scope, 'performance');
    assert.equal(insertedSamples[0].sample_type, 'latency');
    assert.equal(insertedSamples[2].sample_type, 'download');
    assert.equal(insertedPacketLoss.length, 1);
    assert.equal(insertedPacketLoss[0].probe_scope, 'performance');
    assert.equal(insertedRuns.length, 1);
    assert.equal(insertedRuns[0].median_latency_ms, 110);
    assert.equal(insertedRuns[0].median_download_mbps, 88.8);
    assert.equal(insertedRuns[0].status, 'partial');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /airports/:id/dashboard exposes performance run diagnostics', async () => {
  const app = express();
  app.use(express.json());
  app.use(
    createAdminRoutes({
      airportRepository: stubAirportRepository(),
      airportApplicationRepository: stubAirportApplicationRepository(),
      probeSampleRepository: {
        insertProbeSample: async () => 1,
        insertPacketLossSample: async () => 1,
        listProbeSamples: async () => [],
        listLatestProbeSamples: async () => [],
      },
      performanceRunRepository: {
        insert: async () => 1,
        getLatestByAirportAndDate: async () => ({
          id: 9,
          airport_id: 1,
          sampled_at: '2026-03-22T12:00:00.000Z',
          source: 'cron-performance',
          status: 'failed',
          subscription_format: 'plain',
          parsed_nodes_count: 3,
          supported_nodes_count: 1,
          selected_nodes: [{ name: 'JP-1', region: 'JP', type: 'vless' }],
          tested_nodes: [{ name: 'JP-1', region: 'JP', type: 'vless', status: 'failed' }],
          median_latency_ms: null,
          median_download_mbps: null,
          packet_loss_percent: null,
          error_code: 'no_successful_probes',
          error_message: 'all selected nodes failed',
          diagnostics: {},
        }),
        getLatestByAirportBeforeDate: async () => ({
          id: 9,
          airport_id: 1,
          sampled_at: '2026-03-22T12:00:00.000Z',
          source: 'cron-performance',
          status: 'failed',
          subscription_format: 'plain',
          parsed_nodes_count: 3,
          supported_nodes_count: 1,
          selected_nodes: [{ name: 'JP-1', region: 'JP', type: 'vless' }],
          tested_nodes: [{ name: 'JP-1', region: 'JP', type: 'vless', status: 'failed' }],
          median_latency_ms: null,
          median_download_mbps: null,
          packet_loss_percent: null,
          error_code: 'no_successful_probes',
          error_message: 'all selected nodes failed',
          diagnostics: {},
        }),
      },
      metricsRepository: stubMetricsRepository(),
      scoreRepository: {
        getByAirportAndDate: async () => null,
        getTrend: async () => [
          { date: '2026-03-20', s: 80, p: 70, r: 90 },
          { date: '2026-03-21', s: 90, p: 60, r: 85 },
        ],
      },
      recomputeService: stubRecomputeService(),
      aggregationService: stubAggregationService(),
      manualJobService: stubManualJobService(),
      auditRepository: { log: async () => undefined },
      publicViewService: stubPublicViewService(),
    }),
  );

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/airports/1/dashboard?date=2026-03-22`);
    assert.equal(response.status, 200);
    const data = (await response.json()) as {
      performance: Record<string, unknown>;
      base: Record<string, unknown>;
    };
    assert.equal(data.performance.collect_status, 'failed');
    assert.equal(data.performance.data_source_mode, '当日实测');
    assert.equal(data.performance.cache_source_date, null);
    assert.equal(data.performance.subscription_format, 'plain');
    assert.equal(data.performance.parsed_nodes_count, 3);
    assert.equal(data.performance.tested_nodes_count, 1);
    assert.equal((data.performance.selected_nodes as Array<{ name: string }>)[0].name, 'JP-1');
    assert.equal(data.base.price_score, 80);
    assert.equal(data.base.score_data_days, 2);
    assert.equal(data.base.total_score, 22.91);
    assert.deepEqual(data.base.manual_tags, ['老牌机场']);
    assert.deepEqual(data.base.auto_tags, ['观察中']);
    assert.deepEqual(data.base.tags, ['老牌机场', '观察中']);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /airports/:id/dashboard exposes risk breakdown details', async () => {
  const app = express();
  app.use(express.json());
  app.use(
    createAdminRoutes({
      airportRepository: stubAirportRepository(),
      airportApplicationRepository: stubAirportApplicationRepository(),
      probeSampleRepository: {
        insertProbeSample: async () => 1,
        insertPacketLossSample: async () => 1,
        listProbeSamples: async () => [],
        listLatestProbeSamples: async () => [],
      },
      performanceRunRepository: {
        insert: async () => 1,
        getLatestByAirportAndDate: async () => null,
        getLatestByAirportBeforeDate: async () => null,
      },
      metricsRepository: {
        ...stubMetricsRepository(),
        getByAirportAndDate: async () => ({
          airport_id: 1,
          date: '2026-03-22',
          domain_ok: false,
          ssl_days_left: null,
          recent_complaints_count: 2,
          history_incidents: 1,
        }),
      },
      scoreRepository: {
        getByAirportAndDate: async () => ({
          r: 49,
          risk_penalty: 51,
          details: {
            domain_penalty: 30,
            ssl_penalty: 5,
            complaint_penalty: 6,
            history_penalty: 10,
            total_penalty: 51,
            risk_level: 'high',
          },
        }),
        getTrend: async () => [],
      },
      recomputeService: stubRecomputeService(),
      aggregationService: stubAggregationService(),
      manualJobService: stubManualJobService(),
      auditRepository: { log: async () => undefined },
      publicViewService: stubPublicViewService(),
    }),
  );

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/airports/1/dashboard?date=2026-03-22`);
    assert.equal(response.status, 200);
    const data = (await response.json()) as { risk: Record<string, unknown> };
    assert.equal(data.risk.domain_penalty, 30);
    assert.equal(data.risk.ssl_penalty, 5);
    assert.equal(data.risk.complaint_penalty, 6);
    assert.equal(data.risk.history_penalty, 10);
    assert.equal(data.risk.total_penalty, 51);
    assert.equal(data.risk.risk_level, 'high');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /airports/:id/dashboard exposes raw and effective stability diagnostics', async () => {
  const app = express();
  app.use(express.json());
  app.use(
    createAdminRoutes({
      airportRepository: stubAirportRepository(),
      airportApplicationRepository: stubAirportApplicationRepository(),
      probeSampleRepository: {
        insertProbeSample: async () => 1,
        insertPacketLossSample: async () => 1,
        listProbeSamples: async () => [],
        listLatestProbeSamples: async () => [],
      },
      performanceRunRepository: {
        insert: async () => 1,
        getLatestByAirportAndDate: async () => null,
        getLatestByAirportBeforeDate: async () => null,
      },
      metricsRepository: {
        ...stubMetricsRepository(),
        getByAirportAndDate: async () => ({
          airport_id: 1,
          date: '2026-03-28',
          uptime_percent_30d: 99.8,
          uptime_percent_today: 100,
          latency_samples_ms: [3.7, 6.03, 3.74, 5.89, 3.48],
          latency_mean_ms: 4.57,
          latency_std_ms: 1.14,
          latency_cv: 0.2498,
          stable_days_streak: 15,
          is_stable_day: null,
        }),
      },
      scoreRepository: {
        getByAirportAndDate: async () => null,
        getTrend: async () => [],
      },
      recomputeService: stubRecomputeService(),
      aggregationService: stubAggregationService(),
      manualJobService: stubManualJobService(),
      auditRepository: { log: async () => undefined },
      publicViewService: stubPublicViewService(),
    }),
  );

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/airports/1/dashboard?date=2026-03-28`);
    assert.equal(response.status, 200);
    const data = (await response.json()) as { stability: Record<string, unknown> };
    assert.equal(data.stability.latency_cv, 0.2498);
    assert.equal(data.stability.effective_latency_cv, 0.1023);
    assert.equal(data.stability.is_stable_day, true);
    assert.equal(data.stability.stability_score, 89.77);
    assert.equal(data.stability.stability_rule_version, 'robust_cv_v1');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /airports/:id/dashboard marks performance metrics as cached when run is inherited', async () => {
  const app = express();
  app.use(express.json());
  app.use(
    createAdminRoutes({
      airportRepository: stubAirportRepository(),
      airportApplicationRepository: stubAirportApplicationRepository(),
      probeSampleRepository: {
        insertProbeSample: async () => 1,
        insertPacketLossSample: async () => 1,
        listProbeSamples: async () => [],
        listLatestProbeSamples: async () => [],
      },
      performanceRunRepository: {
        insert: async () => 1,
        getLatestByAirportAndDate: async () => null,
        getLatestByAirportBeforeDate: async () => ({
          id: 7,
          airport_id: 1,
          sampled_at: '2026-03-22T08:00:00.000Z',
          source: 'cron-performance',
          status: 'success',
          subscription_format: 'base64',
          parsed_nodes_count: 8,
          supported_nodes_count: 5,
          selected_nodes: [{ name: 'HK-1', region: 'HK', type: 'trojan' }],
          tested_nodes: [
            {
              name: 'HK-1',
              region: 'HK',
              type: 'trojan',
              status: 'ok',
              connect_latency_median_ms: 88.8,
              proxy_http_latency_median_ms: 820.5,
              download_mbps: 123.4,
            },
          ],
          median_latency_ms: 100,
          median_download_mbps: 80,
          packet_loss_percent: 0.5,
          error_code: null,
          error_message: null,
          diagnostics: {
            latency_measurement: 'tcp_connect_to_node_server',
            latency_probe_target: 'node_server',
            proxy_http_test_url: 'https://www.google.com/generate_204',
            proxy_http_median_latency_ms: 820.5,
            speed_measurement: 'multi_connection_http_download_via_local_proxy',
            speed_test_connections: 4,
          },
        }),
      },
      metricsRepository: {
        ...stubMetricsRepository(),
        getByAirportAndDate: async () => ({
          airport_id: 1,
          date: '2026-03-23',
          median_latency_ms: 100,
          median_download_mbps: 80,
          packet_loss_percent: 0.5,
        }),
      },
      scoreRepository: {
        getByAirportAndDate: async () => null,
        getTrend: async () => [],
      },
      recomputeService: stubRecomputeService(),
      aggregationService: stubAggregationService(),
      manualJobService: stubManualJobService(),
      auditRepository: { log: async () => undefined },
      publicViewService: stubPublicViewService(),
    }),
  );

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/airports/1/dashboard?date=2026-03-23`);
    assert.equal(response.status, 200);
    const data = (await response.json()) as { performance: Record<string, unknown> };
    assert.equal(data.performance.data_source_mode, '历史缓存');
    assert.equal(data.performance.cache_source_date, '2026-03-22');
    assert.equal(data.performance.last_source, 'cron-performance');
    assert.equal(data.performance.latency_measurement, 'tcp_connect_to_node_server');
    assert.equal(data.performance.proxy_http_median_latency_ms, 820.5);
    assert.equal(data.performance.speed_test_connections, 4);
    assert.equal((data.performance.tested_nodes as Array<Record<string, unknown>>)[0].download_mbps, 123.4);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /airports/:id/manual-jobs creates airport scoped manual job', async () => {
  const created: Array<{ airportId: number; date: string; kind: string }> = [];

  const app = express();
  app.use(express.json());
  app.use(
    createAdminRoutes({
      airportRepository: stubAirportRepository(),
      airportApplicationRepository: stubAirportApplicationRepository(),
      probeSampleRepository: {
        insertProbeSample: async () => 1,
        insertPacketLossSample: async () => 1,
        listProbeSamples: async () => [],
        listLatestProbeSamples: async () => [],
      },
      performanceRunRepository: {
        insert: async () => 1,
        getLatestByAirportAndDate: async () => null,
        getLatestByAirportBeforeDate: async () => null,
      },
      metricsRepository: stubMetricsRepository(),
      scoreRepository: {
        getByAirportAndDate: async () => null,
        getTrend: async () => [],
      },
      recomputeService: stubRecomputeService(),
      aggregationService: stubAggregationService(),
      manualJobService: {
        createJob: async (input) => {
          created.push({ airportId: input.airportId, date: input.date, kind: input.kind });
          return {
            id: 99,
            airport_id: input.airportId,
            date: input.date,
            kind: input.kind,
            status: 'queued',
            message: '任务已创建',
            created_by: input.createdBy,
            request_id: input.requestId,
            started_at: null,
            finished_at: null,
            created_at: '2026-03-23 10:00:00',
            updated_at: '2026-03-23 10:00:00',
          };
        },
        getJob: async () => null,
      },
      auditRepository: { log: async () => undefined },
      publicViewService: stubPublicViewService(),
    }),
  );

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/airports/1/manual-jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'stability', date: '2026-03-23' }),
    });

    assert.equal(response.status, 202);
    assert.deepEqual(created, [{ airportId: 1, date: '2026-03-23', kind: 'stability' }]);
    const data = (await response.json()) as { status: string; kind: string };
    assert.equal(data.status, 'queued');
    assert.equal(data.kind, 'stability');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /manual-jobs/:id returns current manual job status', async () => {
  const app = express();
  app.use(express.json());
  app.use(
    createAdminRoutes({
      airportRepository: stubAirportRepository(),
      airportApplicationRepository: stubAirportApplicationRepository(),
      probeSampleRepository: {
        insertProbeSample: async () => 1,
        insertPacketLossSample: async () => 1,
        listProbeSamples: async () => [],
        listLatestProbeSamples: async () => [],
      },
      performanceRunRepository: {
        insert: async () => 1,
        getLatestByAirportAndDate: async () => null,
        getLatestByAirportBeforeDate: async () => null,
      },
      metricsRepository: stubMetricsRepository(),
      scoreRepository: {
        getByAirportAndDate: async () => null,
        getTrend: async () => [],
      },
      recomputeService: stubRecomputeService(),
      aggregationService: stubAggregationService(),
      manualJobService: {
        createJob: async () => {
          throw new Error('not implemented');
        },
        getJob: async (jobId) => ({
          id: jobId,
          airport_id: 1,
          date: '2026-03-23',
          kind: 'time_decay',
          status: 'running',
          message: '任务执行中',
          created_by: 'tester',
          request_id: 'req-1',
          started_at: '2026-03-23 10:01:00',
          finished_at: null,
          created_at: '2026-03-23 10:00:00',
          updated_at: '2026-03-23 10:01:00',
        }),
      },
      auditRepository: { log: async () => undefined },
      publicViewService: stubPublicViewService(),
    }),
  );

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/manual-jobs/15`);
    assert.equal(response.status, 200);
    const data = (await response.json()) as { id: number; status: string; kind: string };
    assert.equal(data.id, 15);
    assert.equal(data.status, 'running');
    assert.equal(data.kind, 'time_decay');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /airports returns conflict for duplicate airport names', async () => {
  const app = express();
  app.use(express.json());
  app.use(
    createAdminRoutes({
      airportRepository: {
        ...stubAirportRepository(),
        create: async () => {
          const error = new Error("Duplicate entry 'Airport' for key 'uk_airports_name'") as Error & {
            code?: string;
          };
          error.code = 'ER_DUP_ENTRY';
          throw error;
        },
      },
      airportApplicationRepository: stubAirportApplicationRepository(),
      probeSampleRepository: {
        insertProbeSample: async () => 1,
        insertPacketLossSample: async () => 1,
        listProbeSamples: async () => [],
        listLatestProbeSamples: async () => [],
      },
      performanceRunRepository: {
        insert: async () => 1,
        getLatestByAirportAndDate: async () => null,
        getLatestByAirportBeforeDate: async () => null,
      },
      metricsRepository: stubMetricsRepository(),
      scoreRepository: {
        getByAirportAndDate: async () => null,
        getTrend: async () => [],
      },
      recomputeService: stubRecomputeService(),
      aggregationService: stubAggregationService(),
      manualJobService: stubManualJobService(),
      auditRepository: { log: async () => undefined },
      publicViewService: stubPublicViewService(),
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/airports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Airport',
        website: 'https://example.com',
        websites: ['https://example.com'],
        plan_price_month: 10,
        has_trial: true,
      }),
    });

    assert.equal(response.status, 409);
    const data = (await response.json()) as { code: string; message: string };
    assert.equal(data.code, 'AIRPORT_NAME_CONFLICT');
    assert.equal(data.message, '机场名称已存在');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /airport-applications returns filtered application list', async () => {
  const app = express();
  app.use(express.json());
  app.use(
    createAdminRoutes({
      airportRepository: stubAirportRepository(),
      airportApplicationRepository: {
        ...stubAirportApplicationRepository(),
        listByQuery: async (query) => ({
          total: 1,
          items: [
            {
              ...(await stubAirportApplicationRepository().getById(7)),
              name: `Cloud ${query.reviewStatus || 'pending'}`,
              review_status: query.reviewStatus || 'pending',
            },
          ],
        }),
      },
      probeSampleRepository: {
        insertProbeSample: async () => 1,
        insertPacketLossSample: async () => 1,
        listProbeSamples: async () => [],
        listLatestProbeSamples: async () => [],
      },
      performanceRunRepository: {
        insert: async () => 1,
        getLatestByAirportAndDate: async () => null,
        getLatestByAirportBeforeDate: async () => null,
      },
      metricsRepository: stubMetricsRepository(),
      scoreRepository: {
        getByAirportAndDate: async () => null,
        getTrend: async () => [],
      },
      recomputeService: stubRecomputeService(),
      aggregationService: stubAggregationService(),
      manualJobService: stubManualJobService(),
      auditRepository: { log: async () => undefined },
      publicViewService: stubPublicViewService(),
    }),
  );

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/airport-applications?review_status=pending&keyword=cloud`);
    assert.equal(response.status, 200);
    const data = (await response.json()) as { total: number; items: Array<{ review_status: string }> };
    assert.equal(data.total, 1);
    assert.equal(data.items[0].review_status, 'pending');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /airport-applications/:id returns full application details', async () => {
  const app = express();
  app.use(express.json());
  app.use(
    createAdminRoutes({
      airportRepository: stubAirportRepository(),
      airportApplicationRepository: stubAirportApplicationRepository(),
      probeSampleRepository: {
        insertProbeSample: async () => 1,
        insertPacketLossSample: async () => 1,
        listProbeSamples: async () => [],
        listLatestProbeSamples: async () => [],
      },
      performanceRunRepository: {
        insert: async () => 1,
        getLatestByAirportAndDate: async () => null,
        getLatestByAirportBeforeDate: async () => null,
      },
      metricsRepository: stubMetricsRepository(),
      scoreRepository: {
        getByAirportAndDate: async () => null,
        getTrend: async () => [],
      },
      recomputeService: stubRecomputeService(),
      aggregationService: stubAggregationService(),
      manualJobService: stubManualJobService(),
      auditRepository: { log: async () => undefined },
      publicViewService: stubPublicViewService(),
    }),
  );

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/airport-applications/7`);
    assert.equal(response.status, 200);
    const data = (await response.json()) as { id: number; test_password: string };
    assert.equal(data.id, 7);
    assert.equal(data.test_password, 'secret');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /system-settings/telegram returns masked telegram settings', async () => {
  const app = express();
  app.use(express.json());
  app.use(
    createAdminRoutes({
      airportRepository: stubAirportRepository(),
      airportApplicationRepository: stubAirportApplicationRepository(),
      probeSampleRepository: {
        insertProbeSample: async () => 1,
        insertPacketLossSample: async () => 1,
        listProbeSamples: async () => [],
        listLatestProbeSamples: async () => [],
      },
      performanceRunRepository: {
        insert: async () => 1,
        getLatestByAirportAndDate: async () => null,
        getLatestByAirportBeforeDate: async () => null,
      },
      metricsRepository: stubMetricsRepository(),
      scoreRepository: {
        getByAirportAndDate: async () => null,
        getTrend: async () => [],
      },
      recomputeService: stubRecomputeService(),
      aggregationService: stubAggregationService(),
      manualJobService: stubManualJobService(),
      auditRepository: { log: async () => undefined },
      publicViewService: stubPublicViewService(),
      telegramNotificationService: {
        getAdminSettings: async () => ({
          enabled: true,
          delivery_mode: 'telegram_chat',
          telegram_chat: {
            has_bot_token: true,
            bot_token_masked: '1234***abcd',
            chat_id: '-10012345',
            api_base: 'https://api.telegram.org',
            timeout_ms: 5000,
          },
          webhook: {
            has_bearer_token: true,
            bearer_token_masked: 'bear***1234',
            url: 'https://example.com/webhook',
            timeout_ms: 4000,
          },
          updated_at: '2026-03-25 12:00:00',
          updated_by: 'admin',
        }),
        updateAdminSettings: async () => null,
        sendTestMessage: async () => undefined,
      },
    }),
  );

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/system-settings/telegram`);
    assert.equal(response.status, 200);
    const data = (await response.json()) as {
      delivery_mode: string;
      telegram_chat: { has_bot_token: boolean; bot_token_masked: string };
      webhook: { has_bearer_token: boolean; bearer_token_masked: string; url: string };
      updated_by: string;
    };
    assert.equal(data.delivery_mode, 'telegram_chat');
    assert.equal(data.telegram_chat.has_bot_token, true);
    assert.equal(data.telegram_chat.bot_token_masked, '1234***abcd');
    assert.equal(data.webhook.has_bearer_token, true);
    assert.equal(data.webhook.bearer_token_masked, 'bear***1234');
    assert.equal(data.webhook.url, 'https://example.com/webhook');
    assert.equal(data.updated_by, 'admin');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('PATCH /system-settings/telegram updates settings and writes audit log', async () => {
  const updates: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];
  const app = express();
  app.use(express.json());
  app.use(
    createAdminRoutes({
      airportRepository: stubAirportRepository(),
      airportApplicationRepository: stubAirportApplicationRepository(),
      probeSampleRepository: {
        insertProbeSample: async () => 1,
        insertPacketLossSample: async () => 1,
        listProbeSamples: async () => [],
        listLatestProbeSamples: async () => [],
      },
      performanceRunRepository: {
        insert: async () => 1,
        getLatestByAirportAndDate: async () => null,
        getLatestByAirportBeforeDate: async () => null,
      },
      metricsRepository: stubMetricsRepository(),
      scoreRepository: {
        getByAirportAndDate: async () => null,
        getTrend: async () => [],
      },
      recomputeService: stubRecomputeService(),
      aggregationService: stubAggregationService(),
      manualJobService: stubManualJobService(),
      auditRepository: {
        log: async (action, actor, requestId, payload) => {
          audits.push({ action, actor, requestId, payload: payload as Record<string, unknown> });
        },
      },
      publicViewService: stubPublicViewService(),
      telegramNotificationService: {
        getAdminSettings: async () => null,
        updateAdminSettings: async (input, updatedBy) => {
          updates.push({ ...(input as Record<string, unknown>), updatedBy });
          return {
            enabled: true,
            delivery_mode: 'webhook',
            telegram_chat: {
              has_bot_token: true,
              bot_token_masked: '1234***abcd',
              chat_id: '-10012345',
              api_base: 'https://api.telegram.org',
              timeout_ms: 5000,
            },
            webhook: {
              has_bearer_token: true,
              bearer_token_masked: 'bear***1234',
              url: 'https://example.com/webhook',
              timeout_ms: 4000,
            },
            updated_at: '2026-03-25 12:00:00',
            updated_by: updatedBy,
          };
        },
        sendTestMessage: async () => undefined,
      },
    }),
  );

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/system-settings/telegram`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-actor': 'tester' },
      body: JSON.stringify({
        enabled: true,
        delivery_mode: 'webhook',
        telegram_chat: {
          chat_id: '-10012345',
          api_base: 'https://api.telegram.org',
          timeout_ms: 5000,
        },
        webhook: {
          url: 'https://example.com/webhook',
          bearer_token: 'secret-token',
          timeout_ms: 4000,
        },
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(updates.length, 1);
    assert.equal(updates[0].updatedBy, 'tester');
    assert.equal(updates[0].delivery_mode, 'webhook');
    assert.deepEqual(updates[0].telegram_chat, {
      bot_token: undefined,
      chat_id: '-10012345',
      api_base: 'https://api.telegram.org',
      timeout_ms: 5000,
    });
    assert.deepEqual(updates[0].webhook, {
      url: 'https://example.com/webhook',
      bearer_token: 'secret-token',
      timeout_ms: 4000,
    });
    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, 'update_system_setting_telegram');
    const data = (await response.json()) as {
      delivery_mode: string;
      webhook: { bearer_token_masked: string; url: string };
      updated_by: string;
    };
    assert.equal(data.delivery_mode, 'webhook');
    assert.equal(data.webhook.bearer_token_masked, 'bear***1234');
    assert.equal(data.webhook.url, 'https://example.com/webhook');
    assert.equal(data.updated_by, 'tester');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /system-settings/telegram/test sends webhook test request without persisting', async () => {
  const tests: Array<Record<string, unknown>> = [];
  const audits: string[] = [];
  const app = express();
  app.use(express.json());
  app.use(
    createAdminRoutes({
      airportRepository: stubAirportRepository(),
      airportApplicationRepository: stubAirportApplicationRepository(),
      probeSampleRepository: {
        insertProbeSample: async () => 1,
        insertPacketLossSample: async () => 1,
        listProbeSamples: async () => [],
        listLatestProbeSamples: async () => [],
      },
      performanceRunRepository: {
        insert: async () => 1,
        getLatestByAirportAndDate: async () => null,
        getLatestByAirportBeforeDate: async () => null,
      },
      metricsRepository: stubMetricsRepository(),
      scoreRepository: {
        getByAirportAndDate: async () => null,
        getTrend: async () => [],
      },
      recomputeService: stubRecomputeService(),
      aggregationService: stubAggregationService(),
      manualJobService: stubManualJobService(),
      auditRepository: {
        log: async (action) => {
          audits.push(action);
        },
      },
      publicViewService: stubPublicViewService(),
      telegramNotificationService: {
        getAdminSettings: async () => null,
        updateAdminSettings: async () => null,
        sendTestMessage: async (input) => {
          tests.push(input as Record<string, unknown>);
        },
      },
    }),
  );

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/system-settings/telegram/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        delivery_mode: 'webhook',
        webhook: {
          url: 'https://example.com/webhook',
          timeout_ms: 8000,
        },
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(tests.length, 1);
    assert.equal(tests[0].delivery_mode, 'webhook');
    assert.deepEqual(tests[0].webhook, {
      url: 'https://example.com/webhook',
      bearer_token: undefined,
      timeout_ms: 8000,
    });
    assert.deepEqual(audits, ['test_system_setting_telegram']);
    const data = (await response.json()) as { ok: boolean };
    assert.equal(data.ok, true);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /system-settings/telegram/test exposes telegram validation errors', async () => {
  const app = express();
  app.use(express.json());
  app.use(
    createAdminRoutes({
      airportRepository: stubAirportRepository(),
      airportApplicationRepository: stubAirportApplicationRepository(),
      probeSampleRepository: {
        insertProbeSample: async () => 1,
        insertPacketLossSample: async () => 1,
        listProbeSamples: async () => [],
        listLatestProbeSamples: async () => [],
      },
      performanceRunRepository: {
        insert: async () => 1,
        getLatestByAirportAndDate: async () => null,
        getLatestByAirportBeforeDate: async () => null,
      },
      metricsRepository: stubMetricsRepository(),
      scoreRepository: {
        getByAirportAndDate: async () => null,
        getTrend: async () => [],
      },
      recomputeService: stubRecomputeService(),
      aggregationService: stubAggregationService(),
      manualJobService: stubManualJobService(),
      auditRepository: { log: async () => undefined },
      publicViewService: stubPublicViewService(),
      telegramNotificationService: {
        getAdminSettings: async () => null,
        updateAdminSettings: async () => null,
        sendTestMessage: async () => {
          throw new TelegramSendError(
            'Telegram 拒绝发送：当前 Chat ID 指向的是一个 bot。请填写你自己的用户或群组 chat id，而不是 bot 自己的 id。',
            400,
          );
        },
      },
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/system-settings/telegram/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 400);
    const data = (await response.json()) as { code: string; message: string };
    assert.equal(data.code, 'TELEGRAM_TEST_FAILED');
    assert.match(data.message, /Chat ID 指向的是一个 bot/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('PATCH /airports persists extended airport fields', async () => {
  const created: Array<Record<string, unknown>> = [];
  const updated: Array<Record<string, unknown>> = [];
  const app = express();
  app.use(express.json());
  app.use(
    createAdminRoutes({
      airportRepository: {
        ...stubAirportRepository(),
        create: async (input) => {
          created.push(input as Record<string, unknown>);
          return 9;
        },
        update: async (id, input) => {
          updated.push({ id, ...(input as Record<string, unknown>) });
          return true;
        },
      },
      airportApplicationRepository: stubAirportApplicationRepository(),
      probeSampleRepository: {
        insertProbeSample: async () => 1,
        insertPacketLossSample: async () => 1,
        listProbeSamples: async () => [],
        listLatestProbeSamples: async () => [],
      },
      performanceRunRepository: {
        insert: async () => 1,
        getLatestByAirportAndDate: async () => null,
        getLatestByAirportBeforeDate: async () => null,
      },
      metricsRepository: stubMetricsRepository(),
      scoreRepository: {
        getByAirportAndDate: async () => null,
        getTrend: async () => [],
      },
      recomputeService: stubRecomputeService(),
      aggregationService: stubAggregationService(),
      manualJobService: stubManualJobService(),
      auditRepository: { log: async () => undefined },
      publicViewService: stubPublicViewService(),
    }),
  );

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const createResponse = await fetch(`http://127.0.0.1:${port}/airports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Airport',
        websites: ['https://example.com'],
        plan_price_month: 10,
        has_trial: true,
        applicant_email: 'ops@example.com',
        applicant_telegram: '@ops',
        founded_on: '2025-01-01',
        airport_intro: 'intro',
        test_account: 'tester',
        test_password: 'secret',
      }),
    });
    assert.equal(createResponse.status, 201);
    assert.equal(created.length, 1);
    assert.equal(created[0].applicant_email, 'ops@example.com');
    assert.equal(created[0].test_password, 'secret');

    const updateResponse = await fetch(`http://127.0.0.1:${port}/airports/9`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        airport_intro: 'updated intro',
        founded_on: '2025-02-01',
      }),
    });
    assert.equal(updateResponse.status, 200);
    assert.equal(updated.length, 1);
    assert.equal(updated[0].id, 9);
    assert.equal(updated[0].airport_intro, 'updated intro');
    assert.equal(updated[0].founded_on, '2025-02-01');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('PATCH /airport-applications/:id/review approves once and creates an airport', async () => {
  const reviewed: Array<Record<string, unknown>> = [];
  const createdAirports: Array<Record<string, unknown>> = [];
  let currentApplication: Record<string, unknown> = {
    id: 7,
    name: 'Cloud Airport',
    website: 'https://example.com',
    websites: ['https://example.com', 'https://mirror.example.com'],
    status: 'normal',
    plan_price_month: 10,
    has_trial: true,
    subscription_url: 'https://example.com/sub',
    applicant_email: 'contact@example.com',
    applicant_telegram: '@cloud',
    founded_on: '2025-01-01',
    airport_intro: 'intro',
    test_account: 'tester',
    test_password: 'secret',
    approved_airport_id: null,
    review_status: 'pending',
    review_note: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: '2026-03-24 10:00:00',
    updated_at: '2026-03-24 10:00:00',
  };
  const app = express();
  app.use(express.json());
  app.use(
    createAdminRoutes({
      airportRepository: {
        ...stubAirportRepository(),
        create: async (input) => {
          createdAirports.push(input as Record<string, unknown>);
          return 42;
        },
      },
      airportApplicationRepository: {
        ...stubAirportApplicationRepository(),
        review: async (id, input) => {
          reviewed.push({ id, ...input });
          currentApplication = {
            ...currentApplication,
            review_status: input.review_status,
            review_note: input.review_note ?? null,
            approved_airport_id: input.approved_airport_id ?? null,
            reviewed_by: input.reviewed_by,
            reviewed_at: input.reviewed_at,
          };
          return true;
        },
        getById: async () => currentApplication,
      },
      probeSampleRepository: {
        insertProbeSample: async () => 1,
        insertPacketLossSample: async () => 1,
        listProbeSamples: async () => [],
        listLatestProbeSamples: async () => [],
      },
      performanceRunRepository: {
        insert: async () => 1,
        getLatestByAirportAndDate: async () => null,
        getLatestByAirportBeforeDate: async () => null,
      },
      metricsRepository: stubMetricsRepository(),
      scoreRepository: {
        getByAirportAndDate: async () => null,
        getTrend: async () => [],
      },
      recomputeService: stubRecomputeService(),
      aggregationService: stubAggregationService(),
      manualJobService: stubManualJobService(),
      auditRepository: { log: async () => undefined },
      publicViewService: stubPublicViewService(),
    }),
  );

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/airport-applications/7/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-actor': 'tester' },
      body: JSON.stringify({
        review_status: 'reviewed',
        review_note: 'checked',
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(createdAirports.length, 1);
    assert.equal(reviewed.length, 1);
    assert.equal(reviewed[0].id, 7);
    assert.equal(reviewed[0].review_status, 'reviewed');
    assert.equal(reviewed[0].reviewed_by, 'tester');
    assert.equal(reviewed[0].approved_airport_id, 42);
    assert.equal(createdAirports[0].name, 'Cloud Airport');
    assert.equal(createdAirports[0].applicant_email, 'contact@example.com');
    const data = (await response.json()) as {
      review_status: string;
      review_note: string;
      reviewed_by: string;
      approved_airport_id: number;
    };
    assert.equal(data.review_status, 'reviewed');
    assert.equal(data.review_note, 'checked');
    assert.equal(data.reviewed_by, 'tester');
    assert.equal(data.approved_airport_id, 42);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('PATCH /airport-applications/:id/review rejects already reviewed applications', async () => {
  const app = express();
  app.use(express.json());
  app.use(
    createAdminRoutes({
      airportRepository: stubAirportRepository(),
      airportApplicationRepository: {
        ...stubAirportApplicationRepository(),
        getById: async (id) => ({
          ...(await stubAirportApplicationRepository().getById(id)),
          review_status: 'reviewed',
          approved_airport_id: 42,
        }),
      },
      probeSampleRepository: {
        insertProbeSample: async () => 1,
        insertPacketLossSample: async () => 1,
        listProbeSamples: async () => [],
        listLatestProbeSamples: async () => [],
      },
      performanceRunRepository: {
        insert: async () => 1,
        getLatestByAirportAndDate: async () => null,
        getLatestByAirportBeforeDate: async () => null,
      },
      metricsRepository: stubMetricsRepository(),
      scoreRepository: {
        getByAirportAndDate: async () => null,
        getTrend: async () => [],
      },
      recomputeService: stubRecomputeService(),
      aggregationService: stubAggregationService(),
      manualJobService: stubManualJobService(),
      auditRepository: { log: async () => undefined },
      publicViewService: stubPublicViewService(),
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/airport-applications/7/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-actor': 'tester' },
      body: JSON.stringify({
        review_status: 'rejected',
        review_note: 'late change',
      }),
    });
    assert.equal(response.status, 409);
    const data = (await response.json()) as { code: string };
    assert.equal(data.code, 'AIRPORT_APPLICATION_ALREADY_REVIEWED');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /airports prefers manual_tags over legacy tags field', async () => {
  const createdInputs: Array<Record<string, unknown>> = [];

  const app = express();
  app.use(express.json());
  app.use(
    createAdminRoutes({
      airportRepository: {
        ...stubAirportRepository(),
        create: async (input) => {
          createdInputs.push(input as Record<string, unknown>);
          return 1;
        },
      },
      airportApplicationRepository: stubAirportApplicationRepository(),
      probeSampleRepository: {
        insertProbeSample: async () => 1,
        insertPacketLossSample: async () => 1,
        listProbeSamples: async () => [],
        listLatestProbeSamples: async () => [],
      },
      performanceRunRepository: {
        insert: async () => 1,
        getLatestByAirportAndDate: async () => null,
        getLatestByAirportBeforeDate: async () => null,
      },
      metricsRepository: stubMetricsRepository(),
      scoreRepository: {
        getByAirportAndDate: async () => null,
        getTrend: async () => [],
      },
      recomputeService: stubRecomputeService(),
      aggregationService: stubAggregationService(),
      manualJobService: stubManualJobService(),
      auditRepository: { log: async () => undefined },
      publicViewService: stubPublicViewService(),
    }),
  );

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/airports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Airport',
        website: 'https://example.com',
        websites: ['https://example.com'],
        status: 'normal',
        plan_price_month: 20,
        has_trial: true,
        tags: ['旧标签'],
        manual_tags: ['人工标签'],
      }),
    });

    assert.equal(response.status, 201);
    assert.equal(createdInputs.length, 1);
    assert.deepEqual(createdInputs[0].manual_tags, ['人工标签']);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

function stubAirportRepository() {
  return {
    listByQuery: async () => ({ items: [], total: 0 }),
    getById: async () => ({
      id: 1,
      name: 'Airport',
      website: 'https://example.com',
      websites: ['https://example.com'],
      status: 'normal',
      plan_price_month: 20,
      has_trial: true,
      subscription_url: 'https://sub.example.com',
      applicant_email: 'ops@example.com',
      applicant_telegram: '@ops',
      founded_on: '2025-01-01',
      airport_intro: 'intro',
      test_account: 'tester',
      test_password: 'secret',
      tags: ['老牌机场', '观察中'],
      manual_tags: ['老牌机场'],
      auto_tags: ['观察中'],
      created_at: '2026-03-20',
    }),
    create: async () => 1,
    update: async () => true,
  };
}

function stubAirportApplicationRepository() {
  return {
    listByQuery: async () => ({
      items: [
        {
          id: 7,
          name: 'Cloud Airport',
          website: 'https://example.com',
          websites: ['https://example.com', 'https://mirror.example.com'],
          status: 'normal',
          plan_price_month: 10,
          has_trial: true,
          subscription_url: 'https://example.com/sub',
          applicant_email: 'contact@example.com',
          applicant_telegram: '@cloud',
          founded_on: '2025-01-01',
          airport_intro: 'intro',
          test_account: 'tester',
          test_password: 'secret',
          approved_airport_id: null,
          review_status: 'pending',
          review_note: null,
          reviewed_by: null,
          reviewed_at: null,
          created_at: '2026-03-24 10:00:00',
          updated_at: '2026-03-24 10:00:00',
        },
      ],
      total: 1,
    }),
    getById: async (id: number) => ({
      id,
      name: 'Cloud Airport',
      website: 'https://example.com',
      websites: ['https://example.com', 'https://mirror.example.com'],
      status: 'normal',
      plan_price_month: 10,
      has_trial: true,
      subscription_url: 'https://example.com/sub',
      applicant_email: 'contact@example.com',
      applicant_telegram: '@cloud',
      founded_on: '2025-01-01',
      airport_intro: 'intro',
      test_account: 'tester',
      test_password: 'secret',
      approved_airport_id: null,
      review_status: 'pending',
      review_note: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: '2026-03-24 10:00:00',
      updated_at: '2026-03-24 10:00:00',
    }),
    review: async () => true,
  };
}

function stubMetricsRepository() {
  return {
    upsertDaily: async () => undefined,
    getByAirportAndDate: async () => null,
    getTrend: async () => [],
    patchComplaintCount: async () => undefined,
    patchIncidentCount: async () => undefined,
  };
}

function stubRecomputeService() {
  return {
    recomputeForDate: async () => ({ recomputed: 0 }),
    recomputeAirportForDate: async () => ({ recomputed: 0 }),
  };
}

function stubAggregationService() {
  return {
    aggregateForDate: async () => ({ aggregated: 0 }),
    aggregateAirportForDate: async () => ({ aggregated: 0 }),
  };
}

function stubManualJobService() {
  return {
    createJob: async () => ({
      id: 1,
      airport_id: 1,
      date: '2026-03-23',
      kind: 'full',
      status: 'queued',
      message: '任务已创建',
      created_by: 'tester',
      request_id: 'req-1',
      started_at: null,
      finished_at: null,
      created_at: '2026-03-23 10:00:00',
      updated_at: '2026-03-23 10:00:00',
    }),
    getJob: async () => null,
  };
}

function stubPublicViewService() {
  return {
    getHomePageView: async () => ({
      date: '2026-03-23',
      generated_at: '2026-03-23T10:00:00+08:00',
      hero: {
        report_time_at: '2026-03-23T10:00:00+08:00',
        report_time_text: '刚刚',
        monitored_airports: 1,
        realtime_tests: 1,
      },
      sections: {
        today_pick: { title: '今日推荐机场', subtitle: "Today's Top Pick", items: [] },
        most_stable: { title: '长期稳定机场', subtitle: 'Most Stable', items: [] },
        best_value: { title: '性价比最佳', subtitle: 'Best Value', items: [] },
        new_entries: { title: '新入榜潜力', subtitle: 'New Entries', items: [] },
        risk_alerts: { title: '风险预警', subtitle: 'Risk Alerts', items: [] },
      },
    }),
    getReportView: async () => null,
  };
}
