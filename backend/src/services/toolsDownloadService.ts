import { stat } from 'node:fs/promises';
import path from 'node:path';
import { HttpError } from '../middleware/errorHandler';
import type {
  ToolDownloadInput,
  ToolDownloadListQuery,
  ToolDownloadRepository,
  UpdateToolDownloadInput,
} from '../repositories/toolDownloadRepository';
import type { SystemSettingRepository } from '../repositories/systemSettingRepository';
import { getNewsUploadRootDir } from '../utils/newsStorage';
import { readToolUploadOriginalName } from '../utils/toolUpload';
import { formatSqlDateTimeInTimezone } from '../utils/time';
import {
  DEFAULT_HOT_TOOL_DOWNLOADS,
  DEFAULT_TOOLS_DOWNLOAD_PAGE_CONFIG,
  isToolDownloadPlatform,
  TOOL_DOWNLOAD_PLATFORMS,
  type ToolDownloadItem,
  type ToolDownloadPlatform,
  type ToolDownloadPlatformVersions,
  type ToolDownloadPrimaryAction,
  type ToolDownloadStatus,
  type ToolsDownloadPageConfig,
  type ToolsDownloadPageView,
} from '../../../shared/toolDownloads';

const TOOLS_DOWNLOAD_PAGE_SETTING_KEY = 'tools_download_page';
const TOOL_FILE_UPLOAD_URL_PREFIX = '/uploads/tools/files/';
const LEGACY_DEFAULT_TOOL_DOWNLOAD_FAQ_QUESTIONS = [
  '翻墙工具和机场 VPN 是一回事吗？',
  '下载客户端后可以直接使用吗？',
  '为什么优先展示官方页面？',
];

export interface ToolDownloadFileTarget {
  item: ToolDownloadItem;
  platform: ToolDownloadPlatform;
  downloadFilename: string;
  absolutePath: string;
  internalRedirectPath?: string;
}

export class ToolsDownloadService {
  constructor(
    private readonly toolDownloadRepository: ToolDownloadRepository,
    private readonly systemSettingRepository: SystemSettingRepository,
  ) {}

  async getDownloadPageView(platform?: ToolDownloadPlatform | null): Promise<ToolsDownloadPageView> {
    const normalizedPlatform = platform && isToolDownloadPlatform(platform) ? platform : null;
    const [config, published] = await Promise.all([
      this.getDownloadPageConfig(),
      this.toolDownloadRepository.listPublished({ platform: normalizedPlatform || undefined, pageSize: 100 }),
    ]);
    const items = published.items.length > 0 ? published.items : getDefaultPublishedItems(normalizedPlatform);
    const hotItems = items.filter((item) => item.is_hot).slice(0, 6);
    return {
      config,
      platform: normalizedPlatform,
      platforms: TOOL_DOWNLOAD_PLATFORMS,
      items,
      hotItems,
      total: published.items.length > 0 ? published.total : items.length,
    };
  }

  async getAdminDownloadPageConfig(): Promise<ToolsDownloadPageConfig> {
    return this.getDownloadPageConfig();
  }

  async updateAdminDownloadPageConfig(input: Partial<ToolsDownloadPageConfig>, updatedBy = 'admin'): Promise<ToolsDownloadPageConfig> {
    const next = normalizePageConfig({ ...(await this.getDownloadPageConfig()), ...input });
    await this.systemSettingRepository.upsert(TOOLS_DOWNLOAD_PAGE_SETTING_KEY, next, updatedBy);
    return next;
  }

