import type { NewsRepository } from '../repositories/newsRepository';
import type { NewsStatus } from '../types/domain';
import { formatSqlDateTimeInTimezone } from '../utils/time';
import { HttpError } from '../middleware/errorHandler';
import type { NewsContentService } from './newsContentService';
import type { NewsCoverImageService } from './newsCoverImageService';
import { slugifyNewsText } from '../utils/news';

export type NewsPublishMode = 'draft' | 'publish';

interface CurrentArticleState {
  title: string;
  slug: string;
  excerpt: string;
  cover_image_url: string;
  content_markdown: string;
  status: NewsStatus;
}

interface NewsMutationServiceDeps {
  newsRepository: Pick<NewsRepository, 'getById' | 'create' | 'update'>;
  newsContentService: Pick<NewsContentService, 'render'>;
  newsCoverImageService: Pick<NewsCoverImageService, 'compressUploadedCover'>;
}

export class NewsMutationService {
  constructor(private readonly deps: NewsMutationServiceDeps) {}

  async create(payload: Record<string, unknown>, publishMode: NewsPublishMode = 'draft') {
    const articleInput = resolveArticlePayload(payload, this.deps.newsContentService, false);
    const articleId = await this.deps.newsRepository.create({
      ...articleInput,
      status: publishMode === 'publish' ? 'published' : 'draft',
      published_at: publishMode === 'publish' ? nowInShanghai() : null,
    });
    return this.requireArticle(articleId);
  }

  async update(id: number, payload: Record<string, unknown>) {
    const current = await this.requireArticle(id);
    const articleInput = resolveArticlePayload(payload, this.deps.newsContentService, false, current);
    await this.deps.newsRepository.update(id, articleInput);
    return this.requireArticle(id);
  }

  async publish(id: number, payload: Record<string, unknown> = {}) {
    const current = await this.requireArticle(id);
    const articleInput = resolveArticlePayload(payload, this.deps.newsContentService, true, current);
    await this.deps.newsRepository.update(id, {
      ...articleInput,
      status: 'published',
      published_at: nowInShanghai(),
    });
    return this.requireArticle(id);
  }

  async archive(id: number) {
    await this.requireArticle(id);
    await this.deps.newsRepository.update(id, { status: 'archived' });
    return this.requireArticle(id);
  }

  async handleUploadedImage(
    file: Pick<Express.Multer.File, 'path' | 'filename'>,
    mode: string | undefined,
  ): Promise<{ url: string }> {
    return mode === 'cover'
      ? this.deps.newsCoverImageService.compressUploadedCover(file.path)
      : { url: `/uploads/news/${file.filename}` };
  }

  async requireArticle(id: number) {
    const article = await this.deps.newsRepository.getById(id);
    if (!article) {
      throw new HttpError(404, 'NEWS_NOT_FOUND', `news article ${id} not found`);
    }
    return article;
  }
}

export function resolveArticlePayload(
  payload: Record<string, unknown>,
  newsContentService: Pick<NewsContentService, 'render'>,
  requireComplete: boolean,
  current?: CurrentArticleState,
): {
  title: string;
  slug: string;
  excerpt: string;
  cover_image_url: string;
  content_markdown: string;
  content_html: string;
} {
  const title = normalizeString(payload.title, current?.title || '');
  const slug = normalizeString(payload.slug, current?.slug || slugifyNewsText(title));
  const excerpt = normalizeString(payload.excerpt, current?.excerpt || '');
  const coverImageUrl = normalizeString(payload.cover_image_url, current?.cover_image_url || '');
  const contentMarkdown = normalizeString(payload.content_markdown, current?.content_markdown || '');
  const rendered = newsContentService.render(contentMarkdown);
  const resolvedExcerpt = excerpt || buildExcerpt(rendered.plain_text, title);

  if (requireComplete) {
    if (!title) {
      throw new HttpError(400, 'BAD_REQUEST', 'title 不能为空');
    }
    if (!slug) {
      throw new HttpError(400, 'BAD_REQUEST', 'slug 不能为空');
    }
    if (!contentMarkdown) {
      throw new HttpError(400, 'BAD_REQUEST', 'content_markdown 不能为空');
    }
  }

  return {
    title,
    slug: slug || slugifyNewsText(title),
    excerpt: resolvedExcerpt,
    cover_image_url: coverImageUrl,
    content_markdown: contentMarkdown,
    content_html: rendered.html,
  };
}

export function buildExcerpt(plainText: string, title: string): string {
  const source = plainText.trim() || title.trim();
  if (!source) {
    return '';
  }
  return source.length > 160 ? `${source.slice(0, 157).trimEnd()}...` : source;
}

export function parseArticleId(value: string): number {
  const id = Number(value);
  if (!Number.isFinite(id) || id <= 0) {
    throw new HttpError(400, 'BAD_REQUEST', 'article id must be positive integer');
  }
  return Math.floor(id);
}

export function normalizeString(value: unknown, fallback = ''): string {
  if (value === undefined) {
    return fallback;
  }
  return String(value ?? '').trim();
}

export function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null || String(value).trim() === '') {
    return undefined;
  }
  return String(value).trim();
}

export function toPositiveInt(value: unknown, fallback: number): number {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function parseNewsStatus(value: string): NewsStatus {
  if (value === 'draft' || value === 'published' || value === 'archived') {
    return value;
  }
  throw new HttpError(400, 'BAD_REQUEST', `unsupported news status: ${value}`);
}

export function parsePublishMode(value: unknown): NewsPublishMode {
  if (value === undefined || value === null || String(value).trim() === '') {
    return 'draft';
  }
  if (value === 'draft' || value === 'publish') {
    return value;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'publish_mode must be draft|publish');
}

export function isDuplicateKeyError(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'ER_DUP_ENTRY';
}

function nowInShanghai(): string {
  return formatSqlDateTimeInTimezone(new Date(), 'Asia/Shanghai');
}
