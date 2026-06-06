import { Router } from 'express';
import { HttpError } from '../middleware/errorHandler';
import type { AuditRepository } from '../repositories/auditRepository';
import type { NewsRepository, NewsTopicInput, UpdateNewsTopicInput } from '../repositories/newsRepository';
import type { NewsTopicSummary } from '../types/domain';
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
      const categorySlug = optionalString(req.query.category);
      const result = await deps.newsRepository.listByQuery({
        page,
        pageSize,
        keyword,
        status,
        category_slug: categorySlug,
      });
      res.json({ page, page_size: pageSize, total: result.total, items: result.items });
    } catch (error) {
      next(error);
    }
  });

  router.get('/news/categories', async (_req, res, next) => {
    try {
      res.json({ items: await deps.newsRepository.listCategories() });
    } catch (error) {
      next(error);
    }
  });

  router.get('/news/topics', async (req, res, next) => {
    try {
      const topics = await deps.newsRepository.listTopics({ includeInactive: String(req.query.include_inactive || '') === '1' });
      res.json({ items: await Promise.all(topics.map((topic) => hydrateTopicForAdmin(deps.newsRepository, topic))) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/news/topics', async (req, res, next) => {
    try {
      const payload = (req.body ?? {}) as Record<string, unknown>;
      const input = parseTopicPayload(payload, true);
      const id = await deps.newsRepository.createTopic(input);
      const topic = await deps.newsRepository.getTopicById(id);
      if (!topic) {
        throw new HttpError(404, 'NEWS_TOPIC_NOT_FOUND', `news topic ${id} not found`);
      }
      await deps.auditRepository.log('create_news_topic', actorFromReq(req), req.requestId, {
        topic_id: id,
        slug: topic.slug,
      });
      res.status(201).json(await hydrateTopicForAdmin(deps.newsRepository, topic));
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        next(new HttpError(409, 'NEWS_TOPIC_SLUG_CONFLICT', '专题 slug 已存在，请更换'));
        return;
      }
      next(error);
    }
  });

  router.patch('/news/topics/:id', async (req, res, next) => {
    try {
      const id = parseTopicId(req.params.id);
      const current = await deps.newsRepository.getTopicById(id);
      if (!current) {
        throw new HttpError(404, 'NEWS_TOPIC_NOT_FOUND', `news topic ${id} not found`);
      }
      const payload = (req.body ?? {}) as Record<string, unknown>;
      const input = parseTopicPayload(payload, false);
      if (payload.slug !== undefined && input.slug !== current.slug) {
        throw new HttpError(400, 'BAD_REQUEST', '专题保存后 slug 不能修改');
      }
      if (input.pinned_article_ids !== undefined) {
        const validPinned = await deps.newsRepository.validateTopicPinnedArticleIds(id, input.pinned_article_ids);
        if (!validPinned) {
          throw new HttpError(400, 'BAD_REQUEST', '置顶文章必须是当前专题下的已发布文章');
        }
      }
      await deps.newsRepository.updateTopic(id, input);
      const topic = await deps.newsRepository.getTopicById(id);
      if (!topic) {
        throw new HttpError(404, 'NEWS_TOPIC_NOT_FOUND', `news topic ${id} not found`);
      }
      await deps.auditRepository.log('update_news_topic', actorFromReq(req), req.requestId, {
        topic_id: id,
        slug: topic.slug,
      });
      res.json(await hydrateTopicForAdmin(deps.newsRepository, topic));
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        next(new HttpError(409, 'NEWS_TOPIC_SLUG_CONFLICT', '专题 slug 已存在，请更换'));
        return;
      }
      next(error);
    }
  });

  router.post('/news/topics/:id/archive', async (req, res, next) => {
    try {
      const id = parseTopicId(req.params.id);
      const changed = await deps.newsRepository.archiveTopic(id);
      if (!changed) {
        throw new HttpError(404, 'NEWS_TOPIC_NOT_FOUND', `news topic ${id} not found`);
      }
      const topic = await deps.newsRepository.getTopicById(id);
      if (!topic) {
        throw new HttpError(404, 'NEWS_TOPIC_NOT_FOUND', `news topic ${id} not found`);
      }
      await deps.auditRepository.log('archive_news_topic', actorFromReq(req), req.requestId, {
        topic_id: id,
        slug: topic.slug,
      });
      res.json(await hydrateTopicForAdmin(deps.newsRepository, topic));
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
      const payload = (req.body ?? {}) as Record<string, unknown>;
      requireManualSlug(payload);
      const article = await newsMutationService.create(payload);
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
      const payload = (req.body ?? {}) as Record<string, unknown>;
      await requireEditableSlug(newsMutationService, id, payload);
      const article = await newsMutationService.update(id, payload);
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
      const payload = (req.body ?? {}) as Record<string, unknown>;
      await requireEditableSlug(newsMutationService, id, payload);
      const article = await newsMutationService.publish(id, payload);
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

  router.delete('/news/:id', async (req, res, next) => {
    try {
      const id = parseArticleId(req.params.id);
      await deleteNewsArticle(deps, newsMutationService, id, actorFromReq(req), req.requestId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.post('/news/:id/delete', async (req, res, next) => {
    try {
      const id = parseArticleId(req.params.id);
      await deleteNewsArticle(deps, newsMutationService, id, actorFromReq(req), req.requestId);
      res.status(204).send();
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
        context_slug: normalizeString(payload.context_slug),
        alt: normalizeString(payload.alt),
        target: normalizeString(payload.target),
      }, Number(process.env.NEWS_IMAGE_MAX_BYTES || 8 * 1024 * 1024));

      await deps.auditRepository.log('import_news_cover_image', actorFromReq(req), req.requestId, {
        pexels_id: id,
        url: result.url,
        target: normalizeString(payload.target),
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

function requireManualSlug(payload: Record<string, unknown>): void {
  if (!normalizeString(payload.slug)) {
    throw new HttpError(400, 'BAD_REQUEST', 'slug 不能为空');
  }
}

function parseTopicId(value: unknown): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'BAD_REQUEST', '专题 id 无效');
  }
  return id;
}

function parseTopicPayload(payload: Record<string, unknown>, requireRequiredFields: true): NewsTopicInput;
function parseTopicPayload(payload: Record<string, unknown>, requireRequiredFields: false): UpdateNewsTopicInput;
function parseTopicPayload(payload: Record<string, unknown>, requireRequiredFields: boolean): NewsTopicInput | UpdateNewsTopicInput {
  const input: UpdateNewsTopicInput = {};

  if (payload.name !== undefined || requireRequiredFields) {
    input.name = normalizeString(payload.name);
    if (!input.name) {
      throw new HttpError(400, 'BAD_REQUEST', '专题名称不能为空');
    }
  }
  if (payload.slug !== undefined || requireRequiredFields) {
    input.slug = normalizeTopicSlug(payload.slug);
  }
  if (payload.description !== undefined || requireRequiredFields) {
    input.description = normalizeString(payload.description);
    if (!input.description) {
      throw new HttpError(400, 'BAD_REQUEST', '专题描述不能为空');
    }
  }
  if (payload.seo_title !== undefined) input.seo_title = normalizeString(payload.seo_title);
  if (payload.seo_description !== undefined) input.seo_description = normalizeString(payload.seo_description);
  if (payload.h1 !== undefined) input.h1 = normalizeString(payload.h1);
  if (payload.intro !== undefined) input.intro = normalizeString(payload.intro);
  if (payload.cover_image_url !== undefined) input.cover_image_url = normalizeString(payload.cover_image_url);
  if (payload.accent_color !== undefined) input.accent_color = normalizeAccentColor(payload.accent_color);
  if (payload.faq_items !== undefined) input.faq_items = parseFaqItems(payload.faq_items);
  if (payload.sort_order !== undefined) {
    const sortOrder = Number(payload.sort_order);
    input.sort_order = Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 0;
  }
  if (payload.is_active !== undefined) input.is_active = Boolean(payload.is_active);
  if (payload.pinned_article_ids !== undefined) input.pinned_article_ids = parsePositiveIdList(payload.pinned_article_ids);

  return input as NewsTopicInput;
}

function normalizeTopicSlug(value: unknown): string {
  const slug = normalizeString(value).toLowerCase();
  if (!slug) {
    throw new HttpError(400, 'BAD_REQUEST', '专题 slug 不能为空');
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new HttpError(400, 'BAD_REQUEST', '专题 slug 只能包含小写英文、数字和连字符');
  }
  return slug;
}

function normalizeAccentColor(value: unknown): string {
  const color = normalizeString(value) || '#d43d31';
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw new HttpError(400, 'BAD_REQUEST', 'accent_color 必须是 #RRGGBB 格式');
  }
  return color.toLowerCase();
}

function parseFaqItems(value: unknown): Array<{ question: string; answer: string }> {
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'BAD_REQUEST', 'faq_items 必须是数组');
  }
  if (value.length > 8) {
    throw new HttpError(400, 'BAD_REQUEST', 'FAQ 最多 8 条');
  }
  return value.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new HttpError(400, 'BAD_REQUEST', 'FAQ 格式无效');
    }
    const record = item as Record<string, unknown>;
    const question = normalizeString(record.question);
    const answer = normalizeString(record.answer);
    if (!question || !answer) {
      throw new HttpError(400, 'BAD_REQUEST', 'FAQ 问题和答案不能为空');
    }
    return { question, answer };
  });
}

function parsePositiveIdList(value: unknown): number[] {
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'BAD_REQUEST', 'pinned_article_ids 必须是数组');
  }
  return Array.from(new Set(value.map((item) => {
    const id = Number(item);
    if (!Number.isInteger(id) || id <= 0) {
      throw new HttpError(400, 'BAD_REQUEST', 'pinned_article_ids 必须是正整数数组');
    }
    return id;
  })));
}

