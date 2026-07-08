import { mkdirSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
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

export async function findRecentToolUpload(
  kind: ToolUploadKind,
  input: { size: number; extension?: string; sinceSeconds?: number },
): Promise<{ url: string; filename: string; file_size_label: string; updated_at: string } | null> {
  if (!Number.isFinite(input.size) || input.size <= 0) {
    throw new HttpError(400, 'BAD_REQUEST', '文件大小无效');
  }

  const dir = getToolUploadDir(kind);
  const sinceMs = Date.now() - Math.max(30, Math.min(input.sinceSeconds || 600, 3600)) * 1000;
  const expectedExtension = normalizeExtension(input.extension);
  const candidates: Array<{ filename: string; mtimeMs: number }> = [];

  let filenames: string[];
  try {
    filenames = await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }

  for (const filename of filenames) {
    if (expectedExtension && !filename.toLowerCase().endsWith(expectedExtension)) {
      continue;
    }
    const fileStat = await stat(path.join(dir, filename));
    if (!fileStat.isFile() || fileStat.size !== input.size || fileStat.mtimeMs < sinceMs) {
      continue;
    }
    candidates.push({ filename, mtimeMs: fileStat.mtimeMs });
  }

  const latest = candidates.sort((left, right) => right.mtimeMs - left.mtimeMs)[0];
  if (!latest) {
    return null;
  }

  return {
    url: getToolUploadPublicUrl(kind, latest.filename),
    filename: latest.filename,
    file_size_label: formatFileSize(input.size),
    updated_at: new Date(latest.mtimeMs).toISOString(),
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
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

function normalizeExtension(value: unknown): string {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  const extension = raw.startsWith('.') ? raw : `.${raw}`;
  if (!/^\.[a-z0-9][a-z0-9._-]{0,20}$/.test(extension)) {
    throw new HttpError(400, 'BAD_REQUEST', '文件扩展名无效');
  }
  return extension;
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
