import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSubscriptionNodeRegionCounts,
  SubscriptionNodeSnapshotRepository,
} from '../src/repositories/subscriptionNodeSnapshotRepository';

test('buildSubscriptionNodeRegionCounts recognizes all shared regions and ignores informational entries', () => {
  const node = (name: string, region: string | null = null) => ({
    name,
    region,
    type: 'trojan',
    outbound: { type: 'trojan', server: 'node.example.com', server_port: 443 },
    raw_uri: `trojan://password@node.example.com:443#${encodeURIComponent(name)}`,
  });

  assert.deepEqual(buildSubscriptionNodeRegionCounts([
    node('土耳其 Istanbul 01'),
    node('泰国 Bangkok 01'),
    node('印度尼西亚 Jakarta 01'),
    node('剩余流量：100 GB', 'GB'),
  ]), {
    TR: 1,
    TH: 1,
    ID: 1,
  });
});

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
          region_counts_json: JSON.stringify({ HK: 1 }),
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
  assert.ok(calls.some((call) => call.sql.includes('ADD COLUMN region_counts_json JSON NULL')));
  assert.ok(calls.some((call) => call.sql.includes('INSERT INTO airport_subscription_node_snapshots')));
  const insertCall = calls.find((call) => call.sql.includes('INSERT INTO airport_subscription_node_snapshots'));
  assert.ok(insertCall?.params?.includes(JSON.stringify({ HK: 1 })));
  assert.equal(latest?.id, 5);
  assert.equal(latest?.airport_id, 9);
  assert.equal(latest?.captured_at, '2026-05-13T12:34:56+08:00');
  assert.equal(latest?.nodes[0]?.name, 'HK-1');
  assert.equal(latest?.nodes[0]?.outbound.server, 'hk.example.com');
  assert.deepEqual(latest?.region_counts, { HK: 1 });
  assert.equal(latest?.unsupported_nodes[0]?.reason, 'unsupported_scheme');
});

test('SubscriptionNodeSnapshotRepository backfills only latest legacy snapshots with authoritative counts', async () => {
  const calls: Array<{ method: string; sql: string; params?: unknown[] }> = [];
  const repository = new SubscriptionNodeSnapshotRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ method: 'query', sql, params });
      if (sql.includes('information_schema.COLUMNS')) {
        return [[]];
      }
      if (sql.includes('region_counts_json IS NULL')) {
        return [[{
          id: 21,
          nodes_json: JSON.stringify([
            {
              name: 'Turkey Istanbul 01',
              region: null,
              type: 'trojan',
              outbound: { type: 'trojan', server: 'tr.example.com', server_port: 443 },
              raw_uri: 'trojan://password@tr.example.com:443#TR',
            },
            {
              name: '套餐到期：长期有效 UK',
              region: 'GB',
              type: 'trojan',
              outbound: { type: 'trojan', server: 'info.example.com', server_port: 443 },
              raw_uri: 'trojan://password@info.example.com:443#INFO',
            },
          ]),
        }]];
      }
      return [[]];
    },
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ method: 'execute', sql, params });
      return [{ affectedRows: 1 }];
    },
  } as never);

  await repository.ensureSchema();

  const backfill = calls.find((call) => call.sql.includes('UPDATE airport_subscription_node_snapshots'));
  assert.deepEqual(backfill?.params, [JSON.stringify({ TR: 1 }), 21]);
  const select = calls.find((call) => call.sql.includes('region_counts_json IS NULL'));
  assert.match(select?.sql || '', /ORDER BY candidate\.captured_at DESC, candidate\.id DESC/);
});