async function hydrateTopicForAdmin(newsRepository: NewsRepository, topic: NewsTopicSummary & { pinned_article_ids?: number[] }) {
  const existingPinned = Array.isArray(topic.pinned_article_ids)
    ? topic.pinned_article_ids.map((id) => Number(id)).filter((id) => id > 0)
    : null;
  const pinnedArticleIds = existingPinned || (typeof newsRepository.getTopicPinnedArticleIds === 'function'
    ? await newsRepository.getTopicPinnedArticleIds(topic.id)
    : []);
  return {
    ...topic,
    pinned_article_ids: pinnedArticleIds,
  };
}

async function requireEditableSlug(
  newsMutationService: NewsMutationService,
  id: number,
  payload: Record<string, unknown>,
): Promise<void> {
  requireManualSlug(payload);
  const current = await newsMutationService.requireArticle(id);
  const nextSlug = normalizeString(payload.slug);
  if (current.status !== 'draft' && nextSlug !== current.slug) {
    throw new HttpError(400, 'BAD_REQUEST', '已发布文章的 slug 不能修改');
  }
}

async function deleteNewsArticle(
  deps: NewsAdminDeps,
  newsMutationService: NewsMutationService,
  id: number,
  actor: string,
  requestId: string,
): Promise<void> {
  const article = await newsMutationService.requireArticle(id);
  if (article.status === 'published') {
    throw new HttpError(409, 'NEWS_DELETE_NOT_ALLOWED', '已发布文章不能删除，请先下线');
  }

  const deleted = await deps.newsRepository.deleteById(id);
  if (!deleted) {
    throw new HttpError(404, 'NEWS_NOT_FOUND', `news article ${id} not found`);
  }

  await deps.auditRepository.log('delete_news_article', actor, requestId, {
    article_id: id,
    slug: article.slug,
    status: article.status,
  });
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
