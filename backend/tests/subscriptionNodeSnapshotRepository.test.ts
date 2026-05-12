import test from 'node:test';
import assert from 'node:assert/strict';
import { SubscriptionNodeSnapshotRepository } from '../src/repositories/subscriptionNodeSnapshotRepository';

test('SubscriptionNodeSnapshotRepository creates table, inserts snapshot, and reads latest by airport', async () => {
  const calls: Array<{ method: string; sql: string; params?: unknown[] }> = [];
  const repository = new SubscriptionNodeSnapshotRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ method: 'query', sql, params });
      if (sql.includes('SELECT id, airport_id, captured_at')) {
        return [[{
          id: 5,
          airport_id: 9,
          captured_at: '2026-05-13 12:34:56',
          source: 'cron-performance',
          subscription_url: 'https://sub.example.com',
          subscription_format: 'plain',
          parsed_nodes_count: 2,
          supported_nodes_count: 1,
          nodes_json: JSON.stringify([
            {
              name: 'HK-1',
              region: 'HK',
              type: 'trojan',
              outbound: { type: 'trojan', server: 'hk.example.com', server_port: 443 },
              raw_uri: 'trojan://password@hk.example.com:443#HK-1',
            },
          ]),
          unsupported_nodes_json: JSON.stringify([{ uri: 'unknown://node', reason: 'unsupported_scheme' }]),
          created_at: '2026-05-13 12:35:00',
        }]];
      }
      return [[]];
    },
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ method: 'execute', sql, params });
      return [{ insertId: 7 }];
    },
  } as never);

  await repository.ensureSchema();
  const insertId = await repository.insert({
    airport_id: 9,
    captured_at: '2026-05-13 12:34:56',
    source: 'cron-performance',
    subscription_url: 'https://sub.example.com',
    subscription_format: 'plain',
    parsed_nodes_count: 2,
    supported_nodes_count: 1,
    nodes: [
      {
        name: 'HK-1',
        region: 'HK',
        type: 'trojan',
        outbound: { type: 'trojan', server: 'hk.example.com', server_port: 443 },
        raw_uri: 'trojan://password@hk.example.com:443#HK-1',
      },
    ],
    unsupported_nodes: [{ uri: 'unknown://node', reason: 'unsupported_scheme' }],
  });
  const latest = await repository.getLatestByAirport(9);

  assert.equal(insertId, 7);
  assert.ok(calls[0]?.sql.includes('CREATE TABLE IF NOT EXISTS airport_subscription_node_snapshots'));
  assert.ok(calls.some((call) => call.sql.includes('INSERT INTO airport_subscription_node_snapshots')));
  assert.equal(latest?.id, 5);
  assert.equal(latest?.airport_id, 9);
  assert.equal(latest?.captured_at, '2026-05-13T12:34:56+08:00');
  assert.equal(latest?.nodes[0]?.name, 'HK-1');
  assert.equal(latest?.nodes[0]?.outbound.server, 'hk.example.com');
  assert.equal(latest?.unsupported_nodes[0]?.reason, 'unsupported_scheme');
});
