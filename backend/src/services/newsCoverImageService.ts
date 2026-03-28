import { mkdirSync } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { HttpError } from '../middleware/errorHandler';
import { getNewsUploadDir } from '../utils/newsStorage';

const DEFAULT_MAX_WIDTH = 1600;
const DEFAULT_MAX_HEIGHT = 900;
const DEFAULT_WEBP_QUALITY = 82;

export class NewsCoverImageService {
  constructor(
    private readonly maxWidth: number = DEFAULT_MAX_WIDTH,
    private readonly maxHeight: number = DEFAULT_MAX_HEIGHT,
    private readonly webpQuality: number = DEFAULT_WEBP_QUALITY,
  ) {}

  async compressUploadedCover(inputPath: string): Promise<{ url: string }> {
    try {
      const buffer = await sharp(inputPath)
        .rotate()
        .resize({
          width: this.maxWidth,
          height: this.maxHeight,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: this.webpQuality })
        .toBuffer();

      const result = await this.writeCompressedCover(buffer);
      await unlink(inputPath).catch(() => undefined);
      return result;
    } catch {
      await unlink(inputPath).catch(() => undefined);
      throw new HttpError(400, 'BAD_REQUEST', '封面图片处理失败，请更换图片后重试');
    }
  }

  async compressCoverBuffer(buffer: Buffer): Promise<{ url: string }> {
    try {
      const output = await sharp(buffer)
        .rotate()
        .resize({
          width: this.maxWidth,
          height: this.maxHeight,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: this.webpQuality })
        .toBuffer();

      return await this.writeCompressedCover(output);
    } catch {
      throw new HttpError(400, 'BAD_REQUEST', '封面图片处理失败，请更换图片后重试');
    }
  }

  private async writeCompressedCover(buffer: Buffer): Promise<{ url: string }> {
    const dir = getNewsUploadDir();
    mkdirSync(dir, { recursive: true });
    const filename = `${Date.now()}-${randomUUID()}.webp`;
    const targetPath = path.join(dir, filename);
    await writeFile(targetPath, buffer);
    return { url: `/uploads/news/${filename}` };
  }
}
