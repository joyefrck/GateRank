import test from 'node:test';
import type { ScoreComponentEditorState } from '../../shared/gateRankScore';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { getDateInTimezone } from '../src/utils/time';
import { RankingRepository } from '../src/repositories/rankingRepository';
import { ScoreRepository } from '../src/repositories/scoreRepository';
import { createAdminRoutes } from '../src/routes/adminRoutes';
import { errorHandler } from '../src/middleware/errorHandler';
import { BillingEligibilityService } from '../src/services/billingEligibilityService';
import type { ScoreBreakdown } from '../src/types/domain';

// Opt-in, dedicated throwaway MySQL only. Never borrows application DB credentials.
test('manual score components: MySQL transactions, API, dates, legacy conversion and public score reads', {
  skip: !process.env.GATERANK_SCORE_TEST_PORT,
}, async (t) => {
  const pool = mysql.createPool({ host: '127.0.0.1', port: Number(process.env.GATERANK_SCORE_TEST_PORT),
    user: 'root', password: '', database: 'gaterank_score_test', connectionLimit: 8, decimalNumbers: true });
  const repository = new ScoreRepository(pool);
  const schema = await readFile(new URL('../sql/schema.sql', import.meta.url), 'utf8');
  try {
    for (const name of ['airports', 'airport_scores_daily', 'airport_rankings_daily']) {
      const definition = schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${name} \\([\\s\\S]*?\\n\\);`))![0];
      await pool.query(definition);
    }
    await pool.query('CREATE TABLE IF NOT EXISTS applicant_wallets (airport_id BIGINT UNSIGNED PRIMARY KEY, balance DECIMAL(10,2))');
    await pool.query('DELETE FROM airport_rankings_daily');
    await pool.query('DELETE FROM airport_scores_daily');
    await pool.query('DELETE FROM applicant_wallets');
    await pool.query('DELETE FROM airports');
    await pool.query("INSERT INTO airports (id,name,website,plan_price_month,created_at) VALUES (1,'Fixture One','https://example.invalid',20,'2026-09-01'),(2,'Fixture Two','https://two.invalid',20,'2026-09-01')");
    await pool.query('INSERT INTO applicant_wallets VALUES (1,100),(2,100)');
    const raw = (): ScoreBreakdown => ({ s: 70, p: 80, n: 90, c: 88, r: 60, risk_penalty: 40,
      score: 79, recent_score: 79, historical_score: 79, final_score: 79, details: { score_rule_version: 'v2_spncr' } });
    for (const date of ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']) await repository.upsertDaily(1, date, raw());
    await repository.upsertDaily(2, '2026-09-04', raw());

    await t.test('single and multiple edits preserve raw data and replace legacy score only on save', async () => {
      await pool.query("UPDATE airport_scores_daily SET details_json = JSON_SET(details_json, '$.manual_total_score', 95) WHERE airport_id=1 AND date='2026-09-04'");
      const stale = raw(); stale.details.manual_total_score = 50;
      await repository.upsertDaily(1, '2026-09-04', stale);
      assert.equal(await repository.getPublicDisplayScoreByAirportAndDate(1, '2026-09-04'), 95);
      const edit = await repository.updateManualComponents(1, '2026-09-04', { s: 0, p: 100, c: 12.34 });
      assert.equal(edit.before.total_score, 95);
      assert.equal(edit.after.legacy_total_score, null);
      assert.deepEqual(edit.after.overrides, { s: 0, p: 100, c: 12.34 });
      assert.equal(edit.after.total_score, 31.48);
      const stored = await repository.getByAirportAndDate(1, '2026-09-04');
      assert.equal(stored?.s, 70); assert.equal(stored?.p, 80); assert.equal(stored?.c, 88);
      assert.equal(await repository.getPublicDisplayScoreByAirportAndDate(1, '2026-09-04'), 31.48);
      assert.equal((await repository.getPublicDisplayScoresByDate([1], '2026-09-04')).get(1), 31.48);
    });

    await t.test('same-day recomputation retains overrides; the next day uses raw historical series', async () => {
      await repository.upsertDaily(1, '2026-09-04', raw());
      const next = raw(); await repository.upsertDaily(1, '2026-09-05', next);
      assert.equal(await repository.getPublicDisplayScoreByAirportAndDate(1, '2026-09-04'), 31.48);
      assert.equal(next.details.total_score, 56.09);
      assert.equal(next.details.manual_score_s, undefined);
      const restored = await repository.updateManualComponents(1, '2026-09-04', { p: null });
      assert.equal(restored.after.effective.p, 80);
      assert.equal(restored.after.effective.s, 0);
      assert.equal(restored.after.overrides.c, 12.34);
    });

    await t.test('concurrent independent patches and in-flight recomputations do not lose or resurrect overrides', async () => {
      await Promise.all([
        repository.updateManualComponents(1, '2026-09-04', { p: 88 }),
        repository.updateManualComponents(1, '2026-09-04', { r: 99 }),
        repository.upsertDaily(1, '2026-09-04', raw()),
      ]);
      let stored = (await repository.getByAirportAndDate(1, '2026-09-04'))!;
      assert.equal(stored.details.manual_score_p, 88); assert.equal(stored.details.manual_score_r, 99);
      const stale = structuredClone(stored);
      await repository.updateManualComponents(1, '2026-09-04', { p: null });
      await repository.upsertDaily(1, '2026-09-04', stale);
      stored = (await repository.getByAirportAndDate(1, '2026-09-04'))!;
      assert.equal(stored.details.manual_score_p, undefined);
      assert.equal(stored.details.manual_score_r, 99);
      assert.equal(stored.p, 80);
    });

    await t.test('v1 and missing dates fail atomically', async () => {
      const legacy = raw(); legacy.details.score_rule_version = 'v1_spcr'; legacy.n = null;
      await repository.upsertDaily(2, '2026-09-03', legacy);
      await assert.rejects(repository.updateManualComponents(2, '2026-09-03', { s: 100, n: 90 }), /历史 v1/);
      assert.equal((await repository.getByAirportAndDate(2, '2026-09-03'))?.details.manual_score_s, undefined);
      await assert.rejects(repository.updateManualComponents(1, '2026-08-01', { s: 100 }), /没有评分/);
    });

    await t.test('HTTP validates inputs, returns authoritative calculation, rebuilds rankings and audits before/after', async () => {
      const audits: unknown[][] = []; const rebuilt: string[] = [];
      const app = express(); app.use(express.json());
      app.use(createAdminRoutes({ scoreRepository: repository,
        recomputeService: { rebuildRankingsForDate: async (date: string) => { rebuilt.push(date); } },
        auditRepository: { log: async (...args: unknown[]) => { audits.push(args); } },
      } as never)); app.use(errorHandler);
      const server = app.listen(0);
      const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/airports/1/scores/2026-09-04/manual-components`;
      async function patch(body: unknown, target = url) {
        return fetch(target, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      }
      try {
        for (const body of [{ s: -1 }, { p: 101 }, { r: '90' }, { c: '' }, { n: true }, { total_score: 90 }, []]) {
          assert.equal((await patch(body)).status, 400);
        }
        const response = await patch({ p: 77.936, s: null });
        assert.equal(response.status, 200); const body = await response.json() as ScoreComponentEditorState;
        assert.equal(body.effective.p, 77.94); assert.equal(body.effective.s, 70);
        assert.equal(body.total_score, await repository.getPublicDisplayScoreByAirportAndDate(1, '2026-09-04'));
        assert.deepEqual(rebuilt, ['2026-09-04']); assert.equal(audits.length, 1);
        assert.ok((audits[0][3] as { before: unknown }).before);
        assert.equal((await patch({ p: 10 }, url.replace('2026-09-04', '2026-08-01'))).status, 404);
        assert.equal((await patch({ total_score: 90 }, url.replace('manual-components', 'manual-total-score'))).status, 410);
      } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
    });

    await t.test('ranking snapshots roll back completely on failure and serialize concurrent rebuilds', async () => {
      const rankings = new RankingRepository(pool);
      const one = [{ airport_id: 1, rank: 1, score: 90, details: {} }];
      await rankings.withSnapshotLock('2026-09-04', async (writer) => {
        await writer.replaceForDate('2026-09-04', 'stable', one);
        await writer.replaceForDate('2026-09-04', 'value', one);
      });
      await assert.rejects(rankings.withSnapshotLock('2026-09-04', async (writer) => {
        await writer.replaceForDate('2026-09-04', 'stable', []);
        throw new Error('fixture failure');
      }), /fixture failure/);
      assert.equal((await rankings.getRanking('2026-09-04', 'stable')).length, 1);
      const sequence: number[] = [];
      await Promise.all([1, 2].map((n) => rankings.withSnapshotLock('2026-09-04', async (writer) => {
        sequence.push(n);
        await writer.replaceForDate('2026-09-04', 'stable', [{ ...one[0], score: n }]);
        sequence.push(n);
      })));
      assert.deepEqual(sequence, [1, 1, 2, 2]);
      assert.equal((await rankings.getRanking('2026-09-04', 'stable'))[0].score, 2);
    });

    await t.test('billing observes new scores and score revisions while still hiding insufficient balances', async () => {
      const service = new BillingEligibilityService(pool, { getConfig: async () => ({ click_charge_amount: 1 }) },
        { resolveRuleVersion: async () => 'v2_spncr' });
      const before = (await service.getSnapshot()).get(1)!;
      // Change the latest snapshot, preserving rank order.
      const latest = (await repository.getLatestAvailableDate(getDateInTimezone('Asia/Shanghai')))!;
      await repository.updateManualComponents(1, latest, { p: 81 });
      const after = (await service.getSnapshot()).get(1)!;
      assert.equal(after.rank, before.rank); assert.notEqual(after.score_revision, before.score_revision);
      await pool.query('UPDATE applicant_wallets SET balance=0 WHERE airport_id=1');
      const hidden = (await service.getSnapshot()).get(1)!;
      assert.equal(hidden.score_hidden, true); assert.equal(hidden.rank, null);
    });
  } finally { await pool.end(); }
});
