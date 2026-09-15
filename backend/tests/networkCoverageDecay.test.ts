import test from 'node:test';
import assert from 'node:assert/strict';
import { ScoreRepository } from '../src/repositories/scoreRepository';
import { RecomputeService } from '../src/services/recomputeService';
import { publicScoreSummary } from '../src/services/scoreComponents';
import type { Airport, AirportScoreDaily, DailyMetrics, NetworkCoverageRun, ScoreBreakdown } from '../src/types/domain';

const date = '2026-09-15';
const dates = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 7, 17 + i)).toISOString().slice(0, 10));
const raw = (n = 60): ScoreBreakdown => ({
  s: 90, p: 90, n, c: 100, r: 90, risk_penalty: 10,
  score: 85, recent_score: 85, historical_score: 91, final_score: 85,
  details: { score_rule_version: 'v2_spncr' },
});
const history = (): AirportScoreDaily[] => dates.map((day) => ({
  ...raw(90), airport_id: 1, date: day,
  // Deliberately different from the observation: neither value belongs in the N series.
  details: { score_rule_version: 'v2_spncr', automatic_score_n: 10, manual_score_n: 0 },
}));

test('score transaction preserves raw N, avoids repeated decay and applies manual N after smoothing', async () => {
  const rows = history().map((row) => ({
    airport_id: row.airport_id, date: row.date,
    score_s: row.s, score_p: row.p, score_n: row.n, score_c: row.c, score_r: row.r,
    risk_penalty: row.risk_penalty, score: row.score, recent_score: row.recent_score,
    historical_score: row.historical_score, final_score: row.final_score,
    details_json: row.date === date ? { score_rule_version: 'v2_spncr' } : row.details,
  }));
  const connection = {
    beginTransaction: async () => undefined, commit: async () => undefined,
    rollback: async () => undefined, release: () => undefined,
    query: async (sql: string) => {
      if (sql.includes('SELECT id FROM airports')) return [[{ id: 1 }]];
      if (sql.includes('SELECT plan_price_month')) return [[{ plan_price_month: 20, created_at: dates[0] }]];
      if (sql.includes('FROM airport_scores_daily')) return [structuredClone(rows)];
      throw new Error(`unexpected query: ${sql}`);
    },
    execute: async (sql: string, params: unknown[]) => {
      const current = rows.at(-1)!;
      if (sql.includes('INSERT INTO airport_scores_daily')) {
        current.score_n = Number(params[4]);
        current.details_json = JSON.parse(String(params[12]));
      } else if (sql.startsWith('UPDATE airport_scores_daily SET details_json')) {
        current.details_json = JSON.parse(String(params[0]));
      } else throw new Error(`unexpected write: ${sql}`);
      return [{ affectedRows: 1 }];
    },
  };
  const repository = new ScoreRepository({ getConnection: async () => connection } as never);
  const score = raw();
  await repository.upsertDaily(1, date, score);
  assert.equal(score.n, 60);
  assert.equal(rows.at(-1)!.score_n, 60);
  assert.equal(score.details.automatic_score_n, 87);
  assert.equal(score.details.total_score, 90.4);
  await repository.upsertDaily(1, date, score);
  assert.equal(score.details.automatic_score_n, 87);
  assert.equal(score.details.total_score, 90.4);
  assert.equal(rows.length, 30);
  const summary = publicScoreSummary(score) as ScoreBreakdown;
  assert.equal(summary.n, 87);
  assert.equal(summary.final_score, 90.4);
  const edited = await repository.updateManualComponents(1, date, { n: 80 });
  assert.equal(edited.after.automatic.n, 87);
  assert.equal(edited.after.effective.n, 80);
  assert.equal(edited.after.total_score, 89);
  await repository.upsertDaily(1, date, score);
  assert.equal(score.n, 60);
  assert.equal(score.details.automatic_score_n, 87);
  assert.equal(score.details.total_score, 89);
  const restored = await repository.updateManualComponents(1, date, { n: null });
  assert.equal(restored.after.effective.n, 87);
  assert.equal(restored.after.total_score, 90.4);
});

for (const mode of ['batch', 'single'] as const) {
  test(`${mode} recomputation replaces stale daily N and reuses raw history`, async () => {
    const airport: Airport = { id: 1, name: 'Fixture', website: 'https://example.invalid',
      status: 'normal', is_listed: true, plan_price_month: 20, has_trial: false, tags: [], created_at: dates[0] };
    const metrics: DailyMetrics = { airport_id: 1, date, uptime_percent_30d: 100,
      median_latency_ms: 60, median_download_mbps: 300, packet_loss_percent: 0,
      stable_days_streak: 30, domain_ok: true, ssl_days_left: 90, recent_complaints_count: 0, history_incidents: 0 };
    const trend = history();
    trend.at(-1)!.details = { score_rule_version: 'v2_spncr' };
    let coverage: NetworkCoverageRun | null = { id: 7, score_n: 60, rule_version: 'network_coverage_v1',
      core_regions: [], extended_regions: [], nodes: [] } as unknown as NetworkCoverageRun;
    const written: ScoreBreakdown[] = [];
    const service = new RecomputeService({
      airportRepository: { listAll: async () => [airport], getById: async () => airport, setAutoTags: async () => undefined },
      metricsRepository: { getByDate: async () => [metrics], getByAirportAndDate: async () => metrics },
      scoreRepository: {
        getTimeSeriesBeforeDate: async () => [], getTrend: async () => trend,
        getByDate: async () => [],
        upsertDaily: async (_id, _day, score) => { written.push(structuredClone(score)); },
        deleteDaily: async () => undefined,
      },
      rankingRepository: { replaceForDate: async () => undefined },
      scoreRuleService: { resolveRuleVersion: async () => 'v2_spncr' },
      networkCoverageRunRepository: {
        getSuccessfulByAirportIdsAndDate: async () => coverage ? new Map([[1, coverage]]) : new Map(),
        getLatestSuccessfulByAirportAndDate: async () => coverage,
      },
    });
    const run = () => mode === 'batch' ? service.recomputeForDate(date) : service.recomputeAirportForDate(date, 1);
    await run();
    assert.equal(written[0].n, 60);
    assert.equal(written[0].details.automatic_score_n, 87);
    assert.equal(written[0].details.network_coverage_run_id, 7);
    trend[29] = { ...written[0], airport_id: 1, date };
    await run();
    assert.equal(written[1].details.automatic_score_n, 87);
    assert.equal(written[1].details.total_score, written[0].details.total_score);
    coverage!.score_n = 0;
    await run();
    assert.equal(written[2].n, 0);
    assert.equal(written[2].details.automatic_score_n, 80.99);
    coverage = null;
    if (mode === 'single') await assert.rejects(run, /network coverage is required/);
    else assert.deepEqual(await run(), { recomputed: 0 });
    assert.equal(written.length, 3, 'missing collection must not publish a synthetic zero');
  });
}
