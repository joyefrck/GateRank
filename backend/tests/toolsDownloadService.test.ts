import assert from 'node:assert/strict';
import test from 'node:test';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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
    content_updated_at: null,
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

test('ToolsDownloadService stamps admin content edits independently from generic row updates', async () => {
  let capturedUpdate: Record<string, unknown> | undefined;
  const existing = createDownloadServiceItem();
  const repository = {
    getById: async () => existing,
    update: async (_id: number, input: Record<string, unknown>) => {
      capturedUpdate = input;
      return true;
    },
  };
  const service = new ToolsDownloadService(
    repository as never,
    { getByKey: async () => null } as never,
  );

  await service.updateDownload(1, { version: '2.5.2' });

  assert.equal(capturedUpdate?.version, '2.5.2');
  assert.match(
    String(capturedUpdate?.content_updated_at),
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
  );
});

test('ToolsDownloadService deletes an unreferenced old package after replacement is saved', async () => {
  const uploadRoot = await mkdtemp(path.join(os.tmpdir(), 'gaterank-tool-replace-'));
  const previousUploadRoot = process.env.NEWS_UPLOAD_ROOT_DIR;
  process.env.NEWS_UPLOAD_ROOT_DIR = uploadRoot;
  try {
    const oldFilename = '1783493370824-old-package.dmg';
    const oldUrl = `/uploads/tools/files/${oldFilename}`;
    const newUrl = '/uploads/tools/files/1783493370825-new-package.dmg';
    const fileDir = path.join(uploadRoot, 'tools', 'files');
    const oldPath = path.join(fileDir, oldFilename);
    const oldMetadataPath = `${oldPath}.meta.json`;
    await mkdir(fileDir, { recursive: true });
    await writeFile(oldPath, 'old-package');
    await writeFile(oldMetadataPath, '{}');

    let item = createDownloadServiceItem({ local_file_url: oldUrl });
    const repository = {
      getById: async () => item,
      update: async (_id: number, input: Record<string, unknown>) => {
        item = { ...item, local_file_url: String(input.local_file_url || '') };
        return true;
      },
      countByLocalFileUrl: async () => 0,
    };
    const service = new ToolsDownloadService(
      repository as never,
      { getByKey: async () => null } as never,
    );

    await service.updateDownload(1, { local_file_url: newUrl });

    await assert.rejects(access(oldPath));
    await assert.rejects(access(oldMetadataPath));
  } finally {
    if (previousUploadRoot === undefined) delete process.env.NEWS_UPLOAD_ROOT_DIR;
    else process.env.NEWS_UPLOAD_ROOT_DIR = previousUploadRoot;
    await rm(uploadRoot, { recursive: true, force: true });
  }
});

test('ToolsDownloadService preserves an old package that is still referenced', async () => {
  const uploadRoot = await mkdtemp(path.join(os.tmpdir(), 'gaterank-tool-shared-'));
  const previousUploadRoot = process.env.NEWS_UPLOAD_ROOT_DIR;
  process.env.NEWS_UPLOAD_ROOT_DIR = uploadRoot;
  try {
    const oldFilename = '1783493370824-shared-package.dmg';
    const oldUrl = `/uploads/tools/files/${oldFilename}`;
    const fileDir = path.join(uploadRoot, 'tools', 'files');
    const oldPath = path.join(fileDir, oldFilename);
    await mkdir(fileDir, { recursive: true });
    await writeFile(oldPath, 'shared-package');

    let item = createDownloadServiceItem({ local_file_url: oldUrl });
    const repository = {
      getById: async () => item,
      update: async (_id: number, input: Record<string, unknown>) => {
        item = { ...item, local_file_url: String(input.local_file_url || '') };
        return true;
      },
      countByLocalFileUrl: async () => 1,
    };
    const service = new ToolsDownloadService(
      repository as never,
      { getByKey: async () => null } as never,
    );

    await service.updateDownload(1, {
      local_file_url: '/uploads/tools/files/1783493370825-new-package.dmg',
    });

    await access(oldPath);
  } finally {
    if (previousUploadRoot === undefined) delete process.env.NEWS_UPLOAD_ROOT_DIR;
    else process.env.NEWS_UPLOAD_ROOT_DIR = previousUploadRoot;
    await rm(uploadRoot, { recursive: true, force: true });
  }
});

