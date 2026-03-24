import test from 'node:test';
import assert from 'node:assert/strict';
import type { Airport, DailyMetrics, ScoreBreakdown } from '../src/types/domain';
import { RecomputeService } from '../src/services/recomputeService';

test('recomputeForDate computes scores and replaces rankings idempotently', async () => {
  const airports: Airport[] = [
    {
      id: 1,
      name: 'A',
      website: 'https://a.example.com',
      status: 'normal',
      plan_price_month: 20,
      has_trial: true,
      tags: [],
      created_at: '2026-03-10',
    },
    {
      id: 2,
      name: 'B',
      website: 'https://b.example.com',
      status: 'risk',
      plan_price_month: 50,
      has_trial: false,
      tags: [],
      created_at: '2026-03-21',
    },
  ];

  const metrics: DailyMetrics[] = [
    {
      airport_id: 1,
      date: '2026-03-22',
      uptime_percent_30d: 99.9,
      median_latency_ms: 70,
      median_download_mbps: 300,
      packet_loss_percent: 0.1,
      stable_days_streak: 50,
      domain_ok: true,
      ssl_days_left: 90,
      recent_complaints_count: 0,
      history_incidents: 0,
    },
    {
      airport_id: 2,
      date: '2026-03-22',
      uptime_percent_30d: 96,
      median_latency_ms: 220,
      median_download_mbps: 80,
      packet_loss_percent: 1.5,
      stable_days_streak: 6,
      domain_ok: true,
      ssl_days_left: 12,
      recent_complaints_count: 3,
      history_incidents: 1,
    },
  ];

  const storedScores = new Map<string, ScoreBreakdown>();
  const replaced = new Map<string, number>();
  const storedTags = new Map<number, string[]>();

  const svc = new RecomputeService({
    airportRepository: {
      listAll: async () => airports,
      getById: async (airportId: number) => airports.find((airport) => airport.id === airportId) || null,
      setTags: async (airportId: number, tags: string[]) => {
        storedTags.set(airportId, tags);
      },
    },
    metricsRepository: {
      getByDate: async () => metrics,
      getByAirportAndDate: async (airportId: number, date: string) =>
        metrics.find((item) => item.airport_id === airportId && item.date === date) || null,
    },
    scoreRepository: {
      getTimeSeriesBeforeDate: async (airportId: number) =>
        airportId === 1
          ? [
              { date: '2026-03-20', score: 90 },
              { date: '2026-03-21', score: 95 },
            ]
          : [
              { date: '2026-03-20', score: 72 },
              { date: '2026-03-21', score: 68 },
            ],
      getTrend: async (airportId: number, _startDate: string, endDate: string) =>
        airportId === 1
          ? [
              { airport_id: 1, date: '2026-03-20', s: 80, p: 70, c: 60, r: 90, risk_penalty: 10, score: 77, recent_score: 77, historical_score: 0, final_score: 77, details: {} },
              { airport_id: 1, date: '2026-03-21', s: 85, p: 72, c: 62, r: 88, risk_penalty: 12, score: 79, recent_score: 79, historical_score: 0, final_score: 79, details: {} },
              endDate === '2026-03-22'
                ? { airport_id: 1, date: '2026-03-22', s: 100, p: 100, c: 100, r: 100, risk_penalty: 0, score: 82.74, recent_score: 82.74, historical_score: 92.62, final_score: 89, details: {} }
                : { airport_id: 1, date: endDate, s: 100, p: 100, c: 100, r: 100, risk_penalty: 0, score: 82.74, recent_score: 82.74, historical_score: 92.62, final_score: 89, details: {} },
            ]
          : [
              { airport_id: 2, date: '2026-03-20', s: 60, p: 50, c: 55, r: 65, risk_penalty: 35, score: 57, recent_score: 57, historical_score: 0, final_score: 57, details: {} },
              { airport_id: 2, date: '2026-03-21', s: 58, p: 52, c: 54, r: 63, risk_penalty: 37, score: 56, recent_score: 56, historical_score: 0, final_score: 56, details: {} },
              { airport_id: 2, date: endDate, s: 55, p: 48, c: 53, r: 61, risk_penalty: 39, score: 54, recent_score: 54, historical_score: 69.9, final_score: 60, details: {} },
            ],
      getByDate: async (date: string) =>
        Array.from(storedScores.entries())
          .filter(([key]) => key.endsWith(`:${date}`))
          .map(([key, value]) => ({
            airport_id: Number(key.split(':')[0]),
            date,
            s: value.s,
            p: value.p,
            c: value.c,
            r: value.r,
            risk_penalty: value.risk_penalty,
            score: value.score,
            recent_score: value.recent_score ?? value.score,
            historical_score: value.historical_score ?? 0,
            final_score: value.final_score ?? value.score,
            details: value.details,
          })),
      upsertDaily: async (airportId: number, date: string, score: ScoreBreakdown) => {
        storedScores.set(`${airportId}:${date}`, score);
      },
    },
    rankingRepository: {
      replaceForDate: async (_date, listType, rows) => {
        replaced.set(listType, rows.length);
      },
    },
  });

  const out1 = await svc.recomputeForDate('2026-03-22');
  const out2 = await svc.recomputeForDate('2026-03-22');

  assert.equal(out1.recomputed, 2);
  assert.equal(out2.recomputed, 2);
  assert.equal(storedScores.size, 2);
  assert.equal(storedTags.size, 2);
  assert.ok((storedTags.get(1) || []).includes('新手友好'));
  assert.ok((storedTags.get(2) || []).includes('风险观察'));
  assert.equal(replaced.size, 5);
  assert.ok((replaced.get('today') || 0) >= 1);
  assert.equal(storedScores.get('1:2026-03-22')?.historical_score, 92.62);
  assert.equal(storedScores.get('1:2026-03-22')?.final_score, 89);
  assert.equal(storedScores.get('1:2026-03-22')?.details.total_score, 37.28);
});

