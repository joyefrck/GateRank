import { HttpError } from '../middleware/errorHandler';
import { NewsCoverImageService } from './newsCoverImageService';

const SEARCH_ENDPOINT = 'https://api.pexels.com/v1/search';
const DEFAULT_TIMEOUT_MS = 8_000;
const ALLOWED_IMAGE_HOSTS = new Set(['images.pexels.com']);
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

interface PexelsSearchResponse {
  page?: number;
  per_page?: number;
  total_results?: number;
  photos?: PexelsPhoto[];
}

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  alt: string;
  photographer: string;
  photographer_url: string;
  url: string;
  src: {
    original?: string;
    large2x?: string;
    large?: string;
    medium?: string;
    landscape?: string;
  };
}

export interface PexelsCoverCandidate {
  id: number;
  width: number;
  height: number;
  alt: string;
  photographer: string;
  photographer_url: string;
  pexels_url: string;
  preview_url: string;
  download_url: string;
}

export interface PexelsCoverSearchResult {
  page: number;
  per_page: number;
  total: number;
  items: PexelsCoverCandidate[];
}

export interface ImportPexelsCoverInput {
  id: number;
  download_url: string;
}

export class PexelsCoverService {
  constructor(
    private readonly apiKey: string = process.env.PEXELS_API_KEY?.trim() || '',
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS,
    private readonly newsCoverImageService: NewsCoverImageService = new NewsCoverImageService(),
  ) {}

  async searchCoverCandidates(query: string, page: number, perPage: number): Promise<PexelsCoverSearchResult> {
    this.assertConfigured();

    const search = new URLSearchParams({
      query,
      page: String(page),
      per_page: String(perPage),
      orientation: 'landscape',
    });

    const response = await this.fetchFromPexels(`${SEARCH_ENDPOINT}?${search.toString()}`);
    const payload = (await response.json()) as PexelsSearchResponse;
    const items = (payload.photos || []).map((photo) => this.normalizePhoto(photo)).filter(Boolean) as PexelsCoverCandidate[];

    return {
      page: payload.page || page,
      per_page: payload.per_page || perPage,
      total: payload.total_results || 0,
      items,
    };
  }

  async importCoverImage(input: ImportPexelsCoverInput, maxBytes: number): Promise<{ url: string }> {
    this.assertConfigured();
    const remoteUrl = this.assertAllowedImageUrl(input.download_url);
    const response = await this.fetchFromPexels(remoteUrl.toString());
    const contentType = normalizeContentType(response.headers.get('content-type'));

    if (!contentType || !ALLOWED_IMAGE_MIME_TYPES.has(contentType)) {
      throw new HttpError(400, 'BAD_REQUEST', '远程图片格式不受支持');
    }

    const declaredSize = Number(response.headers.get('content-length') || 0);
    if (declaredSize > maxBytes) {
      throw new HttpError(400, 'BAD_REQUEST', '远程图片超过大小限制');
    }

    const chunks: Buffer[] = [];
    let totalBytes = 0;
    const reader = response.body?.getReader();
    if (!reader) {
      throw new HttpError(502, 'PEXELS_DOWNLOAD_FAILED', '封面下载失败');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const chunk = Buffer.from(value);
      totalBytes += chunk.byteLength;
      if (totalBytes > maxBytes) {
        throw new HttpError(400, 'BAD_REQUEST', '远程图片超过大小限制');
      }
      chunks.push(chunk);
    }

    return await this.newsCoverImageService.compressCoverBuffer(Buffer.concat(chunks));
  }

  private normalizePhoto(photo: PexelsPhoto): PexelsCoverCandidate | null {
    const previewUrl = pickFirstUrl(photo.src.landscape, photo.src.large, photo.src.medium);
    const downloadUrl = pickFirstUrl(photo.src.landscape, photo.src.large2x, photo.src.large, photo.src.original);

    if (!previewUrl || !downloadUrl) {
      return null;
    }

    const preview = this.assertAllowedImageUrl(previewUrl);
    const download = this.assertAllowedImageUrl(downloadUrl);

    return {
      id: photo.id,
      width: photo.width,
      height: photo.height,
      alt: photo.alt || '',
      photographer: photo.photographer || '',
      photographer_url: photo.photographer_url || '',
      pexels_url: photo.url || '',
      preview_url: preview.toString(),
      download_url: download.toString(),
    };
  }

  private async fetchFromPexels(url: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: this.apiKey,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new HttpError(503, 'PEXELS_UNAVAILABLE', 'Pexels 图库不可用，请检查 API Key');
        }
        throw new HttpError(502, 'PEXELS_UNAVAILABLE', 'Pexels 图库请求失败');
      }

      return response;
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new HttpError(504, 'PEXELS_TIMEOUT', 'Pexels 图库请求超时');
      }
      throw new HttpError(502, 'PEXELS_UNAVAILABLE', 'Pexels 图库请求失败');
    } finally {
      clearTimeout(timer);
    }
  }

  private assertConfigured(): void {
    if (!this.apiKey) {
      throw new HttpError(503, 'PEXELS_NOT_CONFIGURED', '未配置 PEXELS_API_KEY，无法使用封面图库');
    }
  }

  private assertAllowedImageUrl(value: string): URL {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new HttpError(400, 'BAD_REQUEST', '封面图片地址无效');
    }

    if (url.protocol !== 'https:' || !ALLOWED_IMAGE_HOSTS.has(url.hostname)) {
      throw new HttpError(400, 'BAD_REQUEST', '只允许导入 Pexels 官方图片地址');
    }

    return url;
  }
}

function pickFirstUrl(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    if (value && value.trim()) {
      return value;
    }
  }
  return null;
}

function normalizeContentType(value: string | null): string {
  return String(value || '').split(';', 1)[0].trim().toLowerCase();
}
