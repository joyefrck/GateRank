import assert from 'node:assert/strict';
import test from 'node:test';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { deleteToolUploadFile } from '../src/utils/toolUpload';

test('deleteToolUploadFile removes a managed package and its metadata', async () => {
  const uploadRoot = await mkdtemp(path.join(os.tmpdir(), 'gaterank-tool-delete-'));
  const previousUploadRoot = process.env.NEWS_UPLOAD_ROOT_DIR;
  process.env.NEWS_UPLOAD_ROOT_DIR = uploadRoot;
  try {
    const filename = '1783493370824-old-package.dmg';
    const fileDir = path.join(uploadRoot, 'tools', 'files');
    const filePath = path.join(fileDir, filename);
    const metadataPath = `${filePath}.meta.json`;
    await mkdir(fileDir, { recursive: true });
    await writeFile(filePath, 'old-package');
    await writeFile(metadataPath, '{}');

    const removed = await deleteToolUploadFile(`/uploads/tools/files/${filename}`);

    assert.equal(removed, true);
    await assert.rejects(access(filePath));
    await assert.rejects(access(metadataPath));
  } finally {
    if (previousUploadRoot === undefined) delete process.env.NEWS_UPLOAD_ROOT_DIR;
    else process.env.NEWS_UPLOAD_ROOT_DIR = previousUploadRoot;
    await rm(uploadRoot, { recursive: true, force: true });
  }
});

test('deleteToolUploadFile refuses URLs outside the managed package directory', async () => {
  assert.equal(await deleteToolUploadFile('/uploads/news/cover.webp'), false);
  assert.equal(await deleteToolUploadFile('/uploads/tools/files/../icons/icon.webp'), false);
});