test('recomputeAirportForDate only updates target airport and rebuilds rankings', async () => {
  const airports: Airport[] = [
    {
      id: 1,
      name: 'A',
      website: 'https://a.example.com',
      status: 'normal',
      plan_price_month: 20,
      has_trial: true,
      tags: [],
      created_at: '2026-03-10',
    },
    {
      id: 2,
      name: 'B',
      website: 'https://b.example.com',
      status: 'normal',
      plan_price_month: 30,
      has_trial: false,
      tags: [],
      created_at: '2026-03-10',
    },
  ];

  const metrics: DailyMetrics[] = [
    {
      airport_id: 1,
      date: '2026-03-23',
      uptime_percent_30d: 99.5,
      median_latency_ms: 80,
      median_download_mbps: 120,
      packet_loss_percent: 0.2,
      stable_days_streak: 12,
      domain_ok: true,
      ssl_days_left: 60,
      recent_complaints_count: 0,
      history_incidents: 0,
    },
    {
      airport_id: 2,
      date: '2026-03-23',
      uptime_percent_30d: 97.5,
      median_latency_ms: 150,
      median_download_mbps: 90,
      packet_loss_percent: 0.8,
      stable_days_streak: 4,
      domain_ok: true,
      ssl_days_left: 20,
      recent_complaints_count: 1,
      history_incidents: 0,
    },
  ];

  const storedScores = new Map<string, ScoreBreakdown>([
    ['2:2026-03-23', {
      s: 70,
      p: 65,
      c: 70,
      r: 90,
      risk_penalty: 10,
      score: 72,
      recent_score: 72,
      historical_score: 68,
      final_score: 70,
      details: {},
    }],
  ]);
  const replaced = new Map<string, number>();
  const storedTags = new Map<number, string[]>();

  const svc = new RecomputeService({
    airportRepository: {
      listAll: async () => airports,
      getById: async (airportId: number) => airports.find((airport) => airport.id === airportId) || null,
      setTags: async (airportId: number, tags: string[]) => {
        storedTags.set(airportId, tags);
      },
    },
    metricsRepository: {
      getByDate: async () => metrics,
      getByAirportAndDate: async (airportId: number, date: string) =>
        metrics.find((item) => item.airport_id === airportId && item.date === date) || null,
    },
    scoreRepository: {
      getTimeSeriesBeforeDate: async () => [
        { date: '2026-03-21', score: 75 },
        { date: '2026-03-22', score: 78 },
      ],
      getTrend: async (airportId: number, _startDate: string, endDate: string) =>
        airportId === 1
          ? [
              { airport_id: 1, date: '2026-03-21', s: 74, p: 70, c: 80, r: 95, risk_penalty: 5, score: 76, recent_score: 76, historical_score: 0, final_score: 76, details: {} },
              { airport_id: 1, date: '2026-03-22', s: 78, p: 72, c: 80, r: 95, risk_penalty: 5, score: 79, recent_score: 79, historical_score: 0, final_score: 79, details: {} },
              { airport_id: 1, date: endDate, s: 82, p: 75, c: 80, r: 95, risk_penalty: 5, score: 81, recent_score: 81, historical_score: 77, final_score: 79, details: {} },
            ]
          : [
              { airport_id: 2, date: '2026-03-21', s: 68, p: 64, c: 70, r: 90, risk_penalty: 10, score: 71, recent_score: 71, historical_score: 0, final_score: 71, details: {} },
              { airport_id: 2, date: '2026-03-22', s: 69, p: 65, c: 70, r: 90, risk_penalty: 10, score: 72, recent_score: 72, historical_score: 0, final_score: 72, details: {} },
              { airport_id: 2, date: endDate, s: 70, p: 65, c: 70, r: 90, risk_penalty: 10, score: 72, recent_score: 72, historical_score: 68, final_score: 70, details: {} },
            ],
      getByDate: async (date: string) =>
        Array.from(storedScores.entries())
          .filter(([key]) => key.endsWith(`:${date}`))
          .map(([key, value]) => ({
            airport_id: Number(key.split(':')[0]),
            date,
            s: value.s,
            p: value.p,
            c: value.c,
            r: value.r,
            risk_penalty: value.risk_penalty,
            score: value.score,
            recent_score: value.recent_score ?? value.score,
            historical_score: value.historical_score ?? 0,
            final_score: value.final_score ?? value.score,
            details: value.details,
          })),
      upsertDaily: async (airportId: number, date: string, score: ScoreBreakdown) => {
        storedScores.set(`${airportId}:${date}`, score);
      },
    },
    rankingRepository: {
      replaceForDate: async (_date, listType, rows) => {
        replaced.set(listType, rows.length);
      },
    },
  });

  const result = await svc.recomputeAirportForDate('2026-03-23', 1);

  assert.equal(result.recomputed, 1);
  assert.ok(storedScores.has('1:2026-03-23'));
  assert.ok(storedScores.has('2:2026-03-23'));
  assert.equal(storedTags.has(1), true);
  assert.equal(storedTags.has(2), false);
  assert.equal(replaced.size, 5);
});
