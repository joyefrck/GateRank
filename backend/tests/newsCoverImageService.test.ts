import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { HttpError } from '../src/middleware/errorHandler';
import { NewsCoverImageService } from '../src/services/newsCoverImageService';

test('news cover image service compresses large images to webp within max bounds', async () => {
  const uploadRoot = mkdtempSync(path.join(os.tmpdir(), 'gaterank-cover-'));
  process.env.NEWS_UPLOAD_ROOT_DIR = uploadRoot;

  try {
    const service = new NewsCoverImageService();
    const source = await sharp({
      create: {
        width: 3200,
        height: 1800,
        channels: 3,
        background: { r: 32, g: 48, b: 64 },
      },
    })
      .png()
      .toBuffer();

    const result = await service.compressCoverBuffer(source);
    assert.match(result.url, /^\/uploads\/news\/.+\.webp$/);

    const metadata = await sharp(path.join(uploadRoot, result.url.replace('/uploads/', ''))).metadata();
    assert.equal(metadata.format, 'webp');
    assert.ok((metadata.width || 0) <= 1600);
    assert.ok((metadata.height || 0) <= 900);
  } finally {
    delete process.env.NEWS_UPLOAD_ROOT_DIR;
    rmSync(uploadRoot, { recursive: true, force: true });
  }
});

test('news cover image service does not enlarge small images', async () => {
  const uploadRoot = mkdtempSync(path.join(os.tmpdir(), 'gaterank-cover-'));
  process.env.NEWS_UPLOAD_ROOT_DIR = uploadRoot;

  try {
    const service = new NewsCoverImageService();
    const source = await sharp({
      create: {
        width: 400,
        height: 225,
        channels: 3,
        background: { r: 80, g: 24, b: 12 },
      },
    })
      .jpeg()
      .toBuffer();

    const result = await service.compressCoverBuffer(source);
    const metadata = await sharp(path.join(uploadRoot, result.url.replace('/uploads/', ''))).metadata();
    assert.equal(metadata.width, 400);
    assert.equal(metadata.height, 225);
  } finally {
    delete process.env.NEWS_UPLOAD_ROOT_DIR;
    rmSync(uploadRoot, { recursive: true, force: true });
  }
});

test('news cover image service compresses uploaded cover files and removes original file', async () => {
  const uploadRoot = mkdtempSync(path.join(os.tmpdir(), 'gaterank-cover-'));
  process.env.NEWS_UPLOAD_ROOT_DIR = uploadRoot;

  try {
    const service = new NewsCoverImageService();
    const originalPath = path.join(uploadRoot, 'raw.png');
    const source = await sharp({
      create: {
        width: 2000,
        height: 1125,
        channels: 3,
        background: { r: 120, g: 80, b: 40 },
      },
    })
      .png()
      .toBuffer();
    writeFileSync(originalPath, source);

    const result = await service.compressUploadedCover(originalPath);
    assert.match(result.url, /^\/uploads\/news\/.+\.webp$/);
    assert.equal(existsSync(originalPath), false);
  } finally {
    delete process.env.NEWS_UPLOAD_ROOT_DIR;
    rmSync(uploadRoot, { recursive: true, force: true });
  }
});

test('news cover image service rejects invalid images', async () => {
  const uploadRoot = mkdtempSync(path.join(os.tmpdir(), 'gaterank-cover-'));
  process.env.NEWS_UPLOAD_ROOT_DIR = uploadRoot;

  try {
    const service = new NewsCoverImageService();
    await assert.rejects(
      () => service.compressCoverBuffer(Buffer.from('not-an-image')),
      (error: unknown) => error instanceof HttpError && error.message === '封面图片处理失败，请更换图片后重试',
    );
  } finally {
    delete process.env.NEWS_UPLOAD_ROOT_DIR;
    rmSync(uploadRoot, { recursive: true, force: true });
  }
});
