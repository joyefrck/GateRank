import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  DEFAULT_TOOLS_DOWNLOAD_PAGE_CONFIG,
  type ToolDownloadItem,
  type ToolsDownloadPageConfig,
} from '../../shared/toolDownloads';
import { ToolsDownloadService } from '../src/services/toolsDownloadService';
import { writeToolUploadMetadata } from '../src/utils/toolUpload';

const OLD_DEFAULT_FAQ_ITEMS = [
  {
    question: '翻墙工具和机场 VPN 是一回事吗？',
    answer: '不是。机场通常提供订阅链接和节点服务，翻墙工具或科学上网客户端负责导入订阅并连接节点。',
  },
  {
    question: '下载客户端后可以直接使用吗？',
    answer: '通常还需要机场订阅链接或节点配置。可以先在 GateRank 查看机场排行和测评，再把订阅导入对应客户端。',
  },
  {
    question: '为什么优先展示官方页面？',
    answer: '代理客户端属于网络安全敏感软件，官方发布页和后台明确上传的文件更容易追踪来源、版本和更新状态。',
  },
];

function createService(storedConfig?: Partial<ToolsDownloadPageConfig>) {
  return new ToolsDownloadService(
    {
      listPublished: async () => ({ items: [], total: 0 }),
    } as never,
    {
      getByKey: async () => (storedConfig === undefined ? null : {
        id: 1,
        setting_key: 'tools_download_page',
        value_json: storedConfig,
        updated_by: 'admin',
        created_at: '2026-07-08 00:00:00',
        updated_at: '2026-07-08 00:00:00',
      }),
      upsert: async () => undefined,
    } as never,
  );
}

function createDownloadService(input: Partial<ToolDownloadItem> = {}) {
  const item: ToolDownloadItem = {
    id: 1,
    slug: 'clash-verge-macos',
    name: 'Clash Verge',
    summary: 'macOS 客户端',
    description: 'macOS 客户端',
    platforms: ['macos'],
    platform_versions: { macos: 'macOS 12+' },
    icon_url: '',
    local_file_url: '',
    official_url: '',
    primary_action: 'local',
    version: '2.5.2',
    file_size_label: '44.8 MB',
    download_count: 0,
    is_hot: true,
    sort_order: 1,
    status: 'published',
    published_at: '2026-07-08 09:00:00',
    created_at: '2026-07-08 09:00:00',
    updated_at: '2026-07-09 09:00:00',
    ...input,
  };
  return new ToolsDownloadService(
    {
      getBySlug: async () => item,
    } as never,
    {
      getByKey: async () => null,
    } as never,
  );
}

test('ToolsDownloadService uses expanded default FAQ when page config is missing', async () => {
  const view = await createService().getDownloadPageView();

  assert.equal(view.config.faq_items.length, 10);
  assert.equal(view.config.faq_items[0].question, 'Windows 翻墙工具推荐哪个？');
});

test('ToolsDownloadService upgrades the old default three-question FAQ', async () => {
  const view = await createService({
    ...DEFAULT_TOOLS_DOWNLOAD_PAGE_CONFIG,
    faq_items: OLD_DEFAULT_FAQ_ITEMS,
  }).getDownloadPageView();

  assert.equal(view.config.faq_items.length, 10);
  assert.equal(view.config.faq_items[9].question, 'Shadowrocket 为什么需要美区 Apple ID？');
});

test('ToolsDownloadService preserves custom configured FAQ items', async () => {
  const customFaq = [
    { question: '自定义问题？', answer: '保留后台自定义 FAQ。' },
  ];
  const view = await createService({
    ...DEFAULT_TOOLS_DOWNLOAD_PAGE_CONFIG,
    faq_items: customFaq,
  }).getDownloadPageView();

  assert.deepEqual(view.config.faq_items, customFaq);
});

test('ToolsDownloadService preserves the original uploaded filename', async () => {
  const uploadRoot = await mkdtemp(path.join(os.tmpdir(), 'gaterank-tool-download-'));
  const previousUploadRoot = process.env.NEWS_UPLOAD_ROOT_DIR;
  process.env.NEWS_UPLOAD_ROOT_DIR = uploadRoot;
  try {
    const filename = '1783493370824-storage-id.dmg';
    const fileDir = path.join(uploadRoot, 'tools', 'files');
    await mkdir(fileDir, { recursive: true });
    await writeFile(path.join(fileDir, filename), 'fixture');
    await writeToolUploadMetadata('files', filename, {
      original_name: 'Clash.Verge_2.5.1_aarch64.dmg',
      size: 7,
    });

    const service = createDownloadService({
      local_file_url: `/uploads/tools/files/${filename}`,
    });
    const target = await service.getDownloadFileTarget('clash-verge-macos', 'macos');

    assert.equal(target.downloadFilename, 'Clash.Verge_2.5.1_aarch64.dmg');
  } finally {
    if (previousUploadRoot === undefined) delete process.env.NEWS_UPLOAD_ROOT_DIR;
    else process.env.NEWS_UPLOAD_ROOT_DIR = previousUploadRoot;
    await rm(uploadRoot, { recursive: true, force: true });
  }
});

test('ToolsDownloadService falls back to the stored filename when upload metadata is absent', async () => {
  const uploadRoot = await mkdtemp(path.join(os.tmpdir(), 'gaterank-tool-download-'));
  const previousUploadRoot = process.env.NEWS_UPLOAD_ROOT_DIR;
  process.env.NEWS_UPLOAD_ROOT_DIR = uploadRoot;
  try {
    const filename = 'legacy-storage-name.dmg';
    const fileDir = path.join(uploadRoot, 'tools', 'files');
    await mkdir(fileDir, { recursive: true });
    await writeFile(path.join(fileDir, filename), 'fixture');

    const service = createDownloadService({
      local_file_url: `/uploads/tools/files/${filename}`,
    });
    const target = await service.getDownloadFileTarget('clash-verge-macos', 'macos');

    assert.equal(target.downloadFilename, filename);
  } finally {
    if (previousUploadRoot === undefined) delete process.env.NEWS_UPLOAD_ROOT_DIR;
    else process.env.NEWS_UPLOAD_ROOT_DIR = previousUploadRoot;
    await rm(uploadRoot, { recursive: true, force: true });
  }
});
