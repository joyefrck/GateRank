import test from 'node:test';
import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import path from 'node:path';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import express from 'express';
import { createToolsPublicRoutes } from '../src/routes/toolsPublicRoutes';
import { createToolsAdminRoutes } from '../src/routes/toolsAdminRoutes';
import { IpCheckServiceError } from '../src/services/ipGeolocationService';
import { errorHandler } from '../src/middleware/errorHandler';
import { DEFAULT_TOOLS_DOWNLOAD_PAGE_CONFIG } from '../../shared/toolDownloads';
import type { IpCheckResult, IpCheckSuccessResponse } from '../../shared/ipCheck';
import type { StreamingCheckResponse } from '../../shared/streamingCheck';

test('IP check resolves the Cloudflare visitor IP and keeps responses private', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', createToolsPublicRoutes({
    toolsDownloadService: { getDownloadPageView: async () => ({}) } as never,
    ipCheckService: {
      lookup: async (query) => createIpCheckResult(query),
    },
  }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/tools/ip-check`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'cf-connecting-ip': '8.8.8.8',
      },
      body: '{}',
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('pragma'), 'no-cache');
    const data = await response.json() as IpCheckSuccessResponse;
    assert.equal(data.result.ip, '8.8.8.8');
    assert.ok(data.checked_at);

    const getResponse = await fetch(`http://127.0.0.1:${port}/api/v1/tools/ip-check`);
    assert.equal(getResponse.status, 404);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('IP check normalizes manual domains and rejects private targets', async () => {
  const queries: string[] = [];
  const app = express();
  app.use(express.json());
  app.use('/api/v1', createToolsPublicRoutes({
    toolsDownloadService: { getDownloadPageView: async () => ({}) } as never,
    ipCheckService: {
      lookup: async (query) => {
        queries.push(query);
        return createIpCheckResult('8.8.8.8');
      },
    },
  }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const valid = await fetch(`http://127.0.0.1:${port}/api/v1/tools/ip-check`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '1.1.1.1' },
      body: JSON.stringify({ query: ' Example.COM ' }),
    });
    assert.equal(valid.status, 200);
    assert.deepEqual(queries, ['example.com']);

    const invalid = await fetch(`http://127.0.0.1:${port}/api/v1/tools/ip-check`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '1.1.1.1' },
      body: JSON.stringify({ query: '192.168.1.1' }),
    });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json() as { code: string }).code, 'IP_CHECK_INVALID_QUERY');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('IP check maps provider errors and applies a dedicated rate limit', async () => {
  const previousMax = process.env.IP_CHECK_RATE_MAX;
  process.env.IP_CHECK_RATE_MAX = '2';
  const app = express();
  app.use(express.json());
  app.use('/api/v1', createToolsPublicRoutes({
    toolsDownloadService: { getDownloadPageView: async () => ({}) } as never,
    ipCheckService: {
      lookup: async (query) => {
        if (query === 'example.com') {
          throw new IpCheckServiceError('IP_CHECK_LOOKUP_FAILED', 422);
        }
        return createIpCheckResult(query);
      },
    },
  }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const first = await fetch(`http://127.0.0.1:${port}/api/v1/tools/ip-check`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '1.1.1.1' },
      body: JSON.stringify({ query: 'example.com' }),
    });
    assert.equal(first.status, 422);
    assert.equal((await first.json() as { code: string }).code, 'IP_CHECK_LOOKUP_FAILED');

    const second = await fetch(`http://127.0.0.1:${port}/api/v1/tools/ip-check`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '1.1.1.1' },
      body: JSON.stringify({ query: '8.8.8.8' }),
    });
    assert.equal(second.status, 200);

    const limited = await fetch(`http://127.0.0.1:${port}/api/v1/tools/ip-check`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '1.1.1.1' },
      body: JSON.stringify({ query: '8.8.4.4' }),
    });
    assert.equal(limited.status, 429);
    assert.equal((await limited.json() as { code: string }).code, 'IP_CHECK_RATE_LIMITED');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    if (previousMax === undefined) delete process.env.IP_CHECK_RATE_MAX;
    else process.env.IP_CHECK_RATE_MAX = previousMax;
  }
});