test('ToolsDownloadService never deletes the old package when replacement save fails', async () => {
  const uploadRoot = await mkdtemp(path.join(os.tmpdir(), 'gaterank-tool-failed-replace-'));
  const previousUploadRoot = process.env.NEWS_UPLOAD_ROOT_DIR;
  process.env.NEWS_UPLOAD_ROOT_DIR = uploadRoot;
  try {
    const oldFilename = '1783493370824-kept-package.dmg';
    const oldUrl = `/uploads/tools/files/${oldFilename}`;
    const fileDir = path.join(uploadRoot, 'tools', 'files');
    const oldPath = path.join(fileDir, oldFilename);
    await mkdir(fileDir, { recursive: true });
    await writeFile(oldPath, 'kept-package');

    const item = createDownloadServiceItem({ local_file_url: oldUrl });
    const service = new ToolsDownloadService(
      {
        getById: async () => item,
        update: async () => false,
        countByLocalFileUrl: async () => 0,
      } as never,
      { getByKey: async () => null } as never,
    );

    await assert.rejects(() => service.updateDownload(1, {
      local_file_url: '/uploads/tools/files/1783493370825-new-package.dmg',
    }));

    await access(oldPath);
  } finally {
    if (previousUploadRoot === undefined) delete process.env.NEWS_UPLOAD_ROOT_DIR;
    else process.env.NEWS_UPLOAD_ROOT_DIR = previousUploadRoot;
    await rm(uploadRoot, { recursive: true, force: true });
  }
});

test('ToolsDownloadService enriches admin items with the original package filename', async () => {
  const uploadRoot = await mkdtemp(path.join(os.tmpdir(), 'gaterank-tool-admin-name-'));
  const previousUploadRoot = process.env.NEWS_UPLOAD_ROOT_DIR;
  process.env.NEWS_UPLOAD_ROOT_DIR = uploadRoot;
  try {
    const filename = '1783493370824-storage-id.dmg';
    const fileDir = path.join(uploadRoot, 'tools', 'files');
    await mkdir(fileDir, { recursive: true });
    await writeFile(path.join(fileDir, filename), 'fixture');
    await writeToolUploadMetadata('files', filename, {
      original_name: 'Clash.Verge_2.5.2_x64.dmg',
      size: 7,
    });
    const item = createDownloadServiceItem({
      local_file_url: `/uploads/tools/files/${filename}`,
    });
    const service = new ToolsDownloadService(
      {
        listByQuery: async () => ({ items: [item], total: 1 }),
      } as never,
      { getByKey: async () => null } as never,
    );

    const result = await service.listAdminDownloads();

    assert.equal(result.items[0].local_file_name, 'Clash.Verge_2.5.2_x64.dmg');
  } finally {
    if (previousUploadRoot === undefined) delete process.env.NEWS_UPLOAD_ROOT_DIR;
    else process.env.NEWS_UPLOAD_ROOT_DIR = previousUploadRoot;
    await rm(uploadRoot, { recursive: true, force: true });
  }
});

function createDownloadServiceItem(input: Partial<ToolDownloadItem> = {}): ToolDownloadItem {
  return {
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
    version: '2.5.1',
    file_size_label: '62.7 MB',
    download_count: 21,
    is_hot: false,
    sort_order: 1,
    status: 'published',
    published_at: '2026-07-08 18:29:01',
    content_updated_at: null,
    created_at: '2026-07-08 18:28:58',
    updated_at: '2026-07-25 00:12:29',
    ...input,
  };
}