  async listAdminDownloads(query: ToolDownloadListQuery = {}): Promise<{ page: number; page_size: number; total: number; items: ToolDownloadItem[] }> {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 20));
    const result = await this.toolDownloadRepository.listByQuery({ ...query, page, pageSize });
    return { page, page_size: pageSize, total: result.total, items: result.items };
  }

  async createDownload(payload: Record<string, unknown>): Promise<ToolDownloadItem> {
    const input = parseToolDownloadPayload(payload, true) as ToolDownloadInput;
    const id = await this.toolDownloadRepository.create(input);
    const item = await this.toolDownloadRepository.getById(id);
    if (!item) {
      throw new HttpError(404, 'TOOL_DOWNLOAD_NOT_FOUND', '工具下载项不存在');
    }
    return item;
  }

  async updateDownload(id: number, payload: Record<string, unknown>): Promise<ToolDownloadItem> {
    const current = await this.toolDownloadRepository.getById(id);
    if (!current) {
      throw new HttpError(404, 'TOOL_DOWNLOAD_NOT_FOUND', '工具下载项不存在');
    }
    const input = parseToolDownloadPayload(payload, false);
    input.content_updated_at = formatSqlDateTimeInTimezone(new Date());
    const updated = await this.toolDownloadRepository.update(id, input);
    if (!updated) {
      throw new HttpError(404, 'TOOL_DOWNLOAD_NOT_FOUND', '工具下载项不存在');
    }
    const item = await this.toolDownloadRepository.getById(id);
    if (!item) {
      throw new HttpError(404, 'TOOL_DOWNLOAD_NOT_FOUND', '工具下载项不存在');
    }
    return item;
  }

  async updateDownloadStatus(id: number, status: Extract<ToolDownloadStatus, 'published' | 'archived'>): Promise<ToolDownloadItem> {
    const current = await this.toolDownloadRepository.getById(id);
    if (!current) {
      throw new HttpError(404, 'TOOL_DOWNLOAD_NOT_FOUND', '工具下载项不存在');
    }
    await this.toolDownloadRepository.update(id, {
      status,
      published_at: status === 'published' ? current.published_at || formatSqlDateTimeInTimezone(new Date()) : null,
    });
    const item = await this.toolDownloadRepository.getById(id);
    if (!item) {
      throw new HttpError(404, 'TOOL_DOWNLOAD_NOT_FOUND', '工具下载项不存在');
    }
    return item;
  }

  async getDownloadFileTarget(slug: string, platform: ToolDownloadPlatform): Promise<ToolDownloadFileTarget> {
    const normalizedSlug = mustSlug(slug);
    if (!isToolDownloadPlatform(platform)) {
      throw new HttpError(400, 'BAD_REQUEST', '下载平台无效');
    }
    const item = await this.toolDownloadRepository.getBySlug(normalizedSlug);
    if (!item || item.status !== 'published') {
      throw new HttpError(404, 'TOOL_DOWNLOAD_NOT_FOUND', '下载项不存在或尚未发布');
    }
    if (!item.platforms.includes(platform)) {
      throw new HttpError(404, 'TOOL_DOWNLOAD_NOT_FOUND', '该软件不支持当前下载平台');
    }
    if (!item.local_file_url) {
      throw new HttpError(404, 'TOOL_DOWNLOAD_FILE_NOT_FOUND', '本地安装包尚未上传');
    }

    const absolutePath = resolveToolDownloadFilePath(item.local_file_url);
    try {
      const fileStat = await stat(absolutePath);
      if (!fileStat.isFile()) {
        throw new HttpError(404, 'TOOL_DOWNLOAD_FILE_NOT_FOUND', '本地安装包不存在');
      }
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new HttpError(404, 'TOOL_DOWNLOAD_FILE_NOT_FOUND', '本地安装包不存在');
      }
      throw error;
    }

    const storedFilename = path.basename(absolutePath);
    const downloadFilename = await readToolUploadOriginalName(storedFilename);

    return {
      item,
      platform,
      downloadFilename,
      absolutePath,
      internalRedirectPath: buildInternalRedirectPath(item.local_file_url),
    };
  }

  async recordDownload(itemId: number): Promise<void> {
    await this.toolDownloadRepository.incrementDownloadCount(itemId);
  }

  private async getDownloadPageConfig(): Promise<ToolsDownloadPageConfig> {
    const record = await this.systemSettingRepository.getByKey(TOOLS_DOWNLOAD_PAGE_SETTING_KEY);
    return normalizePageConfig(record?.value_json || DEFAULT_TOOLS_DOWNLOAD_PAGE_CONFIG);
  }
}

