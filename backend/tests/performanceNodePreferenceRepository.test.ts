import test from 'node:test';
import assert from 'node:assert/strict';
import { PerformanceNodePreferenceRepository } from '../src/repositories/performanceNodePreferenceRepository';

test('PerformanceNodePreferenceRepository creates table, saves, reads, and clears selection', async () => {
  const calls: Array<{ method: string; sql: string; params?: unknown[] }> = [];
  let storedNodes = JSON.stringify([
    { key: 'node-key-1', name: 'HK-1', region: 'HK', type: 'trojan' },
  ]);

  const repository = new PerformanceNodePreferenceRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ method: 'query', sql, params });
      if (sql.includes('SELECT airport_id, selected_nodes_json')) {
        return [[{
          airport_id: 9,
          selected_nodes_json: storedNodes,
          updated_by: 'admin',
          updated_at: '2026-05-23 12:34:56',
        }]];
      }
      return [[]];
    },
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ method: 'execute', sql, params });
      if (sql.includes('INSERT INTO airport_performance_node_preferences')) {
        storedNodes = String(params?.[1] || '[]');
        return [{ insertId: 1, affectedRows: 1 }];
      }
      if (sql.includes('DELETE FROM airport_performance_node_preferences')) {
        return [{ affectedRows: 1 }];
      }
      return [{ affectedRows: 0 }];
    },
  } as never);

  await repository.ensureSchema();
  await repository.save({
    airport_id: 9,
    selected_nodes: [
      { key: 'node-key-1', name: 'HK-1', region: 'HK', type: 'trojan' },
      { key: 'node-key-1', name: 'HK-1 duplicate', region: 'HK', type: 'trojan' },
      { key: '', name: 'Broken', region: null, type: null },
    ],
    updated_by: 'admin',
  });
  const latest = await repository.getByAirport(9);
  const cleared = await repository.clear(9);

  assert.ok(calls[0]?.sql.includes('CREATE TABLE IF NOT EXISTS airport_performance_node_preferences'));
  assert.ok(calls.some((call) => call.sql.includes('INSERT INTO airport_performance_node_preferences')));
  assert.equal(latest?.airport_id, 9);
  assert.deepEqual(latest?.selected_nodes, [
    { key: 'node-key-1', name: 'HK-1', region: 'HK', type: 'trojan' },
  ]);
  assert.equal(latest?.updated_at, '2026-05-23T12:34:56+08:00');
  assert.equal(cleared, true);
});
