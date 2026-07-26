import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_TOOLS_DOWNLOAD_PAGE_CONFIG,
  buildHomeToolDownloadCta,
  buildToolDownloadPlatformHeading,
  buildToolDownloadTrustMeta,
  resolveToolDownloadCtaCopy,
} from '../../shared/toolDownloads';

test('tool download CTA copy follows ranking and report context', () => {
  const cta = buildHomeToolDownloadCta([]);

  assert.equal(
    resolveToolDownloadCtaCopy(cta, { context: 'ranking' }).description,
    '按 Android、macOS、Windows、Linux 选择常用客户端，下载后可继续导入机场订阅。',
  );
  assert.equal(
    resolveToolDownloadCtaCopy(cta, {
      context: 'report',
      airportName: '星云机场',
      supportedClients: ['Clash', 'Shadowrocket', 'v2rayN', 'v2rayNG'],
    }).description,
    '星云机场已收录的客户端支持包括 Clash、Shadowrocket、v2rayN 等客户端，可按设备系统前往下载并导入订阅。',
  );
});

test('tool download platform headings use SEO-friendly platform H2 text', () => {
  assert.equal(buildToolDownloadPlatformHeading('windows'), 'Windows 翻墙工具下载');
  assert.equal(buildToolDownloadPlatformHeading('macos'), 'macOS 翻墙工具下载');
  assert.equal(buildToolDownloadPlatformHeading('android'), 'Android 翻墙工具下载');
  assert.equal(buildToolDownloadPlatformHeading('ios'), 'iOS 翻墙工具下载');
  assert.equal(buildToolDownloadPlatformHeading('linux'), 'Linux 翻墙工具下载');
});

test('tool download trust meta shows version and latest admin content date', () => {
  assert.equal(
    buildToolDownloadTrustMeta({
      version: 'v2.3.4',
      published_at: '2026-07-08 09:30:00',
      content_updated_at: '2026-07-09 10:00:00',
      updated_at: '2026-07-25 10:00:00',
    }),
    '版本：v2.3.4 · 发布：2026-07-09',
  );
});

test('tool download trust meta ignores generic row updates and falls back to published date', () => {
  assert.equal(
    buildToolDownloadTrustMeta({
      version: '2.5.1',
      published_at: '2026-07-08 18:29:01',
      content_updated_at: null,
      updated_at: '2026-07-25 00:12:29',
    }),
    '版本：2.5.1 · 发布：2026-07-08',
  );
});

test('tool download trust meta falls back to official page version and pending date', () => {
  assert.equal(
    buildToolDownloadTrustMeta({
      version: '',
      published_at: null,
      content_updated_at: null,
      updated_at: '2026-07-07T11:12:13.000Z',
    }),
    '版本：以官方发布页为准 · 发布：待补充',
  );
});

test('default tool download FAQ covers long-tail SEO questions', () => {
  const questions = DEFAULT_TOOLS_DOWNLOAD_PAGE_CONFIG.faq_items.map((item) => item.question);

  assert.equal(questions.length, 10);
  assert.deepEqual(questions, [
    'Windows 翻墙工具推荐哪个？',
    'iPhone 用什么翻墙工具？',
    'Android 用 v2rayNG 还是 Karing？',
    'Clash Verge Rev 和 v2rayN 有什么区别？',
    'Clash Verge Rev 怎么导入机场订阅？',
    'v2rayN 怎么导入订阅链接？',
    '为什么下载客户端后还不能翻墙？',
    '机场订阅链接是什么？',
    '本地下载和官方下载有什么区别？',
    'Shadowrocket 为什么需要美区 Apple ID？',
  ]);
  assert.match(
    DEFAULT_TOOLS_DOWNLOAD_PAGE_CONFIG.faq_items[2].answer,
    /v2rayNG 更轻量.*Karing 界面更完整/s,
  );
});
