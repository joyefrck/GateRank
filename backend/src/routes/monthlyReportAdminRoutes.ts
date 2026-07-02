import multer from 'multer';
import { Router } from 'express';
import { HttpError } from '../middleware/errorHandler';
import type { AuditRepository } from '../repositories/auditRepository';
import type {
  MonthlyReportInput,
  MonthlyReportRepository,
  UpdateMonthlyReportInput,
} from '../repositories/monthlyReportRepository';
import type { MonthlyReportStatus } from '../types/domain';
import type { NewsContentService } from '../services/newsContentService';
import type { NewsCoverImageService } from '../services/newsCoverImageService';
import type { MonthlyReportGenerationService } from '../services/monthlyReportGenerationService';
import { buildExcerpt, isDuplicateKeyError, normalizeString, stripLeadingMarkdownH1 } from '../services/newsMutationService';
import { createNewsUploadMiddleware } from '../utils/newsUpload';
import { formatSqlDateTimeInTimezone, getDateInTimezone } from '../utils/time';
import { getSiteOrigin } from '../utils/siteUrl';
import { renderMonthlyReportDetailPage } from '../services/publicPageRenderer';

interface MonthlyReportAdminDeps {
  auditRepository: AuditRepository;
  monthlyReportRepository: MonthlyReportRepository;
  monthlyReportGenerationService?: MonthlyReportGenerationService;
  newsContentService: NewsContentService;
  newsCoverImageService: NewsCoverImageService;
}

const imageUpload = createNewsUploadMiddleware();
const markdownUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, callback) => {
    if (
      [
        'text/markdown',
        'text/plain',
        'application/octet-stream',
      ].includes(file.mimetype)
      || /\.md(?:own)?$/i.test(file.originalname)
    ) {
      callback(null, true);
      return;
    }
    callback(new HttpError(400, 'BAD_REQUEST', '只允许上传 Markdown 文本文件'));
  },
  limits: {
    fileSize: Number(process.env.MONTHLY_REPORT_MARKDOWN_MAX_BYTES || 2 * 1024 * 1024),
    files: 1,
  },
});

