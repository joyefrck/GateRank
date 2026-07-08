import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildToolDownloadPlatformHeading,
  buildToolDownloadTrustMeta,
} from '../../shared/toolDownloads';

test('tool download platform headings use SEO-friendly platform H2 text', () => {
  assert.equal(buildToolDownloadPlatformHeading('windows'), 'Windows 翻墙工具下载');
  assert.equal(buildToolDownloadPlatformHeading('macos'), 'macOS 翻墙工具下载');
  assert.equal(buildToolDownloadPlatformHeading('android'), 'Android 翻墙工具下载');
  assert.equal(buildToolDownloadPlatformHeading('ios'), 'iOS 翻墙工具下载');
  assert.equal(buildToolDownloadPlatformHeading('linux'), 'Linux 翻墙工具下载');
});

test('tool download trust meta shows version and published date', () => {
  assert.equal(
    buildToolDownloadTrustMeta({
      version: 'v2.3.4',
      published_at: '2026-07-08 09:30:00',
      updated_at: '2026-07-09 10:00:00',
    }),
    '版本：v2.3.4 · 发布：2026-07-08',
  );
});

test('tool download trust meta falls back to official page version and updated date', () => {
  assert.equal(
    buildToolDownloadTrustMeta({
      version: '',
      published_at: null,
      updated_at: '2026-07-07T11:12:13.000Z',
    }),
    '版本：以官方发布页为准 · 发布：2026-07-07',
  );
});
