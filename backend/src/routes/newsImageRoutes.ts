import express, { Router } from 'express';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { getNewsUploadDir } from '../utils/newsStorage';
import { createTimedPromiseCache } from '../utils/publicCache';

const WIDTHS = new Set([320, 640, 960]);

// Existing cover URLs remain valid; only explicit, bounded thumbnail requests are resized.
export function createNewsImageRoutes(root = getNewsUploadDir()): Router {
  const router = Router();
  const cache = createTimedPromiseCache(60_000, { maxEntries: 64 });
  router.get('/uploads/news/:filename', async (req, res, next) => {
    if (req.query.w === undefined) return next();
    const filename = String(req.params.filename);
    const width = Number(req.query.w);
    if (!WIDTHS.has(width) || typeof req.query.w !== 'string'
      || !/^[\p{L}\p{N}_-]+\.(?:webp|jpe?g|png|avif)$/iu.test(filename)) {
      res.status(400).set('Cache-Control', 'no-store').end();
      return;
    }
    try {
      const [directory, source] = await Promise.all([realpath(root), realpath(path.join(root, filename))]);
      if (path.dirname(source) !== directory) {
        res.status(404).set('Cache-Control', 'no-store').end();
        return;
      }
      const metadata = await stat(source);
      if (!metadata.isFile() || metadata.size > 20 * 1024 * 1024) return next();
      const buffer = await cache.getOrLoad(`${source}:${metadata.mtimeMs}:${metadata.size}:${width}`, () => (
        sharp(source, { limitInputPixels: 24_000_000 })
          .rotate()
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: 72, effort: 4 })
          .toBuffer()
      ));
      res.set('Cache-Control', 'public, max-age=86400').type('webp').send(buffer);
    } catch {
      // Missing/unsupported files follow the existing static-file response path.
      next();
    }
  });
  router.use('/uploads/news', express.static(root, { maxAge: '1d' }));
  return router;
}