test('streaming check returns private visitor network assessment from Cloudflare headers', async () => {
  const app = express();
  app.use('/api/v1', createToolsPublicRoutes({
    toolsDownloadService: {
      getDownloadPageView: async () => ({
        config: DEFAULT_TOOLS_DOWNLOAD_PAGE_CONFIG,
        platform: null,
        platforms: [],
        items: [],
        hotItems: [],
        total: 0,
      }),
    } as never,
  }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/tools/streaming-check`, {
      method: 'POST',
      headers: {
        'cf-connecting-ip': '203.0.113.20',
        'cf-ipcountry': 'SG',
        'x-forwarded-for': '198.51.100.8',
      },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('pragma'), 'no-cache');
    const data = await response.json() as StreamingCheckResponse;
    assert.equal(data.network.ip, '203.0.113.20');
    assert.equal(data.network.country_code, 'SG');
    assert.match(data.network.country_name, /新加坡/);
    assert.equal(data.services.length, 6);
    assert.equal(data.netflix.inferred_region, 'sg');
    assert.equal(data.netflix.catalog_scope, 'unconfirmed');
    assert.ok(data.checked_at);
    assert.ok(data.policy_checked_at);

    const getResponse = await fetch(`http://127.0.0.1:${port}/api/v1/tools/streaming-check`);
    assert.equal(getResponse.status, 404);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('streaming check rate limit returns 429 with Retry-After', async () => {
  const previousMax = process.env.STREAMING_CHECK_RATE_MAX;
  process.env.STREAMING_CHECK_RATE_MAX = '2';
  const app = express();
  app.use('/api/v1', createToolsPublicRoutes({
    toolsDownloadService: { getDownloadPageView: async () => ({}) } as never,
  }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const request = () => fetch(`http://127.0.0.1:${port}/api/v1/tools/streaming-check`, {
      method: 'POST',
      headers: { 'cf-connecting-ip': '198.51.100.23', 'cf-ipcountry': 'US' },
    });
    assert.equal((await request()).status, 200);
    assert.equal((await request()).status, 200);
    const limited = await request();
    assert.equal(limited.status, 429);
    assert.ok(limited.headers.get('retry-after'));
    const body = await limited.json() as { code: string };
    assert.equal(body.code, 'STREAMING_CHECK_RATE_LIMITED');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    if (previousMax === undefined) delete process.env.STREAMING_CHECK_RATE_MAX;
    else process.env.STREAMING_CHECK_RATE_MAX = previousMax;
  }
});

test('tools public routes expose published downloads and page config', async () => {
  const app = express();
  app.use('/api/v1', createToolsPublicRoutes({
    toolsDownloadService: {
      getDownloadPageView: async (platform) => ({
        config: DEFAULT_TOOLS_DOWNLOAD_PAGE_CONFIG,
        platform: platform ?? null,
        platforms: ['windows', 'macos', 'ios', 'android', 'linux'],
        items: [{
          id: 1,
          slug: 'shadowrocket',
          name: 'Shadowrocket',
          summary: 'iOS 代理客户端',
          description: '适合 iPhone 和 iPad 的代理工具。',
          platforms: ['ios'],
          platform_versions: { ios: 'iOS 15+' },
          icon_url: '/uploads/tools/icons/shadowrocket.webp',
          local_file_url: '/uploads/tools/files/shadowrocket.ipa',
          official_url: 'https://apps.apple.com/app/shadowrocket/id932747118',
          primary_action: 'official',
          version: '',
          file_size_label: '',
          download_count: 6,
          is_hot: true,
          sort_order: 1,
          status: 'published',
          published_at: '2026-07-08 10:00:00',
          created_at: '2026-07-08 09:00:00',
          updated_at: '2026-07-08 10:00:00',
        }],
        hotItems: [],
        total: 1,
      }),
    } as never,
  }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/tools/downloads?platform=ios`);
    assert.equal(response.status, 200);
    const data = await response.json() as { platform: string; items: Array<{ name: string; local_file_url: string; file_extension?: string; download_count: number }> };
    assert.equal(data.platform, 'ios');
    assert.equal(data.items[0].name, 'Shadowrocket');
    assert.equal(data.items[0].local_file_url, '/download/file.ipa');
    assert.equal(data.items[0].file_extension, '.ipa');
    assert.equal(data.items[0].download_count, 6);
    assert.deepEqual((data.items[0] as { platform_versions?: Record<string, string> }).platform_versions, { ios: 'iOS 15+' });

    const pageResponse = await fetch(`http://127.0.0.1:${port}/api/v1/tools/download-page`);
    assert.equal(pageResponse.status, 200);
    const page = await pageResponse.json() as { config: { seo_title: string }; items: Array<{ local_file_url: string }> };
    assert.match(page.config.seo_title, /翻墙工具下载/);
    assert.equal(page.items[0].local_file_url, '/download/file.ipa');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('tools admin routes update page SEO config and publish downloads', async () => {
  const auditActions: string[] = [];
  const createdPayloads: unknown[] = [];
  let publicCacheClears = 0;
  let currentStatus = 'draft';
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'tools-test';
    next();
  });
  app.use('/api/v1/admin', createToolsAdminRoutes({
    auditRepository: {
      log: async (action: string) => { auditActions.push(action); },
    } as never,
    publicPageCache: {
      clear: () => { publicCacheClears += 1; },
    },
    toolsDownloadService: {
      getAdminDownloadPageConfig: async () => DEFAULT_TOOLS_DOWNLOAD_PAGE_CONFIG,
      updateAdminDownloadPageConfig: async (input) => ({ ...DEFAULT_TOOLS_DOWNLOAD_PAGE_CONFIG, ...input }),
      listAdminDownloads: async () => ({ page: 1, page_size: 20, total: 0, items: [] }),
      createDownload: async (payload) => {
        createdPayloads.push(payload);
        return {
          id: 3,
          slug: payload.slug,
          name: payload.name,
          summary: payload.summary,
          description: payload.description,
          platforms: payload.platforms,
          platform_versions: payload.platform_versions,
          icon_url: payload.icon_url || '',
          local_file_url: payload.local_file_url || '',
          official_url: payload.official_url || '',
          primary_action: payload.primary_action,
          version: payload.version || '',
          file_size_label: payload.file_size_label || '',
          download_count: 0,
          is_hot: Boolean(payload.is_hot),
          sort_order: payload.sort_order || 0,
          status: 'draft',
          published_at: null,
          created_at: '2026-07-08 09:00:00',
          updated_at: '2026-07-08 09:00:00',
        };
      },
      updateDownloadStatus: async (_id, status) => {
        currentStatus = status;
        return {
          id: 3,
          slug: 'v2rayn',
          name: 'v2rayN',
          summary: 'Windows 客户端',
          description: '',
          platforms: ['windows'],
          platform_versions: { windows: 'Windows 10/11' },
          icon_url: '',
          local_file_url: '',
          official_url: 'https://github.com/2dust/v2rayN',
          primary_action: 'official',
          version: '',
          file_size_label: '',
          download_count: 0,
          is_hot: true,
          sort_order: 1,
          status,
          published_at: status === 'published' ? '2026-07-08 10:00:00' : null,
          created_at: '2026-07-08 09:00:00',
          updated_at: '2026-07-08 10:00:00',
        };
      },
    } as never,
  }));
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const configResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/tools/download-page`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-admin-actor': 'tester' },
      body: JSON.stringify({ seo_title: '自定义翻墙工具下载页' }),
    });
    assert.equal(configResponse.status, 200);
    const config = await configResponse.json() as { seo_title: string };
    assert.equal(config.seo_title, '自定义翻墙工具下载页');

    const createResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/tools/downloads`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-actor': 'tester' },
      body: JSON.stringify({
        slug: 'v2rayn',
        name: 'v2rayN',
        summary: 'Windows 翻墙工具',
        platforms: ['windows'],
        platform_versions: { windows: 'Windows 10/11' },
        official_url: 'https://github.com/2dust/v2rayN',
        primary_action: 'official',
      }),
    });
    assert.equal(createResponse.status, 201);
    assert.equal(createdPayloads.length, 1);
    assert.deepEqual((createdPayloads[0] as { platform_versions?: Record<string, string> }).platform_versions, { windows: 'Windows 10/11' });

    const publishResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/tools/downloads/3/publish`, {
      method: 'POST',
      headers: { 'x-admin-actor': 'tester' },
    });
    assert.equal(publishResponse.status, 200);
    assert.equal(currentStatus, 'published');
    assert.deepEqual(auditActions, ['update_tools_download_page', 'create_tool_download', 'publish_tool_download']);
    assert.equal(publicCacheClears, 3);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('tools admin routes return conflict when tool download slug already exists', async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'tools-duplicate-test';
    next();
  });
  app.use('/api/v1/admin', createToolsAdminRoutes({
    auditRepository: {
      log: async () => {},
    } as never,
    toolsDownloadService: {
      getAdminDownloadPageConfig: async () => DEFAULT_TOOLS_DOWNLOAD_PAGE_CONFIG,
      updateAdminDownloadPageConfig: async (input) => ({ ...DEFAULT_TOOLS_DOWNLOAD_PAGE_CONFIG, ...input }),
      listAdminDownloads: async () => ({ page: 1, page_size: 20, total: 0, items: [] }),
      createDownload: async () => {
        throw Object.assign(new Error('Duplicate entry'), {
          code: 'ER_DUP_ENTRY',
          sqlMessage: 'Duplicate entry for key uk_tool_download_items_slug',
        });
      },
      updateDownload: async () => ({}),
      updateDownloadStatus: async () => ({}),
    } as never,
  }));
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/admin/tools/downloads`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        slug: 'clash-verge-rev',
        name: 'Clash Verge Rev',
        summary: 'macOS 客户端',
        platforms: ['macos'],
        primary_action: 'local',
      }),
    });
    assert.equal(response.status, 409);
    const data = await response.json() as { message: string };
    assert.match(data.message, /slug 已存在/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('tools admin routes recover recent uploaded tool file by size and extension', async () => {
  const previousUploadRoot = process.env.NEWS_UPLOAD_ROOT_DIR;
  const uploadRoot = await mkdtemp(path.join(tmpdir(), 'gaterank-tool-upload-'));
  process.env.NEWS_UPLOAD_ROOT_DIR = uploadRoot;
  const filesDir = path.join(uploadRoot, 'tools', 'files');
  await mkdir(filesDir, { recursive: true });
  await writeFile(path.join(filesDir, '1783499000000-recovered.dmg'), Buffer.alloc(2048));
  await writeFile(path.join(filesDir, '1783499000000-recovered.dmg.meta.json'), JSON.stringify({
    original_name: 'Clash.Verge_2.5.1_aarch64.dmg',
    size: 2048,
    uploaded_at: new Date().toISOString(),
  }));

  const app = express();
  app.use((req, _res, next) => {
    req.requestId = 'tools-recover-test';
    next();
  });
  app.use('/api/v1/admin', createToolsAdminRoutes({
    auditRepository: {
      log: async () => {},
    } as never,
    toolsDownloadService: {
      getAdminDownloadPageConfig: async () => DEFAULT_TOOLS_DOWNLOAD_PAGE_CONFIG,
      updateAdminDownloadPageConfig: async (input) => ({ ...DEFAULT_TOOLS_DOWNLOAD_PAGE_CONFIG, ...input }),
      listAdminDownloads: async () => ({ page: 1, page_size: 20, total: 0, items: [] }),
      createDownload: async () => ({}),
      updateDownload: async () => ({}),
      updateDownloadStatus: async () => ({}),
    } as never,
  }));
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(
      `http://127.0.0.1:${port}/api/v1/admin/tools/upload-file/recent?size=2048&extension=.dmg&since_seconds=600`,
    );
    assert.equal(response.status, 200);
    const data = await response.json() as { url: string; file_size_label: string };
    assert.equal((data as { original_name?: string }).original_name, 'Clash.Verge_2.5.1_aarch64.dmg');
    assert.equal(data.url, '/uploads/tools/files/1783499000000-recovered.dmg');
    assert.equal(data.file_size_label, '2.0 KB');

    const recentResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/tools/uploads/recent?limit=5`);
    assert.equal(recentResponse.status, 200);
    const recent = await recentResponse.json() as { items: Array<{ url: string; original_name: string }> };
    assert.equal(recent.items[0].url, '/uploads/tools/files/1783499000000-recovered.dmg');
    assert.equal(recent.items[0].original_name, 'Clash.Verge_2.5.1_aarch64.dmg');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    if (previousUploadRoot === undefined) {
      delete process.env.NEWS_UPLOAD_ROOT_DIR;
    } else {
      process.env.NEWS_UPLOAD_ROOT_DIR = previousUploadRoot;
    }
    await rm(uploadRoot, { recursive: true, force: true });
  }
});

test('tools admin routes accept chunked tool file upload and complete final package', async () => {
  const previousUploadRoot = process.env.NEWS_UPLOAD_ROOT_DIR;
  const uploadRoot = await mkdtemp(path.join(tmpdir(), 'gaterank-tool-chunk-upload-'));
  process.env.NEWS_UPLOAD_ROOT_DIR = uploadRoot;
  const auditActions: string[] = [];

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'tools-chunk-test';
    next();
  });
  app.use('/api/v1/admin', createToolsAdminRoutes({
    auditRepository: {
      log: async (action: string) => { auditActions.push(action); },
    } as never,
    publicPageCache: { clear: () => {} },
    toolsDownloadService: {
      getAdminDownloadPageConfig: async () => DEFAULT_TOOLS_DOWNLOAD_PAGE_CONFIG,
      updateAdminDownloadPageConfig: async (input) => ({ ...DEFAULT_TOOLS_DOWNLOAD_PAGE_CONFIG, ...input }),
      listAdminDownloads: async () => ({ page: 1, page_size: 20, total: 0, items: [] }),
      createDownload: async () => ({}),
      updateDownload: async () => ({}),
      updateDownloadStatus: async () => ({}),
    } as never,
  }));
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const uploadId = '11111111-1111-4111-8111-111111111111';
    const originalName = 'Clash.Verge_2.5.1_aarch64.dmg';
    const chunks = [Buffer.from('hello-'), Buffer.from('world')];
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);

    for (const [index, chunk] of chunks.entries()) {
      const form = new FormData();
      form.set('upload_id', uploadId);
      form.set('chunk_index', String(index));
      form.set('total_chunks', String(chunks.length));
      form.set('original_name', originalName);
      form.set('total_size', String(totalSize));
      form.set('file', new Blob([chunk], { type: 'application/octet-stream' }), originalName);

      const response = await fetch(`http://127.0.0.1:${port}/api/v1/admin/tools/upload-file/chunk`, {
        method: 'POST',
        body: form,
      });
      assert.equal(response.status, 201);
    }

    const completeResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/tools/upload-file/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        upload_id: uploadId,
        original_name: originalName,
        total_chunks: chunks.length,
        total_size: totalSize,
      }),
    });
    assert.equal(completeResponse.status, 201);
    const completed = await completeResponse.json() as {
      url: string;
      filename: string;
      original_name: string;
      file_size_label: string;
    };
    assert.match(completed.url, /^\/uploads\/tools\/files\/.+\.dmg$/);
    assert.equal(completed.original_name, originalName);
    assert.equal(completed.file_size_label, '11 B');

    const written = await readFile(path.join(uploadRoot, 'tools', 'files', completed.filename), 'utf8');
    assert.equal(written, 'hello-world');
    assert.deepEqual(auditActions, ['upload_tool_file_chunked']);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    if (previousUploadRoot === undefined) {
      delete process.env.NEWS_UPLOAD_ROOT_DIR;
    } else {
      process.env.NEWS_UPLOAD_ROOT_DIR = previousUploadRoot;
    }
    await rm(uploadRoot, { recursive: true, force: true });
  }
});

function createIpCheckResult(ip: string): IpCheckResult {
  return {
    ip,
    country: 'United States',
    country_code: 'US',
    region: 'VA',
    region_name: 'Virginia',
    city: 'Ashburn',
    postal_code: '20149',
    latitude: 39.03,
    longitude: -77.5,
    timezone: 'America/New_York',
    isp: 'Google LLC',
    organization: 'Google Public DNS',
    asn: 'AS15169 Google LLC',
  };
}