export function createMonthlyReportAdminRoutes(deps: MonthlyReportAdminDeps): Router {
  const router = Router();

  router.get('/monthly-reports', async (req, res, next) => {
    try {
      const page = toPositiveInt(req.query.page, 1);
      const pageSize = toPositiveInt(req.query.page_size, 20);
      const year = req.query.year ? parseYear(req.query.year) : undefined;
      const status = req.query.status ? parseMonthlyReportStatus(req.query.status) : undefined;
      const keyword = optionalString(req.query.keyword);
      const result = await deps.monthlyReportRepository.listByQuery({
        year,
        status,
        keyword,
        page,
        pageSize,
      });
      res.json({ page, page_size: pageSize, total: result.total, items: result.items });
    } catch (error) {
      next(error);
    }
  });

  router.get('/monthly-reports/period-options', async (_req, res, next) => {
    try {
      const service = requireMonthlyReportGenerationService(deps);
      res.json(await service.buildPeriodOptions());
    } catch (error) {
      next(error);
    }
  });

  router.post('/monthly-reports/generate', async (req, res, next) => {
    try {
      const { year, month } = parseReportPeriodPayload(req.body ?? {});
      if (!isCompletedReportMonth(year, month, getDateInTimezone())) {
        throw new HttpError(400, 'MONTHLY_REPORT_PERIOD_NOT_COMPLETED', '只能生成已经完成的月份报告');
      }
      const service = requireMonthlyReportGenerationService(deps);
      const input = await service.generate({ year, month });
      const id = await deps.monthlyReportRepository.create(input);
      const report = await deps.monthlyReportRepository.getById(id);
      await deps.auditRepository.log('generate_monthly_report', actorFromReq(req), req.requestId, {
        report_id: id,
        year,
        month,
        slug: input.slug,
      });
      res.status(201).json(report);
    } catch (error) {
      next(mapMonthlyReportError(error));
    }
  });

  router.get('/monthly-reports/:id', async (req, res, next) => {
    try {
      const report = await deps.monthlyReportRepository.getById(parseReportId(req.params.id));
      if (!report) {
        throw new HttpError(404, 'MONTHLY_REPORT_NOT_FOUND', '月度报告不存在');
      }
      res.json(report);
    } catch (error) {
      next(error);
    }
  });

  router.post('/monthly-reports', async (req, res, next) => {
    try {
      const input = parseReportPayload(req.body ?? {}, deps.newsContentService, false) as MonthlyReportInput;
      const id = await deps.monthlyReportRepository.create(input);
      const report = await deps.monthlyReportRepository.getById(id);
      await deps.auditRepository.log('create_monthly_report', actorFromReq(req), req.requestId, {
        report_id: id,
        year: input.year,
        month: input.month,
        slug: input.slug,
      });
      res.status(201).json(report);
    } catch (error) {
      next(mapMonthlyReportError(error));
    }
  });

  router.patch('/monthly-reports/:id', async (req, res, next) => {
    try {
      const id = parseReportId(req.params.id);
      const current = await deps.monthlyReportRepository.getById(id);
      if (!current) {
        throw new HttpError(404, 'MONTHLY_REPORT_NOT_FOUND', '月度报告不存在');
      }
      const input = parseReportPayload(req.body ?? {}, deps.newsContentService, false, current);
      await deps.monthlyReportRepository.update(id, input);
      const report = await deps.monthlyReportRepository.getById(id);
      await deps.auditRepository.log('update_monthly_report', actorFromReq(req), req.requestId, {
        report_id: id,
        slug: report?.slug || current.slug,
      });
      res.json(report);
    } catch (error) {
      next(mapMonthlyReportError(error));
    }
  });

  router.post('/monthly-reports/:id/publish', async (req, res, next) => {
    try {
      const id = parseReportId(req.params.id);
      const current = await deps.monthlyReportRepository.getById(id);
      if (!current) {
        throw new HttpError(404, 'MONTHLY_REPORT_NOT_FOUND', '月度报告不存在');
      }
      const input = parseReportPayload(
        { ...(req.body ?? {}), status: 'published', published_at: formatSqlDateTimeInTimezone(new Date()) },
        deps.newsContentService,
        true,
        current,
      );
      await deps.monthlyReportRepository.update(id, input);
      const report = await deps.monthlyReportRepository.getById(id);
      await deps.auditRepository.log('publish_monthly_report', actorFromReq(req), req.requestId, {
        report_id: id,
        slug: report?.slug || current.slug,
      });
      res.json(report);
    } catch (error) {
      next(mapMonthlyReportError(error));
    }
  });

  router.post('/monthly-reports/:id/archive', async (req, res, next) => {
    try {
      const id = parseReportId(req.params.id);
      const changed = await deps.monthlyReportRepository.archive(id);
      if (!changed) {
        throw new HttpError(404, 'MONTHLY_REPORT_NOT_FOUND', '月度报告不存在');
      }
      const report = await deps.monthlyReportRepository.getById(id);
      await deps.auditRepository.log('archive_monthly_report', actorFromReq(req), req.requestId, {
        report_id: id,
        slug: report?.slug,
      });
      res.json(report);
    } catch (error) {
      next(error);
    }
  });

  router.get('/monthly-reports/:id/preview', async (req, res, next) => {
    try {
      const report = await deps.monthlyReportRepository.getById(parseReportId(req.params.id));
      if (!report) {
        throw new HttpError(404, 'MONTHLY_REPORT_NOT_FOUND', '月度报告不存在');
      }
      res
        .status(200)
        .type('html')
        .send(renderMonthlyReportDetailPage(getSiteOrigin(req), report, true));
    } catch (error) {
      next(error);
    }
  });

  router.post('/monthly-reports/upload-markdown', markdownUpload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) {
        throw new HttpError(400, 'BAD_REQUEST', '缺少 Markdown 文件');
      }
      const markdown = req.file.buffer.toString('utf8').replace(/^\uFEFF/, '');
      const rendered = deps.newsContentService.render(stripLeadingMarkdownH1(markdown));
      await deps.auditRepository.log('upload_monthly_report_markdown', actorFromReq(req), req.requestId, {
        filename: req.file.originalname,
        size: req.file.size,
      });
      res.status(201).json({
        content_markdown: stripLeadingMarkdownH1(markdown),
        content_html: rendered.html,
        excerpt: buildExcerpt(rendered.plain_text, ''),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/monthly-reports/upload-image', imageUpload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) {
        throw new HttpError(400, 'BAD_REQUEST', '缺少图片文件');
      }
      const mode = normalizeString((req.body as Record<string, unknown> | undefined)?.mode) || 'cover';
      const contextSlug = normalizeString((req.body as Record<string, unknown> | undefined)?.context_slug);
      const result = mode === 'raw'
        ? { url: `/uploads/news/${req.file.filename}` }
        : await deps.newsCoverImageService.compressUploadedCover(req.file.path, { contextSlug });
      await deps.auditRepository.log('upload_monthly_report_image', actorFromReq(req), req.requestId, {
        filename: result.url.split('/').pop() || req.file.filename,
        size: req.file.size,
        mode,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function parseReportPayload(
  payload: unknown,
  contentService: NewsContentService,
  requireComplete: boolean,
  current?: MonthlyReportInput,
): MonthlyReportInput | UpdateMonthlyReportInput {
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const result: UpdateMonthlyReportInput = {};

  if (record.year !== undefined || !current) result.year = parseYear(record.year);
  if (record.month !== undefined || !current) result.month = parseMonth(record.month);
  const year = result.year ?? current?.year;
  const month = result.month ?? current?.month;

  if (record.title !== undefined || !current) result.title = normalizeString(record.title);
  const title = result.title ?? current?.title ?? '';
  if (record.slug !== undefined || !current) result.slug = normalizeSlug(record.slug, year, month);
  if (record.h1 !== undefined || !current) result.h1 = normalizeString(record.h1) || title;
  if (record.content_markdown !== undefined || !current) {
    const markdown = stripLeadingMarkdownH1(normalizeString(record.content_markdown));
    const rendered = contentService.render(markdown);
    result.content_markdown = markdown;
    result.content_html = rendered.html;
    result.excerpt = normalizeString(record.excerpt) || buildExcerpt(rendered.plain_text, title);
  } else if (record.excerpt !== undefined) {
    result.excerpt = normalizeString(record.excerpt);
  }
  if (record.seo_title !== undefined || !current) result.seo_title = normalizeString(record.seo_title);
  if (record.seo_description !== undefined || !current) result.seo_description = normalizeString(record.seo_description);
  if (record.seo_keywords !== undefined || !current) result.seo_keywords = normalizeString(record.seo_keywords);
  if (record.cover_image_url !== undefined || !current) result.cover_image_url = normalizeString(record.cover_image_url);
  if (record.og_image_url !== undefined || !current) result.og_image_url = normalizeString(record.og_image_url);
  if (record.og_image_alt !== undefined || !current) result.og_image_alt = normalizeString(record.og_image_alt);
  if (record.status !== undefined) result.status = parseMonthlyReportStatus(record.status);
  if (record.published_at !== undefined) result.published_at = normalizeString(record.published_at) || null;

  const complete = {
    year: result.year ?? current?.year ?? 0,
    month: result.month ?? current?.month ?? 0,
    slug: result.slug ?? current?.slug ?? '',
    title: result.title ?? current?.title ?? '',
    h1: result.h1 ?? current?.h1 ?? result.title ?? current?.title ?? '',
    excerpt: result.excerpt ?? current?.excerpt ?? '',
    content_markdown: result.content_markdown ?? current?.content_markdown ?? '',
    content_html: result.content_html ?? current?.content_html ?? '',
    seo_title: result.seo_title ?? current?.seo_title ?? '',
    seo_description: result.seo_description ?? current?.seo_description ?? '',
    seo_keywords: result.seo_keywords ?? current?.seo_keywords ?? '',
    cover_image_url: result.cover_image_url ?? current?.cover_image_url ?? '',
    og_image_url: result.og_image_url ?? current?.og_image_url ?? '',
    og_image_alt: result.og_image_alt ?? current?.og_image_alt ?? '',
    status: result.status ?? current?.status ?? 'draft',
    published_at: result.published_at !== undefined ? result.published_at : current?.published_at ?? null,
  };

  if (!complete.year || !complete.month) throw new HttpError(400, 'BAD_REQUEST', '请选择报告年份和月份');
  if (requireComplete || complete.status === 'published') {
    if (!complete.title) throw new HttpError(400, 'BAD_REQUEST', '标题不能为空');
    if (!complete.slug) throw new HttpError(400, 'BAD_REQUEST', 'slug 不能为空');
    if (!complete.content_markdown) throw new HttpError(400, 'BAD_REQUEST', '正文不能为空');
    complete.published_at = complete.published_at || formatSqlDateTimeInTimezone(new Date());
  }

  return current ? result : complete;
}

function parseReportId(value: unknown): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'BAD_REQUEST', '月度报告 id 无效');
  }
  return id;
}

function parseReportPeriodPayload(payload: unknown): { year: number; month: number } {
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  return {
    year: parseYear(record.year),
    month: parseMonth(record.month),
  };
}

function parseYear(value: unknown): number {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    throw new HttpError(400, 'BAD_REQUEST', '年份必须在 2020 到 2100 之间');
  }
  return year;
}

