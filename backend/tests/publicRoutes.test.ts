import test from 'node:test';
import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import express from 'express';
import { errorHandler } from '../src/middleware/errorHandler';
import { createPublicRoutes } from '../src/routes/publicRoutes';
import type { MarketingEventInsertRecord } from '../src/utils/marketing';

test('POST /marketing/events stores validated marketing events', async () => {
  const insertedRecords: MarketingEventInsertRecord[] = [];
  const app = express();
  app.use(express.json());
  app.use(
    createPublicRoutes({
      airportRepository: {
        getById: async () => null,
      },
      airportApplicationRepository: {
        create: async () => 1,
      },
      metricsRepository: {
        getByAirportAndDate: async () => null,
      },
      scoreRepository: {
        getByAirportAndDate: async () => null,
        getTrend: async () => [],
      },
      rankingRepository: {
        getRanking: async () => [],
      },
      publicViewService: {
        getHomePageView: async () => ({}),
        getFullRankingView: async () => ({}),
        getRiskMonitorView: async () => ({}),
        getReportView: async () => null,
      } as any,
      marketingRepository: {
        insertMany: async (records) => {
          insertedRecords.push(...records);
        },
      },
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/marketing/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'user-agent': 'test-agent/1.0' },
      body: JSON.stringify({
        events: [
          {
            event_type: 'page_view',
            page_kind: 'home',
            page_path: '/',
            occurred_at: '2026-04-18T10:00:00.000Z',
            client_session_id: 'session-1',
            external_referrer_host: 'www.google.com',
            utm_source: 'google',
            utm_campaign: 'spring_launch',
          },
          {
            event_type: 'airport_impression',
            page_kind: 'home',
            page_path: '/',
            airport_id: 7,
            placement: 'home_card',
            occurred_at: '2026-04-18T10:00:01.000Z',
            client_session_id: 'session-1',
          },
          {
            event_type: 'outbound_click',
            page_kind: 'report',
            page_path: '/reports/7',
            airport_id: 7,
            placement: 'report_header',
            target_kind: 'website',
            target_url: 'https://airport.example.com',
            occurred_at: '2026-04-18T10:00:02.000Z',
            client_session_id: 'session-1',
          },
        ],
      }),
    });

    assert.equal(response.status, 201);
    assert.equal(insertedRecords.length, 3);
    assert.equal(insertedRecords[0]?.event_type, 'page_view');
    assert.equal(insertedRecords[1]?.placement, 'home_card');
    assert.equal(insertedRecords[2]?.target_kind, 'website');
    assert.equal(insertedRecords[0]?.event_date, '2026-04-18');
    assert.equal(insertedRecords[2]?.page_path, '/reports/7');
    assert.equal(insertedRecords[0]?.external_referrer_host, 'google.com');
    assert.equal(insertedRecords[0]?.source_type, 'google');
    assert.equal(insertedRecords[0]?.source_label, 'Google');
    assert.equal(insertedRecords[0]?.utm_campaign, 'spring_launch');
    assert.equal(insertedRecords[0]?.country_code, 'ZZ');
    assert.equal(insertedRecords[0]?.visitor_hash.length, 64);
    assert.equal(insertedRecords[0]?.session_hash.length, 64);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /marketing/events rejects invalid outbound click payload', async () => {
  const app = express();
  app.use(express.json());
  app.use(
    createPublicRoutes({
      airportRepository: {
        getById: async () => null,
      },
      airportApplicationRepository: {
        create: async () => 1,
      },
      metricsRepository: {
        getByAirportAndDate: async () => null,
      },
      scoreRepository: {
        getByAirportAndDate: async () => null,
        getTrend: async () => [],
      },
      rankingRepository: {
        getRanking: async () => [],
      },
      publicViewService: {
        getHomePageView: async () => ({}),
        getFullRankingView: async () => ({}),
        getRiskMonitorView: async () => ({}),
        getReportView: async () => null,
      } as any,
      marketingRepository: {
        insertMany: async () => undefined,
      },
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/marketing/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: [
          {
            event_type: 'outbound_click',
            page_kind: 'home',
            page_path: '/',
            airport_id: 7,
            placement: 'home_card',
            target_kind: 'website',
          },
        ],
      }),
    });

    assert.equal(response.status, 400);
    const data = (await response.json()) as { message: string };
    assert.match(data.message, /target_url/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /pages/home returns public homepage view', async () => {
  const app = express();
  app.use(
    createPublicRoutes({
      airportRepository: {
        getById: async () => null,
      },
      airportApplicationRepository: {
        create: async () => 1,
      },
      metricsRepository: {
        getByAirportAndDate: async () => null,
      },
      scoreRepository: {
        getByAirportAndDate: async () => null,
        getTrend: async () => [],
      },
      rankingRepository: {
        getRanking: async () => [],
      },
      publicViewService: {
        getHomePageView: async (date: string) => ({
          date,
          generated_at: '2026-03-23T10:00:00+08:00',
          hero: {
            report_time_at: '2026-03-23T08:00:00+08:00',
            report_time_text: '2 小时前',
            monitored_airports: 12,
            realtime_tests: 345,
          },
          sections: {
            today_pick: {
              title: '今日推荐机场',
              subtitle: "Today's Top Pick",
              items: [],
            },
            most_stable: {
              title: '长期稳定机场',
              subtitle: 'Most Stable',
              items: [],
            },
            best_value: {
              title: '性价比最佳',
              subtitle: 'Best Value',
              items: [],
            },
            new_entries: {
              title: '新入榜潜力',
              subtitle: 'New Entries',
              items: [],
            },
            risk_alerts: {
              title: '风险预警',
              subtitle: 'Risk Alerts',
              items: [],
            },
          },
        }),
        getFullRankingView: async () => ({
          date: '2026-03-23',
          generated_at: '2026-03-23T10:00:00+08:00',
          page: 1,
          page_size: 20,
          total: 0,
          total_pages: 1,
          items: [],
        }),
        getRiskMonitorView: async () => ({
          date: '2026-03-23',
          generated_at: '2026-03-23T10:00:00+08:00',
          page: 1,
          page_size: 20,
          total: 0,
          total_pages: 1,
          items: [],
        }),
        getReportView: async () => null,
      } as any,
    }),
  );
  app.use(errorHandler);
  app.use(errorHandler);
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/pages/home?date=2026-03-23`);
    assert.equal(response.status, 200);
    const data = (await response.json()) as {
      hero: { monitored_airports: number; report_time_at: string | null };
      sections: Record<string, unknown>;
    };
    assert.equal(data.hero.monitored_airports, 12);
    assert.equal(data.hero.report_time_at, '2026-03-23T08:00:00+08:00');
    assert.ok(data.sections.today_pick);
    assert.ok(data.sections.risk_alerts);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /pages/home reuses cached response within ttl', async () => {
  let homeCalls = 0;
  const app = express();
  app.use(
    createPublicRoutes({
      airportRepository: {
        getById: async () => null,
      },
      airportApplicationRepository: {
        create: async () => 1,
      },
      metricsRepository: {
        getByAirportAndDate: async () => null,
      },
      scoreRepository: {
        getByAirportAndDate: async () => null,
        getTrend: async () => [],
      },
      rankingRepository: {
        getRanking: async () => [],
      },
      publicViewService: {
        getHomePageView: async (date: string) => {
          homeCalls += 1;
          return {
            date,
            generated_at: '2026-03-23T10:00:00+08:00',
            hero: {
              report_time_at: '2026-03-23T08:00:00+08:00',
              report_time_text: '2 小时前',
              monitored_airports: 12,
              realtime_tests: 345,
            },
            sections: {
              today_pick: { title: '今日推荐机场', subtitle: "Today's Top Pick", items: [] },
              most_stable: { title: '长期稳定机场', subtitle: 'Most Stable', items: [] },
              best_value: { title: '性价比最佳', subtitle: 'Best Value', items: [] },
              new_entries: { title: '新入榜潜力', subtitle: 'New Entries', items: [] },
              risk_alerts: { title: '风险预警', subtitle: 'Risk Alerts', items: [] },
            },
          };
        },
        getFullRankingView: async () => {
          throw new Error('not used');
        },
        getRiskMonitorView: async () => {
          throw new Error('not used');
        },
        getReportView: async () => null,
      } as any,
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const [first, second] = await Promise.all([
      fetch(`http://127.0.0.1:${port}/pages/home?date=2026-03-23`),
      fetch(`http://127.0.0.1:${port}/pages/home?date=2026-03-23`),
    ]);

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(homeCalls, 1);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /airports/:id/report-view returns report view payload', async () => {
  const app = express();
  app.use(
    createPublicRoutes({
      airportRepository: {
        getById: async () => ({ id: 1 }),
      },
      airportApplicationRepository: {
        create: async () => 1,
      },
      metricsRepository: {
        getByAirportAndDate: async () => ({ airport_id: 1 }),
      },
      scoreRepository: {
        getByAirportAndDate: async () => ({ airport_id: 1 }),
        getTrend: async () => [],
      },
      rankingRepository: {
        getRanking: async () => [],
      },
      publicViewService: {
        getHomePageView: async () => {
          throw new Error('not used');
        },
        getFullRankingView: async () => {
          throw new Error('not used');
        },
        getRiskMonitorView: async () => {
          throw new Error('not used');
        },
        getReportView: async () => ({
          date: '2026-03-23',
          airport: {
            id: 1,
            name: '大象网络',
            website: 'https://example.com',
            status: 'normal',
            tags: ['长期稳定'],
          },
          summary_card: {
            type: 'stable',
            name: '大象网络',
            tags: ['长期稳定'],
            score: 95,
            details: [
              { label: '稳定记录', value: '455 天' },
              { label: '最近30天', value: '0 波动' },
            ],
            conclusion: '整体最均衡',
          },
          ranking: {
            today_pick_rank: 1,
            most_stable_rank: 1,
            best_value_rank: null,
            new_entries_rank: null,
            risk_alerts_rank: null,
          },
          score_breakdown: {
            s: 94.2,
            p: 91.7,
            c: 88.4,
            r: 96,
            final_score: 95.1,
            risk_penalty: 4,
            domain_penalty: 0,
            ssl_penalty: 4,
            complaint_penalty: 0,
            history_penalty: 0,
          },
          metrics: {
            uptime_percent_30d: 99.98,
            median_latency_ms: 34,
            median_download_mbps: 812,
            packet_loss_percent: 0.1,
            stable_days_streak: 455,
            recent_complaints_count: 0,
            history_incidents: 0,
          },
          trends: {
            score_30d: [],
            uptime_30d: [],
            latency_30d: [],
            download_30d: [],
          },
        }),
      } as any,
    }),
  );
  app.use(errorHandler);
  app.use(errorHandler);
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/airports/1/report-view?date=2026-03-23`);
    assert.equal(response.status, 200);
    const data = (await response.json()) as { summary_card: { score: number }; ranking: { today_pick_rank: number } };
    assert.equal(data.summary_card.score, 95);
    assert.equal(data.ranking.today_pick_rank, 1);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /pages/full-ranking returns paged full ranking payload', async () => {
  const app = express();
  app.use(
    createPublicRoutes({
      airportRepository: {
        getById: async () => null,
      },
      airportApplicationRepository: {
        create: async () => 1,
      },
      metricsRepository: {
        getByAirportAndDate: async () => null,
      },
      scoreRepository: {
        getByAirportAndDate: async () => null,
        getTrend: async () => [],
      },
      rankingRepository: {
        getRanking: async () => [],
      },
      publicViewService: {
        getHomePageView: async () => {
          throw new Error('not used');
        },
        getFullRankingView: async (date: string, page: number, pageSize: number) => ({
          date,
          generated_at: '2026-03-23T10:00:00+08:00',
          page,
          page_size: pageSize,
          total: 35,
          total_pages: 2,
          items: [
            {
              airport_id: 1,
              rank: 21,
              name: 'Cloud Airport',
              website: 'https://example.com',
              status: 'normal',
              tags: ['稳定'],
              founded_on: '2025-01-01',
              plan_price_month: 12.5,
              has_trial: true,
              airport_intro: 'Fast and stable.',
              created_at: '2026-01-01',
              score: 88.6,
              score_delta_vs_yesterday: {
                label: '对比昨天',
                value: 1.2,
              },
              report_url: '/reports/1?date=2026-03-23',
            },
          ],
        }),
        getRiskMonitorView: async () => {
          throw new Error('not used');
        },
        getReportView: async () => null,
      } as any,
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/pages/full-ranking?date=2026-03-23&page=2`);
    assert.equal(response.status, 200);
    const data = (await response.json()) as {
      page: number;
      page_size: number;
      total: number;
      total_pages: number;
      items: Array<{ rank: number; score: number; score_delta_vs_yesterday: { label: string; value: number | null } }>;
    };
    assert.equal(data.page, 2);
    assert.equal(data.page_size, 20);
    assert.equal(data.total, 35);
    assert.equal(data.total_pages, 2);
    assert.equal(data.items[0].rank, 21);
    assert.equal(data.items[0].score, 88.6);
    assert.deepEqual(data.items[0].score_delta_vs_yesterday, {
      label: '对比昨天',
      value: 1.2,
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /pages/full-ranking reuses cached response within ttl', async () => {
  let fullRankingCalls = 0;
  const app = express();
  app.use(
    createPublicRoutes({
      airportRepository: {
        getById: async () => null,
      },
      airportApplicationRepository: {
        create: async () => 1,
      },
      metricsRepository: {
        getByAirportAndDate: async () => null,
      },
      scoreRepository: {
        getByAirportAndDate: async () => null,
        getTrend: async () => [],
      },
      rankingRepository: {
        getRanking: async () => [],
      },
      publicViewService: {
        getHomePageView: async () => {
          throw new Error('not used');
        },
        getFullRankingView: async (date: string, page: number, pageSize: number) => {
          fullRankingCalls += 1;
          return {
            date,
            generated_at: '2026-03-23T10:00:00+08:00',
            page,
            page_size: pageSize,
            total: 35,
            total_pages: 2,
            items: [],
          };
        },
        getRiskMonitorView: async () => {
          throw new Error('not used');
        },
        getReportView: async () => null,
      } as any,
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const [first, second] = await Promise.all([
      fetch(`http://127.0.0.1:${port}/pages/full-ranking?date=2026-03-23&page=2`),
      fetch(`http://127.0.0.1:${port}/pages/full-ranking?date=2026-03-23&page=2`),
    ]);

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(fullRankingCalls, 1);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /pages/risk-monitor returns paged risk monitor payload', async () => {
  const app = express();
  app.use(
    createPublicRoutes({
      airportRepository: {
        getById: async () => null,
      },
      airportApplicationRepository: {
        create: async () => 1,
      },
      metricsRepository: {
        getByAirportAndDate: async () => null,
      },
      scoreRepository: {
        getByAirportAndDate: async () => null,
        getTrend: async () => [],
      },
      rankingRepository: {
        getRanking: async () => [],
      },
      publicViewService: {
        getHomePageView: async () => {
          throw new Error('not used');
        },
        getFullRankingView: async () => {
          throw new Error('not used');
        },
        getRiskMonitorView: async (date: string, page: number, pageSize: number) => ({
          date,
          generated_at: '2026-03-23T10:00:00+08:00',
          page,
          page_size: pageSize,
          total: 2,
          total_pages: 1,
          items: [
            {
              airport_id: 7,
              rank: 1,
              name: 'Broken Airport',
              website: 'https://broken.example.com',
              status: 'down',
              tags: ['不推荐'],
              founded_on: '2025-01-01',
              plan_price_month: 15,
              has_trial: false,
              airport_intro: 'Down',
              created_at: '2026-01-01',
              score: 12.3,
              score_delta_vs_yesterday: {
                label: '对比昨天',
                value: -5,
              },
              score_date: '2026-03-22',
              report_url: '/reports/7?date=2026-03-22',
              monitor_reason: 'down',
              risk_penalty: 88,
              risk_reasons: [],
              risk_reason_summary: '该机场已由管理员确认标记为跑路状态，已停止日常测评与调度采样。',
              snapshot_is_stale: true,
            },
          ],
        }),
        getReportView: async () => null,
      } as any,
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/pages/risk-monitor?date=2026-03-23&page=1`);
    assert.equal(response.status, 200);
    const data = (await response.json()) as {
      page: number;
      page_size: number;
      total: number;
      items: Array<{
        monitor_reason: string;
        risk_penalty: number | null;
        risk_reason_summary: string;
        snapshot_is_stale: boolean;
      }>;
    };
    assert.equal(data.page, 1);
    assert.equal(data.page_size, 20);
    assert.equal(data.total, 2);
    assert.equal(data.items[0]?.monitor_reason, 'down');
    assert.equal(data.items[0]?.snapshot_is_stale, true);
    assert.match(data.items[0]?.risk_reason_summary || '', /管理员确认/);
    assert.equal(data.items[0]?.risk_penalty, 88);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /airport-applications accepts complete submission payload', async () => {
  const created: Array<Record<string, unknown>> = [];
  const notified: Array<Record<string, unknown>> = [];
  const createdAccounts: Array<Record<string, unknown>> = [];
  const app = express();
  app.use(express.json());
  app.use(
    createPublicRoutes({
      airportRepository: {
        getById: async () => null,
      },
      airportApplicationRepository: {
        create: async (input) => {
          created.push(input as Record<string, unknown>);
          return 88;
        },
        hasBlockingEmail: async () => false,
      },
      applicantAccountRepository: {
        create: async (input) => {
          createdAccounts.push(input as Record<string, unknown>);
          return 9;
        },
      },
      applicationNotificationService: {
        notifyNewAirportApplication: async (input) => {
          notified.push(input as Record<string, unknown>);
        },
      },
      metricsRepository: {
        getByAirportAndDate: async () => null,
      },
      scoreRepository: {
        getByAirportAndDate: async () => null,
        getTrend: async () => [],
      },
      rankingRepository: {
        getRanking: async () => [],
      },
      publicViewService: {
        getHomePageView: async () => null,
        getFullRankingView: async () => null,
        getRiskMonitorView: async () => null,
        getReportView: async () => null,
      } as any,
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/airport-applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        name: 'Cloud Airport',
        website: 'https://example.com',
        websites: ['https://example.com', 'https://mirror.example.com'],
        status: 'normal',
        plan_price_month: 12.5,
        has_trial: true,
        subscription_url: 'https://example.com/sub',
        applicant_email: 'contact@example.com',
        applicant_telegram: '@cloud',
        founded_on: '2025-01-01',
        airport_intro: 'Fast routes.',
        test_account: 'tester',
        test_password: 'secret',
      }),
    });

    assert.equal(response.status, 201);
    const data = (await response.json()) as {
      application_id: number;
      review_status: string;
      portal_email: string;
      initial_password: string;
      portal_login_url: string;
    };
    assert.equal(data.application_id, 88);
    assert.equal(data.review_status, 'awaiting_payment');
    assert.equal(data.portal_email, 'contact@example.com');
    assert.equal(typeof data.initial_password, 'string');
    assert.ok(data.initial_password.length >= 8);
    assert.equal(data.portal_login_url, 'http://localhost:3000/portal');
    assert.equal(created.length, 1);
    assert.equal(createdAccounts.length, 1);
    assert.equal(createdAccounts[0].application_id, 88);
    assert.equal(createdAccounts[0].email, 'contact@example.com');
    assert.deepEqual(created[0].websites, ['https://example.com', 'https://mirror.example.com']);
    assert.equal(notified.length, 1);
    assert.equal(notified[0].applicationId, 88);
    assert.equal(notified[0].name, 'Cloud Airport');
    assert.equal(notified[0].applicantTelegram, '@cloud');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /airport-applications still succeeds when telegram notification fails', async () => {
  const app = express();
  app.use(express.json());
  app.use(
    createPublicRoutes({
      airportRepository: {
        getById: async () => null,
      },
      airportApplicationRepository: {
        create: async () => 89,
        hasBlockingEmail: async () => false,
      },
      applicantAccountRepository: {
        create: async () => 1,
      },
      applicationNotificationService: {
        notifyNewAirportApplication: async () => {
          throw new Error('telegram unavailable');
        },
      },
      metricsRepository: {
        getByAirportAndDate: async () => null,
      },
      scoreRepository: {
        getByAirportAndDate: async () => null,
        getTrend: async () => [],
      },
      rankingRepository: {
        getRanking: async () => [],
      },
      publicViewService: {
        getHomePageView: async () => null,
        getFullRankingView: async () => null,
        getRiskMonitorView: async () => null,
        getReportView: async () => null,
      } as any,
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/airport-applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Cloud Airport',
        website: 'https://example.com',
        websites: ['https://example.com'],
        status: 'normal',
        plan_price_month: 12.5,
        has_trial: true,
        subscription_url: 'https://example.com/sub',
        applicant_email: 'contact@example.com',
        applicant_telegram: '@cloud',
        founded_on: '2025-01-01',
        airport_intro: 'Fast routes.',
        test_account: 'tester',
        test_password: 'secret',
      }),
    });

    assert.equal(response.status, 201);
    const data = (await response.json()) as { application_id: number; review_status: string };
    assert.equal(data.application_id, 89);
    assert.equal(data.review_status, 'awaiting_payment');
  } finally {
    console.error = originalConsoleError;
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /airport-applications rejects missing required application fields', async () => {
  const app = express();
  app.use(express.json());
  app.use(
    createPublicRoutes({
      airportRepository: {
        getById: async () => null,
      },
      airportApplicationRepository: {
        create: async () => 1,
      },
      metricsRepository: {
        getByAirportAndDate: async () => null,
      },
      scoreRepository: {
        getByAirportAndDate: async () => null,
        getTrend: async () => [],
      },
      rankingRepository: {
        getRanking: async () => [],
      },
      publicViewService: {
        getHomePageView: async () => null,
        getFullRankingView: async () => null,
        getReportView: async () => null,
      } as any,
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/airport-applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Cloud Airport',
        websites: ['https://example.com'],
        status: 'normal',
        plan_price_month: 12.5,
        has_trial: true,
        applicant_email: 'bad-email',
        applicant_telegram: '',
        founded_on: '2027-01-01',
        airport_intro: '',
        test_account: '',
        test_password: '',
      }),
    });

    assert.equal(response.status, 400);
    const data = (await response.json()) as { code: string };
    assert.equal(data.code, 'BAD_REQUEST');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
