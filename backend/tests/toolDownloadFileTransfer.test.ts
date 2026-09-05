import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createPublicPageRoutes } from '../src/routes/publicPageRoutes';

test('controlled file response provides real length, original name and unchanged bytes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'gaterank-transfer-'));
  const content = Buffer.alloc(1024 * 1024, 65);
  const absolutePath = join(directory, 'package.zip'); await writeFile(absolutePath, content);
  let downloads = 0;
  const app = express();
  app.use(createPublicPageRoutes({ publicViewService: {} as never, toolsDownloadService: {
    getDownloadFileTarget: async () => ({ item: { id: 1 }, platform: 'windows', absolutePath, downloadFilename: '安装包.zip' }),
    recordDownload: async () => downloads++,
  } as never }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/download/file/transfer?platform=windows`, {
      headers: { 'user-agent': 'Mozilla/5.0 GateRank test', 'accept-language': 'zh-CN' },
    });
    assert.equal(response.status, 200);
    assert.equal(Number(response.headers.get('content-length')), content.length);
    assert.match(response.headers.get('content-disposition') || '', /filename\*=UTF-8''%E5%AE%89/);
    const hash = (value: Buffer) => createHash('sha256').update(value).digest('hex');
    assert.equal(hash(Buffer.from(await response.arrayBuffer())), hash(content));
    assert.equal(downloads, 1);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true });
  }
});
