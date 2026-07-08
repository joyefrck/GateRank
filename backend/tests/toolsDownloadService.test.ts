import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_TOOLS_DOWNLOAD_PAGE_CONFIG, type ToolsDownloadPageConfig } from '../../shared/toolDownloads';
import { ToolsDownloadService } from '../src/services/toolsDownloadService';

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
