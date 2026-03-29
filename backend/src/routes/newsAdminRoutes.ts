import { Router } from 'express';
import { HttpError } from '../middleware/errorHandler';
import type { AuditRepository } from '../repositories/auditRepository';
import type { NewsRepository } from '../repositories/newsRepository';
import type { NewsContentService } from '../services/newsContentService';
import type { NewsCoverImageService } from '../services/newsCoverImageService';
import type { PexelsCoverService } from '../services/pexelsCoverService';
import type { NewsPublicService } from '../services/newsPublicService';
import { renderNewsArticlePage } from '../services/newsPageRenderer';
import { createNewsUploadMiddleware } from '../utils/newsUpload';
import {
  NewsMutationService,
  isDuplicateKeyError,
  normalizeString,
  parseArticleId,
  parseNewsStatus,
} from '../services/newsMutationService';

interface NewsAdminDeps {
  auditRepository: AuditRepository;
  newsRepository: NewsRepository;
  newsContentService?: NewsContentService;
  newsCoverImageService?: NewsCoverImageService;
  newsPublicService: NewsPublicService;
  pexelsCoverService: PexelsCoverService;
  newsMutationService?: NewsMutationService;
}
const upload = createNewsUploadMiddleware();

export function createNewsAdminRoutes(deps: NewsAdminDeps): Router {
  const router = Router();
  const newsMutationService = getNewsMutationService(deps);

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
      const article = await newsMutationService.create((req.body ?? {}) as Record<string, unknown>);
      await deps.auditRepository.log('create_news_article', actorFromReq(req), req.requestId, {
        article_id: article.id,
        slug: article.slug,
      });
      res.status(201).json(article);
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
      const article = await newsMutationService.update(id, (req.body ?? {}) as Record<string, unknown>);
      await deps.auditRepository.log('update_news_article', actorFromReq(req), req.requestId, {
        article_id: id,
        slug: article.slug,
      });
      res.json(article);
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
      const article = await newsMutationService.publish(id, (req.body ?? {}) as Record<string, unknown>);
      await deps.auditRepository.log('publish_news_article', actorFromReq(req), req.requestId, {
        article_id: id,
        slug: article.slug,
      });
      res.json(article);
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
      const article = await newsMutationService.archive(id);
      await deps.auditRepository.log('archive_news_article', actorFromReq(req), req.requestId, {
        article_id: id,
        slug: article.slug,
      });
      res.json(article);
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
      const result = await newsMutationService.handleUploadedImage(req.file, mode || undefined);
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

function getNewsMutationService(deps: NewsAdminDeps): NewsMutationService {
  if (deps.newsMutationService) {
    return deps.newsMutationService;
  }

  if (!deps.newsContentService || !deps.newsCoverImageService) {
    throw new Error('newsMutationService is not configured');
  }

  return new NewsMutationService({
    newsRepository: deps.newsRepository,
    newsContentService: deps.newsContentService,
    newsCoverImageService: deps.newsCoverImageService,
  });
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
