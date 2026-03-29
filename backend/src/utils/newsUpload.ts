import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { HttpError } from '../middleware/errorHandler';
import { fileExtensionFromMime } from './news';
import { getNewsUploadDir } from './newsStorage';

export function createNewsUploadMiddleware() {
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, callback) => {
        const dir = getNewsUploadDir();
        mkdirSync(dir, { recursive: true });
        callback(null, dir);
      },
      filename: (_req, file, callback) => {
        callback(null, `${Date.now()}-${randomUUID()}${fileExtensionFromMime(file.mimetype)}`);
      },
    }),
    fileFilter: (_req, file, callback) => {
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(file.mimetype)) {
        callback(new HttpError(400, 'BAD_REQUEST', '只允许上传 jpg、png、webp、gif、avif 图片'));
        return;
      }
      callback(null, true);
    },
    limits: {
      fileSize: Number(process.env.NEWS_IMAGE_MAX_BYTES || 8 * 1024 * 1024),
      files: 1,
    },
  });
}
