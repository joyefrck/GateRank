import test from 'node:test';
import assert from 'node:assert/strict';
import { RankingRepository } from '../src/repositories/rankingRepository';

test('replaceForDate uses upsert when inserting ranking rows', async () => {
  const calls: Array<{ sql: string; args: unknown[] }> = [];
  const pool = {
    execute: async (sql: string, args: unknown[]) => {
      calls.push({ sql, args });
      return [{ affectedRows: 1 }];
    },
  };

  const repository = new RankingRepository(pool as never);
  await repository.replaceForDate('2026-03-26', 'today', [
    { airport_id: 1, rank: 1, score: 98.5, details: { airport_name: 'A' } },
    { airport_id: 2, rank: 2, score: 97.1, details: { airport_name: 'B' } },
  ]);

  assert.equal(calls.length, 2);
  assert.match(calls[1]!.sql, /ON DUPLICATE KEY UPDATE/u);
  assert.match(calls[1]!.sql, /rank_no = VALUES\(rank_no\)/u);
  assert.match(calls[1]!.sql, /score = VALUES\(score\)/u);
  assert.match(calls[1]!.sql, /details_json = VALUES\(details_json\)/u);
});
