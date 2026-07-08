import { Router } from 'express';
import { HttpError } from '../middleware/errorHandler';
import type { AuditRepository } from '../repositories/auditRepository';
import type { ToolsDownloadService } from '../services/toolsDownloadService';
import type { TimedPromiseCache } from '../utils/publicCache';
import {
  completeToolUploadChunks,
  createToolChunkUploadMiddleware,
  createToolUploadMiddleware,
  findRecentToolUpload,
  formatFileSize,
  getToolUploadPublicUrl,
  listRecentToolUploads,
  storeToolUploadChunk,
  writeToolUploadMetadata,
} from '../utils/toolUpload';
import { isToolDownloadPlatform } from '../../../shared/toolDownloads';

interface ToolsAdminDeps {
  auditRepository: AuditRepository;
  publicPageCache?: Pick<TimedPromiseCache, 'clear'>;
  toolsDownloadService: Pick<
    ToolsDownloadService,
    'getAdminDownloadPageConfig'
    | 'updateAdminDownloadPageConfig'
    | 'listAdminDownloads'
    | 'createDownload'
    | 'updateDownload'
    | 'updateDownloadStatus'
  >;
}

const iconUpload = createToolUploadMiddleware('icons');
const fileUpload = createToolUploadMiddleware('files');
const chunkUpload = createToolChunkUploadMiddleware();

