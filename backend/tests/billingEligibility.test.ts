import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateBillingEligibility } from '../src/services/billingEligibilityService';
import { ApplicantBillingRepository } from '../src/repositories/applicantBillingRepository';
import { ScoreRepository } from '../src/repositories/scoreRepository';

const config = { click_charge_amount: 0.8, rank_click_charge_amounts: { 1: 1.8, 2: 1.5, 3: 1.2 } };
const candidates = (secondBalance = 0.9, thirdBalance = 1.1) => [
  { airport_id: 1, balance: 100, display_score: 95, rankable: true },
  { airport_id: 102, balance: secondBalance, display_score: 94, rankable: true },
  { airport_id: 103, balance: thirdBalance, display_score: 93, rankable: true },
  { airport_id: 104, balance: 100, display_score: 90, rankable: true },
];

test('insufficient tier balances hide scores and do not regain eligibility at the base price', () => {
  const result = allocateBillingEligibility(candidates(), config);
  assert.equal(result.get(102)?.score_hidden, true);
  assert.equal(result.get(103)?.score_hidden, true);
  assert.equal(result.get(102)?.click_charge_amount, 1.5);
  assert.equal(result.get(103)?.click_charge_amount, 1.5);
  assert.equal(result.get(104)?.rank, 2);
  assert.equal(result.get(104)?.click_charge_amount, 1.5);
});

test('exact funds allow one charge, the next read hides, and recharge restores', () => {
  assert.equal(allocateBillingEligibility(candidates(1.5), config).get(102)?.score_hidden, false);
  assert.equal(allocateBillingEligibility(candidates(0), config).get(102)?.score_hidden, true);
  const restored = allocateBillingEligibility(candidates(100, 100), config);
  assert.equal(restored.get(102)?.rank, 2);
  assert.equal(restored.get(103)?.rank, 3);
  assert.equal(restored.get(103)?.click_charge_amount, 1.2);
});

test('unscored and non-ranking airports do not consume priced positions', () => {
  const result = allocateBillingEligibility([
    { airport_id: 8, balance: 10, display_score: null, rankable: true },
    { airport_id: 9, balance: 10, display_score: 99, rankable: false },
    ...candidates(),
  ], config);
  assert.equal(result.get(8)?.rank, null);
  assert.equal(result.get(9)?.rank, null);
  assert.equal(result.get(1)?.rank, 1);
  assert.equal(result.get(9)?.click_charge_amount, 0.8);
});

test('production repository applies the global eligibility mask before filtering and SQL pagination', async () => {
  const calls: string[] = [];
  const repository = new ScoreRepository({ query: async (sql: string) => {
    calls.push(sql);
    return sql.includes('COUNT(*)') ? [[{ total: 65 }]] : [[]];
  } } as never);
  repository.billingEligibility = { getHiddenScoreSql: async () => '(a.id NOT IN (1,61))' } as never;
  await repository.getPublicFullRankingByDate('2026-09-03', 2, 20);
  const query = calls.find((sql) => sql.includes('AS score_hidden'))!;
  assert.match(query, /\(a.id NOT IN \(1,61\)\) AS score_hidden/);
  assert.ok(query.indexOf('AS score_hidden') < query.indexOf('LIMIT ? OFFSET ?'));
  assert.doesNotMatch(query, /w.balance, 0\) < \?/);
});

test('wallet-locked eligibility overrides a stale cheap route quote without debiting', async () => {
  const operations: string[] = [];
  const connection = {
    beginTransaction: async () => { operations.push('begin'); },
    commit: async () => { operations.push('commit'); },
    rollback: async () => { operations.push('rollback'); },
    release: () => {},
    query: async () => {
      operations.push('lock');
      return [[{ airport_id: 102, airport_name: 'Tiered Airport', is_listed: 1,
        wallet_id: 501, applicant_account_id: 502, application_id: 503, balance: 0.9 }]];
    },
    execute: async (sql: string) => { operations.push(sql); return [{ affectedRows: 1 }]; },
  };
  const repository = new ApplicantBillingRepository({ getConnection: async () => connection } as never);
  repository.billingEligibility = { getSnapshot: async (tx: unknown, locked: unknown) => {
    assert.equal(tx, connection);
    assert.deepEqual(locked, { airport_id: 102, balance: 0.9 });
    assert.ok(operations.includes('lock'));
    return allocateBillingEligibility(candidates(), config);
  } } as never;
  const result = await repository.processOutboundClick({
    airport_id: 102, click_id: 'test-click', click_charge_amount: 0.8,
    placement: 'home_card', target_kind: 'website', target_url: 'https://example.com',
    visitor_hash: 'test', session_hash: 'test', event_date: '2026-09-03', occurred_at: '2026-09-03 12:00:00',
  });
  assert.equal(result.status, 'free');
  assert.equal(result.balance_after, 0.9);
  assert.ok(!operations.some((sql) => sql.includes('UPDATE applicant_wallets')));
});
