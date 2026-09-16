import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import express from 'express';
import sharp from 'sharp';
import { createNewsImageRoutes } from '../src/routes/newsImageRoutes';

test('news thumbnails resize existing images, revalidate, and reject unsafe requests', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'news-thumbnails-'));
  const app = express();
  app.use(createNewsImageRoutes(root));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/uploads/news`;
  try {
    await sharp({ create: { width: 1200, height: 600, channels: 3, background: '#397788' } }).png().toFile(path.join(root, 'cover.png'));
    const original = await fetch(`${base}/cover.png`);
    assert.equal(original.headers.get('cache-control'), 'public, max-age=86400');
    const originalBuffer = Buffer.from(await original.arrayBuffer());
    const response = await fetch(`${base}/cover.png?w=320`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/webp');
    const buffer = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(buffer).metadata();
    assert.equal(metadata.width, 320);
    assert.equal(metadata.height, 160);
    assert.ok(buffer.length < originalBuffer.length);
    const cached = await fetch(`${base}/cover.png?w=320`, { headers: { 'If-None-Match': response.headers.get('etag')!, 'Cache-Control': 'max-age=0' } });
    assert.equal(cached.status, 304);
    for (const suffix of ['cover.png?w=100000', 'cover.png?w=320&w=640', 'cover.png?w=https://example.com', 'cover.svg?w=320', '..%2Fcover.png?w=320']) {
      assert.equal((await fetch(`${base}/${suffix}`)).status, 400, suffix);
    }
    await symlink(path.join(root, '..'), path.join(root, 'escape.png'));
    assert.equal((await fetch(`${base}/escape.png?w=320`)).status, 404);
    assert.equal((await fetch(`${base}/missing.png?w=320`)).status, 404);
    await writeFile(path.join(root, 'legacy.jpg'), 'unsupported legacy bytes');
    assert.equal(await (await fetch(`${base}/legacy.jpg?w=320`)).text(), 'unsupported legacy bytes');
    // Replacing a source must not serve an old in-process thumbnail.
    await sharp({ create: { width: 600, height: 600, channels: 3, background: '#ff0011' } }).png().toFile(path.join(root, 'cover.png'));
    const replaced = Buffer.from(await (await fetch(`${base}/cover.png?w=320`)).arrayBuffer());
    assert.equal((await sharp(replaced).metadata()).height, 320);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(root, { recursive: true, force: true });
  }
});
