import test from 'node:test';
import assert from 'node:assert/strict';
import { ScoreRepository } from '../src/repositories/scoreRepository';

test('ScoreRepository reads details_json when mysql returns object values', async () => {
  const repository = new ScoreRepository({
    query: async () => [[
      {
        airport_id: 1,
        date: new Date('2026-03-22T00:00:00.000Z'),
        score_s: 60,
        score_p: 20,
        score_c: 80,
        score_r: 90,
        risk_penalty: 10,
        score: 55,
        recent_score: 55,
        historical_score: 50,
        final_score: 53.5,
        details_json: {
          latency_score: 0,
          speed_score: 0,
          loss_score: 100,
        },
      },
    ]],
  } as never);

  const score = await repository.getByAirportAndDate(1, '2026-03-22');
  assert.ok(score);
  assert.equal(score.date, '2026-03-22');
  assert.deepEqual(score.details, {
    latency_score: 0,
    speed_score: 0,
    loss_score: 100,
  });
});

test('ScoreRepository.getPublicFullRankingByDate returns filtered paged ranking items', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const repository = new ScoreRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('COUNT(*) AS total')) {
        return [[{ total: 25 }]];
      }
      if (sql.includes('WHERE date = ?') && sql.includes('airport_id IN')) {
        return [[
          {
            airport_id: 2,
            display_score: 91.1,
          },
        ]];
      }
      return [[
        {
          airport_id: 2,
          name: 'Alpha',
          website: 'https://alpha.example.com',
          status: 'risk',
          tags_json: '["稳定","热门"]',
          founded_on: new Date('2024-01-10T00:00:00.000Z'),
          plan_price_month: 15,
          has_trial: 1,
          airport_intro: 'Intro',
          created_at: new Date('2025-02-01T00:00:00.000Z'),
          score_date: new Date('2026-03-24T00:00:00.000Z'),
          display_score: 93.2,
        },
      ]];
    },
  } as never);

  const result = await repository.getPublicFullRankingByDate('2026-03-24', 2, 20);
  assert.equal(result.total, 25);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].rank, 21);
  assert.equal(result.items[0].status, 'risk');
  assert.equal(result.items[0].score, 93.2);
  assert.deepEqual(result.items[0].score_delta_vs_yesterday, {
    label: '对比昨天',
    value: 2.1,
  });
  assert.equal(result.items[0].report_url, '/reports/2?date=2026-03-24');
  assert.equal(result.items[0].score_date, '2026-03-24');
  assert.deepEqual(result.items[0].tags, ['稳定', '热门']);
  assert.ok(calls.some((call) => call.sql.includes("a.status IN ('normal', 'risk')")));
  assert.ok(calls.some((call) => call.sql.includes("CASE WHEN s.date IS NULL THEN 1 ELSE 0 END ASC")));
  assert.ok(calls.some((call) => call.sql.includes('LEFT JOIN (')));
  assert.ok(calls.some((call) => call.sql.includes('MAX(date) AS score_date')));
  assert.ok(calls.some((call) => call.sql.includes('latest_score.airport_id = a.id')));
});

test('ScoreRepository.getPublicFullRankingByDate keeps airports without scores', async () => {
  const repository = new ScoreRepository({
    query: async (sql: string) => {
      if (sql.includes('COUNT(*) AS total')) {
        return [[{ total: 6 }]];
      }
      if (sql.includes('WHERE date = ?') && sql.includes('airport_id IN')) {
        return [[]];
      }
      return [[
        {
          airport_id: 10,
          name: 'No Score Airport',
          website: 'https://noscore.example.com',
          status: 'normal',
          tags_json: '[]',
          founded_on: null,
          plan_price_month: 20,
          has_trial: 0,
          airport_intro: null,
          created_at: new Date('2025-02-01T00:00:00.000Z'),
          score_date: null,
          display_score: null,
        },
      ]];
    },
  } as never);

  const result = await repository.getPublicFullRankingByDate('2026-03-25', 1, 20);
  assert.equal(result.total, 6);
  assert.equal(result.items[0].airport_id, 10);
  assert.equal(result.items[0].score, null);
  assert.deepEqual(result.items[0].score_delta_vs_yesterday, {
    label: '对比昨天',
    value: null,
  });
  assert.equal(result.items[0].score_date, null);
  assert.equal(result.items[0].report_url, null);
});

test('ScoreRepository.getPublicDisplayScoreByAirportAndDate prefers manual total score', async () => {
  const calls: string[] = [];
  const repository = new ScoreRepository({
    query: async (sql: string) => {
      calls.push(sql);
      return [[
        {
          airport_id: 7,
          display_score: 96.2,
        },
      ]];
    },
  } as never);

  const score = await repository.getPublicDisplayScoreByAirportAndDate(7, '2026-03-24');
  assert.equal(score, 96.2);
  assert.match(calls[0], /manual_total_score/);
  assert.ok(calls[0].indexOf('manual_total_score') < calls[0].indexOf('total_score'));
});

test('ScoreRepository.getPublicDisplayScoreByAirportAndDate returns null when date is missing', async () => {
  const repository = new ScoreRepository({
    query: async () => [[]],
  } as never);

  const score = await repository.getPublicDisplayScoreByAirportAndDate(7, '2026-03-24');
  assert.equal(score, null);
});

test('ScoreRepository.upsertDaily preserves existing manual total score on duplicate update', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const repository = new ScoreRepository({
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return [{ affectedRows: 1 }];
    },
  } as never);

  await repository.upsertDaily(7, '2026-03-24', {
    s: 80,
    p: 70,
    c: 88,
    r: 90,
    risk_penalty: 10,
    score: 78,
    recent_score: 78,
    historical_score: 76,
    final_score: 77.5,
    details: { total_score: 77.5 },
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /JSON_EXTRACT\(details_json, '\$\.manual_total_score'\)/);
  assert.match(calls[0].sql, /JSON_SET\(/);
  assert.equal(calls[0].params?.[0], 7);
  assert.equal(calls[0].params?.[1], '2026-03-24');
});

test('ScoreRepository.updateManualTotalScore saves and clears manual total score', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const repository = new ScoreRepository({
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return [{ affectedRows: 1 }];
    },
  } as never);

  assert.equal(await repository.updateManualTotalScore(7, '2026-03-24', 88.66), true);
  assert.equal(await repository.updateManualTotalScore(7, '2026-03-24', null), true);

  assert.match(calls[0].sql, /JSON_SET/);
  assert.deepEqual(calls[0].params, [88.66, 7, '2026-03-24']);
  assert.match(calls[1].sql, /JSON_REMOVE/);
  assert.deepEqual(calls[1].params, [7, '2026-03-24']);
});
