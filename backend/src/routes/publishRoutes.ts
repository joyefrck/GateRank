import { Router } from 'express';
import type { AuditRepository } from '../repositories/auditRepository';
import { HttpError } from '../middleware/errorHandler';
import { publishTokenAuth } from '../middleware/publishTokenAuth';
import {
  NewsMutationService,
  isDuplicateKeyError,
  normalizeString,
  parseArticleId,
  parsePublishMode,
} from '../services/newsMutationService';
import type { AccessTokenService } from '../services/accessTokenService';
import { createNewsUploadMiddleware } from '../utils/newsUpload';

interface PublishRoutesDeps {
  accessTokenService: AccessTokenService;
  auditRepository: AuditRepository;
  newsMutationService: NewsMutationService;
}

const upload = createNewsUploadMiddleware();

export function createPublishRoutes(deps: PublishRoutesDeps): Router {
  const router = Router();

  router.post(
    '/publish/news',
    publishTokenAuth(deps.accessTokenService, ['news:create']),
    async (req, res, next) => {
      try {
        const payload = (req.body ?? {}) as Record<string, unknown>;
        const publishMode = parsePublishMode(payload.publish_mode);
        if (publishMode === 'publish' && !hasRequiredPublishScopes(req.publishTokenAuth?.scopes || [])) {
          throw new HttpError(403, 'FORBIDDEN', 'Publish token scope not allowed');
        }
        const article = await deps.newsMutationService.create(payload, publishMode);
        await deps.auditRepository.log(
          'token_create_news_article',
          actorFromReq(req),
          req.requestId,
          { article_id: article.id, slug: article.slug, publish_mode: publishMode },
        );
        res.status(201).json(article);
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          next(new HttpError(409, 'NEWS_SLUG_CONFLICT', 'slug 已存在，请更换'));
          return;
        }
        next(error);
      }
    },
  );

  router.patch(
    '/publish/news/:id',
    publishTokenAuth(deps.accessTokenService, ['news:update']),
    async (req, res, next) => {
      try {
        const article = await deps.newsMutationService.update(
          parseArticleId(req.params.id),
          (req.body ?? {}) as Record<string, unknown>,
        );
        await deps.auditRepository.log(
          'token_update_news_article',
          actorFromReq(req),
          req.requestId,
          { article_id: article.id, slug: article.slug },
        );
        res.json(article);
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          next(new HttpError(409, 'NEWS_SLUG_CONFLICT', 'slug 已存在，请更换'));
          return;
        }
        next(error);
      }
    },
  );

  router.post(
    '/publish/news/:id/publish',
    publishTokenAuth(deps.accessTokenService, ['news:publish']),
    async (req, res, next) => {
      try {
        const article = await deps.newsMutationService.publish(
          parseArticleId(req.params.id),
          (req.body ?? {}) as Record<string, unknown>,
        );
        await deps.auditRepository.log(
          'token_publish_news_article',
          actorFromReq(req),
          req.requestId,
          { article_id: article.id, slug: article.slug },
        );
        res.json(article);
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          next(new HttpError(409, 'NEWS_SLUG_CONFLICT', 'slug 已存在，请更换'));
          return;
        }
        next(error);
      }
    },
  );

  router.post(
    '/publish/news/:id/archive',
    publishTokenAuth(deps.accessTokenService, ['news:archive']),
    async (req, res, next) => {
      try {
        const article = await deps.newsMutationService.archive(parseArticleId(req.params.id));
        await deps.auditRepository.log(
          'token_archive_news_article',
          actorFromReq(req),
          req.requestId,
          { article_id: article.id, slug: article.slug },
        );
        res.json(article);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    '/publish/news/upload-image',
    publishTokenAuth(deps.accessTokenService, ['news:upload']),
    upload.single('file'),
    async (req, res, next) => {
      try {
        if (!req.file) {
          throw new HttpError(400, 'BAD_REQUEST', '缺少图片文件');
        }
        const mode = normalizeString((req.body as Record<string, unknown> | undefined)?.mode);
        const result = await deps.newsMutationService.handleUploadedImage(req.file, mode || undefined);
        await deps.auditRepository.log(
          'token_upload_news_image',
          actorFromReq(req),
          req.requestId,
          {
            filename: result.url.split('/').pop() || req.file.filename,
            size: req.file.size,
            mode: mode || 'body',
          },
        );
        res.status(201).json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}

function actorFromReq(req: { publishTokenAuth?: { actor: string } }): string {
  return req.publishTokenAuth?.actor || 'publish_token:unknown';
}

function hasRequiredPublishScopes(scopes: readonly string[]): boolean {
  return scopes.includes('news:create') && scopes.includes('news:publish');
}