function resolveToolDownloadFilePath(publicUrl: string): string {
  let pathname: string;
  try {
    pathname = new URL(publicUrl, 'http://gaterank.local').pathname;
  } catch {
    throw new HttpError(400, 'BAD_REQUEST', '本地安装包 URL 无效');
  }
  if (!pathname.startsWith(TOOL_FILE_UPLOAD_URL_PREFIX)) {
    throw new HttpError(400, 'BAD_REQUEST', '本地安装包必须来自工具上传目录');
  }
  const relativePath = pathname.slice('/uploads/'.length);
  const uploadRoot = getNewsUploadRootDir();
  const absolutePath = path.resolve(uploadRoot, relativePath);
  const safeRoot = path.resolve(uploadRoot);
  if (absolutePath !== safeRoot && !absolutePath.startsWith(`${safeRoot}${path.sep}`)) {
    throw new HttpError(400, 'BAD_REQUEST', '本地安装包路径无效');
  }
  return absolutePath;
}

function buildInternalRedirectPath(publicUrl: string): string | undefined {
  const prefix = optionalString(process.env.TOOL_DOWNLOAD_INTERNAL_REDIRECT_PREFIX);
  if (!prefix) {
    return undefined;
  }
  const pathname = new URL(publicUrl, 'http://gaterank.local').pathname;
  const filename = path.basename(pathname);
  return `${prefix.replace(/\/+$/, '')}/${encodeURIComponent(filename)}`;
}

function parseToolDownloadPayload(payload: Record<string, unknown>, required: boolean): ToolDownloadInput | UpdateToolDownloadInput {
  const input: UpdateToolDownloadInput = {};
  if (required || payload.slug !== undefined) input.slug = mustSlug(payload.slug);
  if (required || payload.name !== undefined) input.name = mustString(payload.name, 'name');
  if (required || payload.summary !== undefined) input.summary = mustString(payload.summary, 'summary');
  if (payload.description !== undefined) input.description = optionalString(payload.description);
  if (required || payload.platforms !== undefined) input.platforms = parsePlatforms(payload.platforms);
  if (payload.platform_versions !== undefined) input.platform_versions = parsePlatformVersions(payload.platform_versions);
  if (payload.icon_url !== undefined) input.icon_url = optionalString(payload.icon_url);
  if (payload.local_file_url !== undefined) input.local_file_url = optionalString(payload.local_file_url);
  if (payload.official_url !== undefined) input.official_url = optionalString(payload.official_url);
  if (required || payload.primary_action !== undefined) input.primary_action = parsePrimaryAction(payload.primary_action);
  if (payload.version !== undefined) input.version = optionalString(payload.version);
  if (payload.file_size_label !== undefined) input.file_size_label = optionalString(payload.file_size_label);
  if (payload.is_hot !== undefined) input.is_hot = Boolean(payload.is_hot);
  if (payload.sort_order !== undefined) input.sort_order = toInteger(payload.sort_order, 'sort_order');
  if (payload.status !== undefined) input.status = parseStatus(payload.status);
  return input as ToolDownloadInput | UpdateToolDownloadInput;
}