function parseMonth(value: unknown): number {
  const month = Number(value);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new HttpError(400, 'BAD_REQUEST', '月份必须是 1 到 12');
  }
  return month;
}

function parseMonthlyReportStatus(value: unknown): MonthlyReportStatus {
  if (value === 'draft' || value === 'published' || value === 'archived') {
    return value;
  }
  throw new HttpError(400, 'BAD_REQUEST', '报告状态无效');
}

function normalizeSlug(value: unknown, year: number | undefined, month: number | undefined): string {
  const fallback = year && month ? `${year}-${String(month).padStart(2, '0')}-airport-vpn-ranking-report` : '';
  const slug = normalizeString(value, fallback).toLowerCase();
  if (!slug) {
    return '';
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new HttpError(400, 'BAD_REQUEST', 'slug 只能包含小写英文、数字和连字符');
  }
  return slug;
}

function optionalString(value: unknown): string | undefined {
  const text = normalizeString(value);
  return text || undefined;
}

function toPositiveInt(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function actorFromReq(req: unknown): string {
  const actor = (req as { adminActor?: string } | null)?.adminActor;
  return actor || 'admin';
}

function mapMonthlyReportError(error: unknown): unknown {
  if (error instanceof Error && error.message === 'MONTHLY_REPORT_PERIOD_CONFLICT') {
    return new HttpError(409, 'MONTHLY_REPORT_PERIOD_CONFLICT', '该年月已经存在未归档月度报告');
  }
  if (error instanceof Error && error.message === 'MONTHLY_REPORT_SOURCE_DATA_NOT_FOUND') {
    return new HttpError(404, 'MONTHLY_REPORT_SOURCE_DATA_NOT_FOUND', '该月份暂无可生成月度报告的数据');
  }
  if (isDuplicateKeyError(error)) {
    if (isPeriodDuplicateKeyError(error)) {
      return new HttpError(409, 'MONTHLY_REPORT_PERIOD_CONFLICT', '该年月已经存在月度报告');
    }
    return new HttpError(409, 'MONTHLY_REPORT_SLUG_CONFLICT', 'slug 已存在，请更换');
  }
  return error;
}

function requireMonthlyReportGenerationService(deps: MonthlyReportAdminDeps): MonthlyReportGenerationService {
  if (!deps.monthlyReportGenerationService) {
    throw new Error('monthlyReportGenerationService is not configured');
  }
  return deps.monthlyReportGenerationService;
}

function isCompletedReportMonth(year: number, month: number, currentDate: string): boolean {
  const currentYear = Number(currentDate.slice(0, 4));
  const currentMonth = Number(currentDate.slice(5, 7));
  return year < currentYear || (year === currentYear && month < currentMonth);
}

function isPeriodDuplicateKeyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  const code = (error as { code?: string } | null)?.code;
  return code === 'ER_DUP_ENTRY' && message.includes('uk_monthly_reports_year_month');
}
