import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
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
    assert.ok((metadata.width || 0) <= 1280);
    assert.ok((metadata.height || 0) <= 720);
  } finally {
    delete process.env.NEWS_UPLOAD_ROOT_DIR;
    rmSync(uploadRoot, { recursive: true, force: true });
  }
});

test('news cover image service creates SEO compressed pexels covers', async () => {
  const uploadRoot = mkdtempSync(path.join(os.tmpdir(), 'gaterank-cover-'));
  process.env.NEWS_UPLOAD_ROOT_DIR = uploadRoot;

  try {
    const service = new NewsCoverImageService();
    const width = 1800;
    const height = 1200;
    const raw = Buffer.alloc(width * height * 3);
    for (let index = 0; index < raw.length; index += 3) {
      const pixel = index / 3;
      raw[index] = pixel % 251;
      raw[index + 1] = (pixel * 7) % 241;
      raw[index + 2] = (pixel * 13) % 239;
    }
    const source = await sharp(raw, { raw: { width, height, channels: 3 } })
      .png()
      .toBuffer();

    const result = await service.compressCoverBuffer(source, {
      contextSlug: '../Runaway Airport Monitoring!!',
      pexelsId: 123456,
      alt: 'Runway skyline at dusk',
    });

    assert.match(result.url, /^\/uploads\/news\/runaway-airport-monitoring-pexels-123456\.webp$/);
    const outputPath = path.join(uploadRoot, result.url.replace('/uploads/', ''));
    const metadata = await sharp(outputPath).metadata();
    assert.equal(metadata.format, 'webp');
    assert.equal(metadata.width, 1280);
    assert.equal(metadata.height, 720);
    assert.equal(Math.round(((metadata.width || 0) / (metadata.height || 1)) * 100), 178);
    assert.ok(statSync(outputPath).size < source.byteLength);
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
