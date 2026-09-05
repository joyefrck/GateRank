import { mkdirSync } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { HttpError } from '../middleware/errorHandler';
import { getNewsUploadDir } from '../utils/newsStorage';

const DEFAULT_MAX_WIDTH = 1280;
const DEFAULT_MAX_HEIGHT = 720;
const DEFAULT_WEBP_QUALITY = 72;
const DEFAULT_BODY_MAX_WIDTH = 1200;
const DEFAULT_BODY_WEBP_QUALITY = 78;

export interface NewsCoverCompressionOptions {
  contextSlug?: string;
  pexelsId?: number;
  alt?: string;
}

export class NewsCoverImageService {
  constructor(
    private readonly maxWidth: number = DEFAULT_MAX_WIDTH,
    private readonly maxHeight: number = DEFAULT_MAX_HEIGHT,
    private readonly webpQuality: number = DEFAULT_WEBP_QUALITY,
  ) {}

  async compressUploadedCover(inputPath: string, options: NewsCoverCompressionOptions = {}): Promise<{ url: string }> {
    try {
      const buffer = await sharp(inputPath)
        .rotate()
        .resize({
          width: this.maxWidth,
          height: this.maxHeight,
          fit: 'cover',
          withoutEnlargement: true,
        })
        .webp({ quality: this.webpQuality, effort: 6, smartSubsample: true })
        .toBuffer();

      const result = await this.writeCompressedCover(buffer, options);
      await unlink(inputPath).catch(() => undefined);
      return result;
    } catch {
      await unlink(inputPath).catch(() => undefined);
      throw new HttpError(400, 'BAD_REQUEST', '封面图片处理失败，请更换图片后重试');
    }
  }

  async compressUploadedBodyImage(inputPath: string): Promise<{ url: string }> {
    try {
      const buffer = await sharp(inputPath, { animated: true })
        .rotate()
        .resize({
          width: DEFAULT_BODY_MAX_WIDTH,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({
          quality: DEFAULT_BODY_WEBP_QUALITY,
          effort: 6,
          smartSubsample: true,
        })
        .toBuffer();

      const result = await this.writeCompressedCover(buffer, {
        alt: 'topic-body',
      });
      await unlink(inputPath).catch(() => undefined);
      return result;
    } catch {
      await unlink(inputPath).catch(() => undefined);
      throw new HttpError(
        400,
        'BAD_REQUEST',
        '正文图片处理失败，请更换图片后重试',
      );
    }
  }

  async compressCoverBuffer(buffer: Buffer, options: NewsCoverCompressionOptions = {}): Promise<{ url: string }> {
    try {
      const output = await sharp(buffer)
        .rotate()
        .resize({
          width: this.maxWidth,
          height: this.maxHeight,
          fit: 'cover',
          withoutEnlargement: true,
        })
        .webp({ quality: this.webpQuality, effort: 6, smartSubsample: true })
        .toBuffer();

      return await this.writeCompressedCover(output, options);
    } catch {
      throw new HttpError(400, 'BAD_REQUEST', '封面图片处理失败，请更换图片后重试');
    }
  }

  private async writeCompressedCover(buffer: Buffer, options: NewsCoverCompressionOptions): Promise<{ url: string }> {
    const dir = getNewsUploadDir();
    mkdirSync(dir, { recursive: true });
    const filename = buildCoverFilename(options);
    const targetPath = path.join(dir, filename);
    await writeFile(targetPath, buffer);
    return { url: `/uploads/news/${filename}` };
  }
}

function buildCoverFilename(options: NewsCoverCompressionOptions): string {
  const contextSlug = sanitizeFilenamePart(options.contextSlug);
  const altSlug = sanitizeFilenamePart(options.alt);
  const base = contextSlug || altSlug || 'news-cover';
  if (options.pexelsId) {
    return `${base}-pexels-${options.pexelsId}.webp`;
  }
  return `${base}-${Date.now()}-${randomUUID().slice(0, 8)}.webp`;
}

function sanitizeFilenamePart(value: string | undefined): string {
  return String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 96);
}
