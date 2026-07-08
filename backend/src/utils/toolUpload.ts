import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import multer from 'multer';
import { HttpError } from '../middleware/errorHandler';
import { fileExtensionFromMime } from './news';
import { getNewsUploadRootDir } from './newsStorage';

type ToolUploadKind = 'icons' | 'files';

export function createToolUploadMiddleware(kind: ToolUploadKind) {
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, callback) => {
        const dir = getToolUploadDir(kind);
        mkdirSync(dir, { recursive: true });
        callback(null, dir);
      },
      filename: (_req, file, callback) => {
        const extension = kind === 'icons'
          ? fileExtensionFromMime(file.mimetype)
          : safeExtensionFromFilename(file.originalname);
        callback(null, `${Date.now()}-${randomUUID()}${extension}`);
      },
    }),
    fileFilter: (_req, file, callback) => {
      if (kind === 'icons') {
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(file.mimetype)) {
          callback(new HttpError(400, 'BAD_REQUEST', '只允许上传 jpg、png、webp、gif、avif 图标'));
          return;
        }
        callback(null, true);
        return;
      }
      if (!isAllowedToolFile(file.originalname, file.mimetype)) {
        callback(new HttpError(400, 'BAD_REQUEST', '只允许上传 exe、msi、dmg、pkg、apk、ipa、deb、rpm、AppImage、zip、tar.gz 文件'));
        return;
      }
      callback(null, true);
    },
    limits: {
      fileSize: Number(process.env.TOOL_FILE_MAX_BYTES || (kind === 'icons' ? 4 * 1024 * 1024 : 300 * 1024 * 1024)),
      files: 1,
    },
  });
}

export function getToolUploadPublicUrl(kind: ToolUploadKind, filename: string): string {
  return `/uploads/tools/${kind}/${filename}`;
}

function getToolUploadDir(kind: ToolUploadKind): string {
  return path.resolve(getNewsUploadRootDir(), 'tools', kind);
}

function safeExtensionFromFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.tar.gz')) return '.tar.gz';
  const ext = path.extname(lower);
  return ext || '.bin';
}

function isAllowedToolFile(filename: string, mimetype: string): boolean {
  const lower = filename.toLowerCase();
  return [
    '.exe',
    '.msi',
    '.dmg',
    '.pkg',
    '.apk',
    '.ipa',
    '.deb',
    '.rpm',
    '.appimage',
    '.zip',
    '.gz',
  ].some((extension) => lower.endsWith(extension))
    || lower.endsWith('.tar.gz')
    || [
      'application/octet-stream',
      'application/zip',
      'application/x-zip-compressed',
      'application/x-apple-diskimage',
      'application/vnd.android.package-archive',
      'application/x-msdownload',
      'application/x-debian-package',
      'application/x-rpm',
    ].includes(mimetype);
}
