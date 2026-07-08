import { mkdirSync } from 'node:fs';
import { appendFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import multer from 'multer';
import { HttpError } from '../middleware/errorHandler';
import { fileExtensionFromMime } from './news';
import { getNewsUploadRootDir } from './newsStorage';

type ToolUploadKind = 'icons' | 'files';

export interface RecentToolUpload {
  url: string;
  filename: string;
  original_name: string;
  file_size_label: string;
  size: number;
  extension: string;
  uploaded_at: string;
  updated_at?: string;
}

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

export function createToolChunkUploadMiddleware() {
  return multer({
    storage: multer.memoryStorage(),
    fileFilter: (_req, file, callback) => {
      if (!isAllowedToolFile(file.originalname, file.mimetype)) {
        callback(new HttpError(400, 'BAD_REQUEST', '只允许上传 exe、msi、dmg、pkg、apk、ipa、deb、rpm、AppImage、zip、tar.gz 文件'));
        return;
      }
      callback(null, true);
    },
    limits: {
      fileSize: Number(process.env.TOOL_FILE_CHUNK_MAX_BYTES || 6 * 1024 * 1024),
      files: 1,
    },
  });
}

export function getToolUploadPublicUrl(kind: ToolUploadKind, filename: string): string {
  return `/uploads/tools/${kind}/${filename}`;
}

export async function storeToolUploadChunk(input: {
  uploadId: string;
  chunkIndex: number;
  totalChunks: number;
  originalName: string;
  totalSize: number;
  buffer: Buffer;
}): Promise<{ upload_id: string; chunk_index: number; total_chunks: number; chunk_size: number }> {
  validateChunkUploadInput(input);
  const chunkDir = getToolChunkDir(input.uploadId);
  await mkdir(chunkDir, { recursive: true });
  await writeFile(path.join(chunkDir, `${input.chunkIndex}.part`), input.buffer);
  await writeFile(path.join(chunkDir, 'meta.json'), JSON.stringify({
    upload_id: input.uploadId,
    original_name: input.originalName,
    total_chunks: input.totalChunks,
    total_size: input.totalSize,
    updated_at: new Date().toISOString(),
  }));

  return {
    upload_id: input.uploadId,
    chunk_index: input.chunkIndex,
    total_chunks: input.totalChunks,
    chunk_size: input.buffer.length,
  };
}

export async function completeToolUploadChunks(input: {
  uploadId: string;
  originalName: string;
  totalChunks: number;
  totalSize: number;
}): Promise<{ url: string; filename: string; original_name: string; file_size_label: string }> {
  validateChunkUploadInput({
    ...input,
    chunkIndex: 0,
    buffer: Buffer.alloc(1),
  });

  const extension = safeExtensionFromFilename(input.originalName);
  const filename = `${Date.now()}-${randomUUID()}${extension}`;
  const fileDir = getToolUploadDir('files');
  const targetPath = path.join(fileDir, filename);
  const chunkDir = getToolChunkDir(input.uploadId);

  await mkdir(fileDir, { recursive: true });
  await rm(targetPath, { force: true });

  let writtenBytes = 0;
  try {
    for (let index = 0; index < input.totalChunks; index += 1) {
      const chunkPath = path.join(chunkDir, `${index}.part`);
      let chunk: Buffer;
      try {
        chunk = await readFile(chunkPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          throw new HttpError(400, 'BAD_REQUEST', `缺少第 ${index + 1} 个上传分片`);
        }
        throw error;
      }
      writtenBytes += chunk.length;
      await appendFile(targetPath, chunk);
    }

    if (writtenBytes !== input.totalSize) {
      await rm(targetPath, { force: true });
      throw new HttpError(400, 'BAD_REQUEST', '分片合并后的文件大小不一致');
    }

    await writeToolUploadMetadata('files', filename, {
      original_name: input.originalName,
      size: input.totalSize,
    });
    await rm(chunkDir, { recursive: true, force: true });

    return {
      url: getToolUploadPublicUrl('files', filename),
      filename,
      original_name: input.originalName,
      file_size_label: formatFileSize(input.totalSize),
    };
  } catch (error) {
    if (!(error instanceof HttpError)) {
      await rm(targetPath, { force: true });
    }
    throw error;
  }
}

export async function writeToolUploadMetadata(
  kind: ToolUploadKind,
  filename: string,
  metadata: { original_name?: string; size?: number },
): Promise<void> {
  const dir = getToolUploadDir(kind);
  await writeFile(
    path.join(dir, `${filename}.meta.json`),
    JSON.stringify({
      original_name: metadata.original_name || filename,
      size: metadata.size || 0,
      uploaded_at: new Date().toISOString(),
    }),
  );
}

export async function listRecentToolUploads(
  kind: ToolUploadKind,
  input: { limit?: number; sinceSeconds?: number } = {},
): Promise<RecentToolUpload[]> {
  const dir = getToolUploadDir(kind);
  const sinceMs = Date.now() - Math.max(60, Math.min(input.sinceSeconds || 86400, 7 * 86400)) * 1000;
  const limit = Math.max(1, Math.min(input.limit || 20, 100));
  let filenames: string[];
  try {
    filenames = await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  const uploads: RecentToolUpload[] = [];
  for (const filename of filenames) {
    if (filename.endsWith('.meta.json')) {
      continue;
    }
    const filePath = path.join(dir, filename);
    const fileStat = await stat(filePath);
    if (!fileStat.isFile() || fileStat.mtimeMs < sinceMs) {
      continue;
    }
    const metadata = await readToolUploadMetadata(dir, filename);
    uploads.push({
      url: getToolUploadPublicUrl(kind, filename),
      filename,
      original_name: metadata.original_name || filename,
      file_size_label: formatFileSize(fileStat.size),
      size: fileStat.size,
      extension: safeExtensionFromFilename(metadata.original_name || filename),
      uploaded_at: metadata.uploaded_at || new Date(fileStat.mtimeMs).toISOString(),
    });
  }

  return uploads
    .sort((left, right) => new Date(right.uploaded_at).getTime() - new Date(left.uploaded_at).getTime())
    .slice(0, limit);
}

export async function findRecentToolUpload(
  kind: ToolUploadKind,
  input: { size: number; extension?: string; sinceSeconds?: number },
): Promise<RecentToolUpload | null> {
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
    original_name: (await readToolUploadMetadata(dir, latest.filename)).original_name || latest.filename,
    file_size_label: formatFileSize(input.size),
    size: input.size,
    extension: safeExtensionFromFilename(latest.filename),
    updated_at: new Date(latest.mtimeMs).toISOString(),
    uploaded_at: new Date(latest.mtimeMs).toISOString(),
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

function getToolChunkDir(uploadId: string): string {
  return path.resolve(getNewsUploadRootDir(), 'tools', 'chunks', uploadId);
}

function validateChunkUploadInput(input: {
  uploadId: string;
  chunkIndex: number;
  totalChunks: number;
  originalName: string;
  totalSize: number;
  buffer: Buffer;
}): void {
  if (!/^[a-zA-Z0-9_-]{12,80}$/.test(input.uploadId)) {
    throw new HttpError(400, 'BAD_REQUEST', '上传会话 id 无效');
  }
  if (!Number.isInteger(input.totalChunks) || input.totalChunks <= 0 || input.totalChunks > 500) {
    throw new HttpError(400, 'BAD_REQUEST', '上传分片总数无效');
  }
  if (!Number.isInteger(input.chunkIndex) || input.chunkIndex < 0 || input.chunkIndex >= input.totalChunks) {
    throw new HttpError(400, 'BAD_REQUEST', '上传分片序号无效');
  }
  if (!input.originalName || !isAllowedToolFile(input.originalName, 'application/octet-stream')) {
    throw new HttpError(400, 'BAD_REQUEST', '安装包文件名无效');
  }
  if (!Number.isFinite(input.totalSize) || input.totalSize <= 0 || input.totalSize > getToolFileMaxBytes()) {
    throw new HttpError(400, 'BAD_REQUEST', '安装包文件大小无效');
  }
  if (!Buffer.isBuffer(input.buffer) || input.buffer.length <= 0 || input.buffer.length > Number(process.env.TOOL_FILE_CHUNK_MAX_BYTES || 6 * 1024 * 1024)) {
    throw new HttpError(400, 'BAD_REQUEST', '上传分片文件无效');
  }
}

function getToolFileMaxBytes(): number {
  return Number(process.env.TOOL_FILE_MAX_BYTES || 300 * 1024 * 1024);
}

async function readToolUploadMetadata(dir: string, filename: string): Promise<{ original_name?: string; size?: number; uploaded_at?: string }> {
  try {
    return JSON.parse(await readFile(path.join(dir, `${filename}.meta.json`), 'utf8')) as {
      original_name?: string;
      size?: number;
      uploaded_at?: string;
    };
  } catch {
    return {};
  }
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