export function createToolsAdminRoutes(deps: ToolsAdminDeps): Router {
  const router = Router();

  router.get('/tools/download-page', async (_req, res, next) => {
    try {
      res.json(await deps.toolsDownloadService.getAdminDownloadPageConfig());
    } catch (error) {
      next(error);
    }
  });

  router.patch('/tools/download-page', async (req, res, next) => {
    try {
      const config = await deps.toolsDownloadService.updateAdminDownloadPageConfig(req.body ?? {}, actorFromReq(req));
      await deps.auditRepository.log('update_tools_download_page', actorFromReq(req), req.requestId, {});
      clearToolsDownloadPublicCache(deps);
      res.json(config);
    } catch (error) {
      next(error);
    }
  });

  router.get('/tools/downloads', async (req, res, next) => {
    try {
      const platform = isToolDownloadPlatform(req.query.platform) ? req.query.platform : undefined;
      res.json(await deps.toolsDownloadService.listAdminDownloads({
        page: toPositiveInt(req.query.page, 1),
        pageSize: toPositiveInt(req.query.page_size, 20),
        keyword: optionalString(req.query.keyword),
        platform,
      }));
    } catch (error) {
      next(error);
    }
  });

  router.post('/tools/downloads', async (req, res, next) => {
    try {
      const item = await deps.toolsDownloadService.createDownload(req.body ?? {});
      await deps.auditRepository.log('create_tool_download', actorFromReq(req), req.requestId, {
        tool_download_id: item.id,
        slug: item.slug,
      });
      clearToolsDownloadPublicCache(deps);
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  });

  router.patch('/tools/downloads/:id', async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const item = await deps.toolsDownloadService.updateDownload(id, req.body ?? {});
      await deps.auditRepository.log('update_tool_download', actorFromReq(req), req.requestId, {
        tool_download_id: item.id,
        slug: item.slug,
      });
      clearToolsDownloadPublicCache(deps);
      res.json(item);
    } catch (error) {
      next(error);
    }
  });

  router.post('/tools/downloads/:id/publish', async (req, res, next) => {
    try {
      const item = await deps.toolsDownloadService.updateDownloadStatus(parseId(req.params.id), 'published');
      await deps.auditRepository.log('publish_tool_download', actorFromReq(req), req.requestId, {
        tool_download_id: item.id,
        slug: item.slug,
      });
      clearToolsDownloadPublicCache(deps);
      res.json(item);
    } catch (error) {
      next(error);
    }
  });

  router.post('/tools/downloads/:id/archive', async (req, res, next) => {
    try {
      const item = await deps.toolsDownloadService.updateDownloadStatus(parseId(req.params.id), 'archived');
      await deps.auditRepository.log('archive_tool_download', actorFromReq(req), req.requestId, {
        tool_download_id: item.id,
        slug: item.slug,
      });
      clearToolsDownloadPublicCache(deps);
      res.json(item);
    } catch (error) {
      next(error);
    }
  });

  router.post('/tools/upload-icon', iconUpload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) {
        throw new HttpError(400, 'BAD_REQUEST', '缺少图标文件');
      }
      const url = getToolUploadPublicUrl('icons', req.file.filename);
      await deps.auditRepository.log('upload_tool_icon', actorFromReq(req), req.requestId, {
        filename: req.file.filename,
        size: req.file.size,
      });
      clearToolsDownloadPublicCache(deps);
      res.status(201).json({ url });
    } catch (error) {
      next(error);
    }
  });

  router.post('/tools/upload-file', fileUpload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) {
        throw new HttpError(400, 'BAD_REQUEST', '缺少安装包文件');
      }
      const url = getToolUploadPublicUrl('files', req.file.filename);
      await writeToolUploadMetadata('files', req.file.filename, {
        original_name: req.file.originalname,
        size: req.file.size,
      });
      await deps.auditRepository.log('upload_tool_file', actorFromReq(req), req.requestId, {
        filename: req.file.filename,
        original_name: req.file.originalname,
        size: req.file.size,
      });
      clearToolsDownloadPublicCache(deps);
      res.status(201).json({
        url,
        filename: req.file.filename,
        original_name: req.file.originalname,
        file_size_label: formatFileSize(req.file.size),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/tools/upload-file/chunk', chunkUpload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) {
        throw new HttpError(400, 'BAD_REQUEST', '缺少安装包分片');
      }
      const stored = await storeToolUploadChunk({
        uploadId: requiredString(req.body.upload_id, '上传会话 id 无效'),
        chunkIndex: Number(req.body.chunk_index),
        totalChunks: Number(req.body.total_chunks),
        originalName: requiredString(req.body.original_name, '安装包文件名无效'),
        totalSize: Number(req.body.total_size),
        buffer: req.file.buffer,
      });
      res.status(201).json(stored);
    } catch (error) {
      next(error);
    }
  });

  router.post('/tools/upload-file/complete', async (req, res, next) => {
    try {
      const completed = await completeToolUploadChunks({
        uploadId: requiredString(req.body?.upload_id, '上传会话 id 无效'),
        originalName: requiredString(req.body?.original_name, '安装包文件名无效'),
        totalChunks: Number(req.body?.total_chunks),
        totalSize: Number(req.body?.total_size),
      });
      await deps.auditRepository.log('upload_tool_file_chunked', actorFromReq(req), req.requestId, {
        filename: completed.filename,
        original_name: completed.original_name,
        size_label: completed.file_size_label,
      });
      clearToolsDownloadPublicCache(deps);
      res.status(201).json(completed);
    } catch (error) {
      next(error);
    }
  });

  router.get('/tools/upload-file/recent', async (req, res, next) => {
    try {
      const recovered = await findRecentToolUpload('files', {
        size: Number(req.query.size || 0),
        extension: optionalString(req.query.extension),
        sinceSeconds: toPositiveInt(req.query.since_seconds, 600),
      });
      if (!recovered) {
        throw new HttpError(404, 'NOT_FOUND', '没有找到匹配的最近上传文件');
      }
      res.json(recovered);
    } catch (error) {
      next(error);
    }
  });

  router.get('/tools/uploads/recent', async (req, res, next) => {
    try {
      res.json({
        items: await listRecentToolUploads('files', {
          limit: toPositiveInt(req.query.limit, 20),
          sinceSeconds: toPositiveInt(req.query.since_seconds, 7 * 86400),
        }),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function clearToolsDownloadPublicCache(deps: ToolsAdminDeps): void {
  deps.publicPageCache?.clear();
}

function parseId(value: unknown): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'BAD_REQUEST', '工具下载项 id 无效');
  }
  return id;
}

function actorFromReq(req: { header(name: string): string | undefined }): string {
  return req.header('x-admin-actor') || 'admin';
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null || String(value).trim() === '') {
    return undefined;
  }
  return String(value).trim();
}

function requiredString(value: unknown, message: string): string {
  const stringValue = optionalString(value);
  if (!stringValue) {
    throw new HttpError(400, 'BAD_REQUEST', message);
  }
  return stringValue;
}

function toPositiveInt(value: unknown, fallback: number): number {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}
