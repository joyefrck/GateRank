import assert from 'node:assert/strict';
import test from 'node:test';
import { RiskCheckService } from '../src/services/riskCheckService';
import { RiskCheckRepository } from '../src/repositories/riskCheckRepository';
import { emptyProbeResult } from '../src/services/websiteProbe';
import type { WebsiteProbeResult } from '../../shared/riskCheck';

const good: WebsiteProbeResult = { ...emptyProbeResult('challenge'), domain_ok: true, ssl_days_left: 74 };

for (const failure of [false, true]) {
  test(`risk write and evidence ${failure ? 'roll back together' : 'commit together without overwriting unrelated metrics'}`, async () => {
    const events: string[] = [];
    const sqls: string[] = [];
    const connection = {
      beginTransaction: async () => { events.push('begin'); },
      query: async () => { events.push('lock'); return [[]]; },
      execute: async (sql: string, values: unknown[]) => {
        assert.equal((sql.match(/\?/g) || []).length, values.length);
        sqls.push(sql);
        if (failure && sql.includes('INSERT INTO airport_risk_checks')) throw new Error('storage unavailable');
        events.push(sql.includes('airport_metrics_daily') ? 'metrics' : 'evidence');
        return [{ insertId: 1 }];
      },
      commit: async () => { events.push('commit'); },
      rollback: async () => { events.push('rollback'); },
      release: () => { events.push('release'); },
    };
    const repository = new RiskCheckRepository({ getConnection: async () => connection } as never);
    if (failure) await assert.rejects(repository.save(94, '2026-09-24', good, null), /storage unavailable/);
    else await repository.save(94, '2026-09-24', good, null);
    assert.deepEqual(events, failure ? ['begin', 'lock', 'metrics', 'rollback', 'release'] : ['begin', 'lock', 'metrics', 'evidence', 'commit', 'release']);
    const updates = sqls[0].split('ON DUPLICATE KEY UPDATE')[1];
    assert.equal(updates.trim(), 'domain_ok = VALUES(domain_ok), ssl_days_left = VALUES(ssl_days_left)');
  });
}

test('configuration failure records diagnosis but never updates metrics or silently succeeds', async () => {
  let saved: WebsiteProbeResult | null = null;
  const calls: string[] = [];
  const repo = new RiskCheckRepository({ getConnection: async () => ({
    beginTransaction: async () => {}, query: async () => [[]],
    execute: async (sql: string, values: unknown[]) => { calls.push(sql); saved = JSON.parse(String(values.at(-1))); return [{}]; },
    commit: async () => {}, rollback: async () => {}, release: () => {},
  }) } as never);
  const service = new RiskCheckService({
    airportRepository: { getById: async () => ({ id: 94, website: 'javascript:alert(1)' }) },
    metricsRepository: { getByAirportAndDate: async () => null, getLatestByAirportBeforeDate: async () => null },
    riskCheckRepository: repo,
  } as never);
  await assert.rejects(service.inspectAirportForDate(94, '2026-09-24'), /已有风险指标未覆盖/);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].includes('INSERT INTO airport_risk_checks'));
  assert.equal((saved as WebsiteProbeResult | null)?.domain_ok, null);
});

test('internal failures are sanitized and recorded without updating risk snapshot', async () => {
  let saved: WebsiteProbeResult | null = null;
  const service = new RiskCheckService({
    airportRepository: { getById: async () => ({ id: 94, website: 'https://example.com?token=private' }) },
    metricsRepository: { getByAirportAndDate: async () => null, getLatestByAirportBeforeDate: async () => null },
    riskCheckRepository: { save: async (_id: number, _date: string, result: WebsiteProbeResult) => { saved = result; } },
    probe: async () => { throw new Error('private token=secret'); },
  } as never);
  await assert.rejects(service.inspectAirportForDate(94, '2026-09-24'), /检测执行异常/);
  assert.equal((saved as WebsiteProbeResult | null)?.status, 'internal_error');
  assert.doesNotMatch(JSON.stringify(saved), /private|secret/);
});

test('history is scoped to airport and selected day and reports last applied snapshot', async () => {
  const queries: string[] = [];
  const repo = new RiskCheckRepository({ query: async (sql: string, params: unknown[]) => {
    queries.push(sql);
    assert.deepEqual(params, [94, '2026-09-24']);
    const applied = sql.includes('AND applied_to_metrics = 1');
    return [[{ id: applied ? 1 : 2, date: '2026-09-24', applied_to_metrics: applied ? 1 : 0,
      result_json: JSON.stringify(applied ? good : emptyProbeResult('config_error')) }]];
  } } as never);
  const history = await repo.getHistory(94, '2026-09-24');
  assert.equal(history.latest?.applied_to_metrics, false);
  assert.equal(history.last_applied?.status, 'challenge');
  assert.ok(queries.every((sql) => sql.includes('airport_id = ? AND date <= ?')));
});