function normalizePageConfig(value: unknown): ToolsDownloadPageConfig {
  const input = (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Partial<ToolsDownloadPageConfig>;
  const faqItems = normalizeFaqItems(input.faq_items);
  return {
    seo_title: optionalString(input.seo_title) || DEFAULT_TOOLS_DOWNLOAD_PAGE_CONFIG.seo_title,
    seo_description: optionalString(input.seo_description) || DEFAULT_TOOLS_DOWNLOAD_PAGE_CONFIG.seo_description,
    seo_keywords: optionalString(input.seo_keywords) || DEFAULT_TOOLS_DOWNLOAD_PAGE_CONFIG.seo_keywords,
    h1: optionalString(input.h1) || DEFAULT_TOOLS_DOWNLOAD_PAGE_CONFIG.h1,
    hero_description: optionalString(input.hero_description) || DEFAULT_TOOLS_DOWNLOAD_PAGE_CONFIG.hero_description,
    content_sections: Array.isArray(input.content_sections)
      ? input.content_sections.map((item) => ({
        title: optionalString(item?.title),
        body: optionalString(item?.body),
      })).filter((item) => item.title && item.body)
      : DEFAULT_TOOLS_DOWNLOAD_PAGE_CONFIG.content_sections,
    faq_items: faqItems,
  };
}

function normalizeFaqItems(value: unknown): ToolsDownloadPageConfig['faq_items'] {
  if (!Array.isArray(value)) {
    return DEFAULT_TOOLS_DOWNLOAD_PAGE_CONFIG.faq_items;
  }
  const items = value.map((item) => ({
    question: optionalString(item?.question),
    answer: optionalString(item?.answer),
  })).filter((item) => item.question && item.answer);
  return isLegacyDefaultToolDownloadFaq(items) ? DEFAULT_TOOLS_DOWNLOAD_PAGE_CONFIG.faq_items : items;
}

function isLegacyDefaultToolDownloadFaq(items: ToolsDownloadPageConfig['faq_items']): boolean {
  return items.length === LEGACY_DEFAULT_TOOL_DOWNLOAD_FAQ_QUESTIONS.length
    && items.every((item, index) => item.question === LEGACY_DEFAULT_TOOL_DOWNLOAD_FAQ_QUESTIONS[index]);
}

function getDefaultPublishedItems(platform: ToolDownloadPlatform | null): ToolDownloadItem[] {
  const now = '2026-07-08 00:00:00';
  return DEFAULT_HOT_TOOL_DOWNLOADS
    .filter((item) => !platform || item.platforms.includes(platform))
    .map((item, index) => ({
      id: index + 1,
      ...item,
      download_count: 0,
      status: 'published',
      published_at: now,
      content_updated_at: null,
      created_at: now,
      updated_at: now,
    }));
}

function parsePlatforms(value: unknown): ToolDownloadPlatform[] {
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'BAD_REQUEST', 'platforms 必须是数组');
  }
  const platforms = value.map((item) => String(item)).filter(isToolDownloadPlatform);
  if (platforms.length === 0) {
    throw new HttpError(400, 'BAD_REQUEST', '至少选择一个系统平台');
  }
  return Array.from(new Set(platforms));
}

function parsePlatformVersions(value: unknown): ToolDownloadPlatformVersions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const versions: ToolDownloadPlatformVersions = {};
  for (const platform of TOOL_DOWNLOAD_PLATFORMS) {
    const version = optionalString((value as Record<string, unknown>)[platform]);
    if (version) {
      versions[platform] = version;
    }
  }
  return versions;
}

function parsePrimaryAction(value: unknown): ToolDownloadPrimaryAction {
  const action = String(value || 'official');
  if (action === 'official' || action === 'local') {
    return action;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'primary_action 只能是 official 或 local');
}

function parseStatus(value: unknown): ToolDownloadStatus {
  const status = String(value || '');
  if (status === 'draft' || status === 'published' || status === 'archived') {
    return status;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'status 无效');
}

function mustSlug(value: unknown): string {
  const slug = optionalString(value).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,126}[a-z0-9]$/.test(slug)) {
    throw new HttpError(400, 'BAD_REQUEST', 'slug 只能包含小写字母、数字和连字符');
  }
  return slug;
}

function mustString(value: unknown, field: string): string {
  const text = optionalString(value);
  if (!text) {
    throw new HttpError(400, 'BAD_REQUEST', `${field} 不能为空`);
  }
  return text;
}

function optionalString(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function toInteger(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isInteger(number)) {
    throw new HttpError(400, 'BAD_REQUEST', `${field} 必须是整数`);
  }
  return number;
}
