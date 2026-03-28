import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { Router } from 'express';
import { HttpError } from '../middleware/errorHandler';
import type { AuditRepository } from '../repositories/auditRepository';
import type { NewsRepository } from '../repositories/newsRepository';
import type { NewsStatus } from '../types/domain';
import { NewsContentService } from '../services/newsContentService';
import type { NewsCoverImageService } from '../services/newsCoverImageService';
import type { PexelsCoverService } from '../services/pexelsCoverService';
import type { NewsPublicService } from '../services/newsPublicService';
import { renderNewsArticlePage } from '../services/newsPageRenderer';
import { formatSqlDateTimeInTimezone } from '../utils/time';
import { fileExtensionFromMime, slugifyNewsText } from '../utils/news';
import { getNewsUploadDir } from '../utils/newsStorage';

interface NewsAdminDeps {
  auditRepository: AuditRepository;
  newsRepository: NewsRepository;
  newsContentService: NewsContentService;
  newsPublicService: NewsPublicService;
  pexelsCoverService: PexelsCoverService;
  newsCoverImageService: NewsCoverImageService;
}

const upload = multer({
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

export function createNewsAdminRoutes(deps: NewsAdminDeps): Router {
  const router = Router();

  router.get('/news/cover-search', async (req, res, next) => {
    try {
      const query = optionalString(req.query.q);
      if (!query) {
        throw new HttpError(400, 'BAD_REQUEST', 'q 不能为空');
      }

      const page = toPositiveInt(req.query.page, 1);
      const perPage = clamp(toPositiveInt(req.query.per_page, 12), 1, 20);
      const result = await deps.pexelsCoverService.searchCoverCandidates(query, page, perPage);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/news', async (req, res, next) => {
    try {
      const page = toPositiveInt(req.query.page, 1);
      const pageSize = toPositiveInt(req.query.page_size, 20);
      const keyword = optionalString(req.query.keyword);
      const status = req.query.status ? parseNewsStatus(String(req.query.status)) : undefined;
      const result = await deps.newsRepository.listByQuery({ page, pageSize, keyword, status });
      res.json({ page, page_size: pageSize, total: result.total, items: result.items });
    } catch (error) {
      next(error);
    }
  });

  router.get('/news/:id', async (req, res, next) => {
    try {
      const id = parseArticleId(req.params.id);
      const article = await deps.newsRepository.getById(id);
      if (!article) {
        throw new HttpError(404, 'NEWS_NOT_FOUND', `news article ${id} not found`);
      }
      res.json(article);
    } catch (error) {
      next(error);
    }
  });

  router.post('/news', async (req, res, next) => {
    try {
      const articleInput = parseArticlePayload((req.body ?? {}) as Record<string, unknown>, deps.newsContentService, false);
      const articleId = await deps.newsRepository.create({
        ...articleInput,
        status: 'draft',
        published_at: null,
      });
      await deps.auditRepository.log('create_news_article', actorFromReq(req), req.requestId, {
        article_id: articleId,
        slug: articleInput.slug,
      });
      res.status(201).json(await deps.newsRepository.getById(articleId));
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        next(new HttpError(409, 'NEWS_SLUG_CONFLICT', 'slug 已存在，请更换'));
        return;
      }
      next(error);
    }
  });

  router.patch('/news/:id', async (req, res, next) => {
    try {
      const id = parseArticleId(req.params.id);
      const current = await deps.newsRepository.getById(id);
      if (!current) {
        throw new HttpError(404, 'NEWS_NOT_FOUND', `news article ${id} not found`);
      }
      const articleInput = parseArticlePayload(
        (req.body ?? {}) as Record<string, unknown>,
        deps.newsContentService,
        false,
        current,
      );
      await deps.newsRepository.update(id, articleInput);
      await deps.auditRepository.log('update_news_article', actorFromReq(req), req.requestId, {
        article_id: id,
        slug: articleInput.slug,
      });
      res.json(await deps.newsRepository.getById(id));
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        next(new HttpError(409, 'NEWS_SLUG_CONFLICT', 'slug 已存在，请更换'));
        return;
      }
      next(error);
    }
  });

  router.post('/news/:id/publish', async (req, res, next) => {
    try {
      const id = parseArticleId(req.params.id);
      const current = await deps.newsRepository.getById(id);
      if (!current) {
        throw new HttpError(404, 'NEWS_NOT_FOUND', `news article ${id} not found`);
      }

      const articleInput = parseArticlePayload(
        (req.body ?? {}) as Record<string, unknown>,
        deps.newsContentService,
        true,
        current,
      );
      await deps.newsRepository.update(id, {
        ...articleInput,
        status: 'published',
        published_at: formatSqlDateTimeInTimezone(new Date(), 'Asia/Shanghai'),
      });
      await deps.auditRepository.log('publish_news_article', actorFromReq(req), req.requestId, {
        article_id: id,
        slug: articleInput.slug,
      });
      res.json(await deps.newsRepository.getById(id));
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        next(new HttpError(409, 'NEWS_SLUG_CONFLICT', 'slug 已存在，请更换'));
        return;
      }
      next(error);
    }
  });

  router.post('/news/:id/archive', async (req, res, next) => {
    try {
      const id = parseArticleId(req.params.id);
      const current = await deps.newsRepository.getById(id);
      if (!current) {
        throw new HttpError(404, 'NEWS_NOT_FOUND', `news article ${id} not found`);
      }

      await deps.newsRepository.update(id, { status: 'archived' });
      await deps.auditRepository.log('archive_news_article', actorFromReq(req), req.requestId, {
        article_id: id,
        slug: current.slug,
      });
      res.json(await deps.newsRepository.getById(id));
    } catch (error) {
      next(error);
    }
  });

  router.get('/news/:id/preview', async (req, res, next) => {
    try {
      const id = parseArticleId(req.params.id);
      const article = await deps.newsPublicService.getPreviewArticleView(id);
      if (!article) {
        throw new HttpError(404, 'NEWS_NOT_FOUND', `news article ${id} not found`);
      }
      res
        .status(200)
        .type('html')
        .send(renderNewsArticlePage({ siteUrl: getSiteUrl(req), article, preview: true }));
    } catch (error) {
      next(error);
    }
  });

  router.post('/news/upload-image', upload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) {
        throw new HttpError(400, 'BAD_REQUEST', '缺少图片文件');
      }
      const mode = normalizeString((req.body as Record<string, unknown> | undefined)?.mode);
      const result = mode === 'cover'
        ? await deps.newsCoverImageService.compressUploadedCover(req.file.path)
        : { url: `/uploads/news/${req.file.filename}` };
      await deps.auditRepository.log('upload_news_image', actorFromReq(req), req.requestId, {
        filename: result.url.split('/').pop() || req.file.filename,
        size: req.file.size,
        mode: mode || 'body',
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/news/import-cover-image', async (req, res, next) => {
    try {
      const payload = (req.body ?? {}) as Record<string, unknown>;
      const id = parseArticleId(String(payload.id ?? ''));
      const downloadUrl = normalizeString(payload.download_url);
      if (!downloadUrl) {
        throw new HttpError(400, 'BAD_REQUEST', 'download_url 不能为空');
      }

      const result = await deps.pexelsCoverService.importCoverImage({
        id,
        download_url: downloadUrl,
      }, Number(process.env.NEWS_IMAGE_MAX_BYTES || 8 * 1024 * 1024));

      await deps.auditRepository.log('import_news_cover_image', actorFromReq(req), req.requestId, {
        pexels_id: id,
        url: result.url,
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function parseArticlePayload(
  payload: Record<string, unknown>,
  newsContentService: NewsContentService,
  requireComplete: boolean,
  current?: {
    title: string;
    slug: string;
    excerpt: string;
    cover_image_url: string;
    content_markdown: string;
    status: NewsStatus;
  },
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

function buildExcerpt(plainText: string, title: string): string {
  const source = plainText.trim() || title.trim();
  if (!source) {
    return '';
  }
  return source.length > 160 ? `${source.slice(0, 157).trimEnd()}...` : source;
}

function parseArticleId(value: string): number {
  const id = Number(value);
  if (!Number.isFinite(id) || id <= 0) {
    throw new HttpError(400, 'BAD_REQUEST', 'article id must be positive integer');
  }
  return Math.floor(id);
}

function parseNewsStatus(value: string): NewsStatus {
  if (value === 'draft' || value === 'published' || value === 'archived') {
    return value;
  }
  throw new HttpError(400, 'BAD_REQUEST', `unsupported news status: ${value}`);
}

function normalizeString(value: unknown, fallback = ''): string {
  if (value === undefined) {
    return fallback;
  }
  return String(value ?? '').trim();
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null || String(value).trim() === '') {
    return undefined;
  }
  return String(value).trim();
}

function toPositiveInt(value: unknown, fallback: number): number {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function actorFromReq(req: { header(name: string): string | undefined }): string {
  return req.header('x-admin-actor') || 'admin';
}

function isDuplicateKeyError(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'ER_DUP_ENTRY';
}

function getSiteUrl(req: { header(name: string): string | undefined; protocol?: string }): string {
  const fromEnv = process.env.VITE_SITE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, '');
  }
  const protocol = req.header('x-forwarded-proto') || req.protocol || 'https';
  const host = req.header('x-forwarded-host') || req.header('host') || 'localhost:3000';
  return `${protocol}://${host}`.replace(/\/+$/, '');
}
