import test from 'node:test';
import assert from 'node:assert/strict';
import { ToolDownloadRepository } from '../src/repositories/toolDownloadRepository';

test('ToolDownloadRepository.ensureSchema creates download item table and indexes', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const pool = {
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('information_schema.COLUMNS') || sql.includes('information_schema.STATISTICS')) {
        return [[{ count: 0 }], []];
      }
      return [[], []];
    },
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return [{ insertId: 1, affectedRows: 1 }, []];
    },
  };

  const repository = new ToolDownloadRepository(pool as never);
  await repository.ensureSchema();

  assert.ok(calls.some((call) => call.sql.includes('CREATE TABLE IF NOT EXISTS tool_download_items')));
  assert.ok(calls.some((call) => call.sql.includes('platforms_json JSON NOT NULL')));
  assert.ok(calls.some((call) => call.sql.includes('platform_versions_json JSON NULL')));
  assert.ok(calls.some((call) => call.sql.includes("primary_action ENUM('official', 'local')")));
  assert.ok(calls.some((call) => call.sql.includes('download_count BIGINT UNSIGNED NOT NULL DEFAULT 0')));
  assert.ok(calls.some((call) => call.sql.includes('content_updated_at DATETIME NULL')));
  assert.ok(calls.some((call) => call.sql.includes('CREATE UNIQUE INDEX uk_tool_download_items_slug')));
  assert.ok(calls.some((call) => call.sql.includes('CREATE INDEX idx_tool_download_items_status_sort')));
});

test('ToolDownloadRepository.listPublished filters by platform and maps JSON fields', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const pool = {
    query: async (sql: string, params?: unknown[]) => {
      queries.push({ sql, params });
      if (sql.includes('COUNT(*)')) {
        return [[{ total: 1 }], []];
      }
      return [[{
        id: 7,
        slug: 'clash-verge-rev',
        name: 'Clash Verge Rev',
        summary: '跨平台代理客户端',
        description: '支持 Windows、macOS 和 Linux 的 Clash Meta 客户端。',
        platforms_json: JSON.stringify(['windows', 'macos', 'linux']),
        platform_versions_json: JSON.stringify({ windows: 'Windows 10/11', macos: 'macOS 12+', linux: 'Ubuntu 20.04+' }),
        icon_url: '/uploads/tools/icons/clash.webp',
        local_file_url: '',
        official_url: 'https://github.com/clash-verge-rev/clash-verge-rev',
        primary_action: 'official',
        version: 'latest',
        file_size_label: '',
        download_count: 12,
        is_hot: 1,
        sort_order: 10,
        status: 'published',
        published_at: '2026-07-08 10:00:00',
        content_updated_at: '2026-07-09 11:30:00',
        created_at: '2026-07-08 09:00:00',
        updated_at: '2026-07-08 10:00:00',
      }], []];
    },
  };

  const repository = new ToolDownloadRepository(pool as never);
  const result = await repository.listPublished({ platform: 'windows' });

  assert.equal(result.total, 1);
  assert.equal(result.items[0].slug, 'clash-verge-rev');
  assert.deepEqual(result.items[0].platforms, ['windows', 'macos', 'linux']);
  assert.deepEqual(result.items[0].platform_versions, { windows: 'Windows 10/11', macos: 'macOS 12+', linux: 'Ubuntu 20.04+' });
  assert.equal(result.items[0].is_hot, true);
  assert.equal(result.items[0].download_count, 12);
  assert.equal(result.items[0].content_updated_at, '2026-07-09 11:30:00');
  assert.match(queries[1].sql, /DATE_FORMAT\(content_updated_at,/);
  assert.match(queries[1].sql, /JSON_CONTAINS\(platforms_json, JSON_QUOTE\(\?\)\)/);
  assert.deepEqual(queries[1].params, ['published', 'windows', 100, 0]);
});

test('ToolDownloadRepository.incrementDownloadCount increments every successful download request', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const pool = {
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return [{ affectedRows: 1 }, []];
    },
  };

  const repository = new ToolDownloadRepository(pool as never);
  const updated = await repository.incrementDownloadCount(7);

  assert.equal(updated, true);
  assert.match(calls[0].sql, /download_count = download_count \+ 1/);
  assert.doesNotMatch(calls[0].sql, /content_updated_at/);
  assert.deepEqual(calls[0].params, [7]);
});

test('ToolDownloadRepository.create persists per-platform version labels', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const pool = {
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return [{ insertId: 12, affectedRows: 1 }, []];
    },
  };

  const repository = new ToolDownloadRepository(pool as never);
  const id = await repository.create({
    slug: 'stash',
    name: 'Stash',
    summary: 'Apple 客户端',
    platforms: ['ios', 'macos'],
    platform_versions: {
      ios: 'iOS 15+',
      macos: 'macOS 12+',
    },
  });

  assert.equal(id, 12);
  assert.match(calls[0].sql, /platform_versions_json/);
  assert.ok(calls[0].params?.includes(JSON.stringify({ ios: 'iOS 15+', macos: 'macOS 12+' })));
});
