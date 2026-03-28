import path from 'node:path';

export function getNewsUploadRootDir(): string {
  return path.resolve(process.env.NEWS_UPLOAD_ROOT_DIR || path.resolve(process.cwd(), 'backend/uploads'));
}

export function getNewsUploadDir(): string {
  return path.resolve(getNewsUploadRootDir(), 'news');
}
