export const TOOL_DOWNLOAD_PLATFORMS = ['windows', 'macos', 'ios', 'android', 'linux'] as const;

export type ToolDownloadPlatform = (typeof TOOL_DOWNLOAD_PLATFORMS)[number];
export type ToolDownloadStatus = 'draft' | 'published' | 'archived';
export type ToolDownloadPrimaryAction = 'official' | 'local';
export type ToolDownloadPlatformVersions = Partial<Record<ToolDownloadPlatform, string>>;

export interface ToolsDownloadPageContentSection {
  title: string;
  body: string;
}

export interface ToolsDownloadPageFaqItem {
  question: string;
  answer: string;
}

export interface ToolsDownloadPageConfig {
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  h1: string;
  hero_description: string;
  content_sections: ToolsDownloadPageContentSection[];
  faq_items: ToolsDownloadPageFaqItem[];
}

export interface ToolDownloadItem {
  id: number;
  slug: string;
  name: string;
  summary: string;
  description: string;
  platforms: ToolDownloadPlatform[];
  platform_versions: ToolDownloadPlatformVersions;
  icon_url: string;
  local_file_url: string;
  official_url: string;
  primary_action: ToolDownloadPrimaryAction;
  version: string;
  file_size_label: string;
  file_extension?: string;
  is_hot: boolean;
  sort_order: number;
  status: ToolDownloadStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ToolsDownloadPageView {
  config: ToolsDownloadPageConfig;
  platform: ToolDownloadPlatform | null;
  platforms: readonly ToolDownloadPlatform[];
  items: ToolDownloadItem[];
  hotItems: ToolDownloadItem[];
  total: number;
}

export const DEFAULT_TOOLS_DOWNLOAD_PAGE_CONFIG: ToolsDownloadPageConfig = {
  seo_title: '翻墙工具下载 | 科学上网客户端、机场订阅工具与代理软件下载',
  seo_description: 'GateRank 翻墙工具下载页收录 Windows、macOS、iOS、Android、Linux 常用科学上网客户端，支持 Clash Verge Rev、v2rayN、Shadowrocket、Stash、sing-box、Hiddify 等工具的官方页面跳转与后台上传安装包。',
  seo_keywords: '翻墙工具下载,科学上网客户端下载,机场订阅工具,Clash Verge Rev,v2rayN,Shadowrocket,Stash,sing-box,Hiddify,VPN客户端',
  h1: '翻墙工具下载：科学上网客户端与机场订阅工具',
  hero_description: '按系统筛选常用代理客户端，优先展示官方页面和后台上传的可信安装包，帮助用户从机场排行进入可用客户端选择。',
  content_sections: [
    {
      title: '按系统选择科学上网客户端',
      body: 'Windows、macOS、iOS、Android 和 Linux 对客户端兼容性要求不同。下载前先确认系统平台、订阅格式和机场支持的协议，再选择对应工具。',
    },
    {
      title: '官方页面和本地安装包如何选择',
      body: '优先访问官方页面获取最新版；当后台上传了明确版本的安装包时，可以直接下载本地文件。本站不建议使用来历不明的第三方镜像。',
    },
    {
      title: '客户端和机场订阅的关系',
      body: '机场提供节点订阅和服务能力，客户端负责导入订阅、切换节点和发起代理连接。选择客户端时需要同时参考系统、协议、更新频率和易用性。',
    },
  ],
  faq_items: [
    {
      question: '翻墙工具和机场 VPN 是一回事吗？',
      answer: '不是。机场通常提供订阅链接和节点服务，翻墙工具或科学上网客户端负责导入订阅并连接节点。',
    },
    {
      question: '下载客户端后可以直接使用吗？',
      answer: '通常还需要机场订阅链接或节点配置。可以先在 GateRank 查看机场排行和测评，再把订阅导入对应客户端。',
    },
    {
      question: '为什么优先展示官方页面？',
      answer: '代理客户端属于网络安全敏感软件，官方发布页和后台明确上传的文件更容易追踪来源、版本和更新状态。',
    },
  ],
};

export const DEFAULT_HOT_TOOL_DOWNLOADS: Omit<ToolDownloadItem, 'id' | 'created_at' | 'updated_at' | 'published_at' | 'status'>[] = [
  {
    slug: 'clash-verge-rev',
    name: 'Clash Verge Rev',
    summary: '适合 Windows、macOS、Linux 的 Clash Meta 图形客户端。',
    description: 'Clash Verge Rev 是常见的跨平台代理客户端，适合导入机场订阅并管理规则、代理组和节点切换。',
    platforms: ['windows', 'macos', 'linux'],
    platform_versions: {
      windows: 'Windows 10/11',
      macos: 'macOS 12+',
      linux: 'Ubuntu 20.04+ / Debian 11+',
    },
    icon_url: '',
    local_file_url: '',
    official_url: 'https://github.com/clash-verge-rev/clash-verge-rev',
    primary_action: 'official',
    version: 'latest',
    file_size_label: '',
    is_hot: true,
    sort_order: 10,
  },
  {
    slug: 'v2rayn',
    name: 'v2rayN',
    summary: 'Windows 常用 V2Ray、Xray 和 sing-box 客户端。',
    description: 'v2rayN 是 Windows 用户常用的科学上网客户端，适合导入多种代理协议和机场订阅。',
    platforms: ['windows'],
    platform_versions: {
      windows: 'Windows 10/11',
    },
    icon_url: '',
    local_file_url: '',
    official_url: 'https://github.com/2dust/v2rayN',
    primary_action: 'official',
    version: 'latest',
    file_size_label: '',
    is_hot: true,
    sort_order: 20,
  },
  {
    slug: 'shadowrocket',
    name: 'Shadowrocket',
    summary: 'iPhone 和 iPad 常用代理客户端。',
    description: 'Shadowrocket 是 iOS 平台常见的代理客户端，适合导入机场订阅并按规则转发流量。',
    platforms: ['ios'],
    platform_versions: {
      ios: 'iOS 15+',
    },
    icon_url: '',
    local_file_url: '',
    official_url: 'https://apps.apple.com/us/app/shadowrocket/id932747118',
    primary_action: 'official',
    version: 'latest',
    file_size_label: '',
    is_hot: true,
    sort_order: 30,
  },
  {
    slug: 'stash',
    name: 'Stash',
    summary: 'iOS 和 macOS 规则代理客户端。',
    description: 'Stash 支持规则代理和订阅导入，适合 Apple 生态用户统一管理科学上网配置。',
    platforms: ['ios', 'macos'],
    platform_versions: {
      ios: 'iOS 15+',
      macos: 'macOS 12+',
    },
    icon_url: '',
    local_file_url: '',
    official_url: 'https://apps.apple.com/us/app/stash-rule-based-proxy/id1596063349',
    primary_action: 'official',
    version: 'latest',
    file_size_label: '',
    is_hot: true,
    sort_order: 40,
  },
  {
    slug: 'sing-box',
    name: 'sing-box',
    summary: '跨平台通用代理核心与客户端生态。',
    description: 'sing-box 是跨平台代理工具生态，适合需要多协议、多平台和高级配置的用户。',
    platforms: ['windows', 'macos', 'ios', 'android', 'linux'],
    platform_versions: {
      windows: 'Windows 10/11',
      macos: 'macOS 12+',
      ios: 'iOS 15+',
      android: 'Android 8+',
      linux: 'Ubuntu 20.04+ / Debian 11+',
    },
    icon_url: '',
    local_file_url: '',
    official_url: 'https://sing-box.sagernet.org/',
    primary_action: 'official',
    version: 'latest',
    file_size_label: '',
    is_hot: true,
    sort_order: 50,
  },
  {
    slug: 'hiddify',
    name: 'Hiddify',
    summary: '新手友好的跨平台代理客户端。',
    description: 'Hiddify 提供跨平台代理客户端体验，适合需要图形界面和快速导入订阅的新手用户。',
    platforms: ['windows', 'macos', 'ios', 'android', 'linux'],
    platform_versions: {
      windows: 'Windows 10/11',
      macos: 'macOS 12+',
      ios: 'iOS 15+',
      android: 'Android 8+',
      linux: 'Ubuntu 20.04+ / Debian 11+',
    },
    icon_url: '',
    local_file_url: '',
    official_url: 'https://github.com/hiddify/hiddify-app',
    primary_action: 'official',
    version: 'latest',
    file_size_label: '',
    is_hot: true,
    sort_order: 60,
  },
];

export function isToolDownloadPlatform(value: unknown): value is ToolDownloadPlatform {
  return TOOL_DOWNLOAD_PLATFORMS.includes(value as ToolDownloadPlatform);
}

export function getToolDownloadPlatformLabel(platform: ToolDownloadPlatform): string {
  const labels: Record<ToolDownloadPlatform, string> = {
    windows: 'Windows',
    macos: 'macOS',
    ios: 'iOS',
    android: 'Android',
    linux: 'Linux',
  };
  return labels[platform];
}

export function buildToolDownloadPlatformHeading(platform: ToolDownloadPlatform): string {
  return `${getToolDownloadPlatformLabel(platform)} 翻墙工具下载`;
}

export function buildToolDownloadTrustMeta(
  item: Pick<ToolDownloadItem, 'version' | 'published_at' | 'updated_at'>,
): string {
  const versionLabel = item.version.trim() || '以官方发布页为准';
  const dateLabel = formatToolDownloadDate(item.published_at || item.updated_at);
  return `版本：${versionLabel} · 发布：${dateLabel}`;
}

export function buildToolDownloadFilename(item: ToolDownloadItem, platform: ToolDownloadPlatform): string {
  const platformLabel = getToolDownloadPlatformLabel(platform);
  const versionLabel = item.version || item.platform_versions?.[platform] || 'latest';
  const stem = [item.name, platformLabel, versionLabel]
    .map(sanitizeDownloadFilenamePart)
    .filter(Boolean)
    .join('-') || sanitizeDownloadFilenamePart(`${item.slug}-${platform}`) || 'download';
  return `${stem}${item.file_extension || getToolDownloadFileExtension(item.local_file_url)}`;
}

export function buildToolControlledDownloadUrl(item: Pick<ToolDownloadItem, 'slug'>, platform: ToolDownloadPlatform): string {
  return `/download/file/${encodeURIComponent(item.slug)}?platform=${encodeURIComponent(platform)}`;
}

export function buildToolPublicLocalFileMarker(item: Pick<ToolDownloadItem, 'local_file_url'>): string {
  const extension = getToolDownloadFileExtension(item.local_file_url);
  return item.local_file_url ? `/download/file${extension}` : '';
}

export function getToolDownloadFileExtension(url: string): string {
  return getDownloadFileExtension(url);
}

function sanitizeDownloadFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '');
}

function formatToolDownloadDate(value: string | null): string {
  const match = (value || '').match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] || '待补充';
}

function getDownloadFileExtension(url: string): string {
  const pathname = url.split(/[?#]/, 1)[0] || '';
  const doubleExtension = pathname.match(/(\.tar\.(?:gz|bz2|xz|zst))$/i)?.[1];
  if (doubleExtension) {
    return doubleExtension;
  }
  return pathname.match(/(\.[A-Za-z0-9][A-Za-z0-9_-]{0,15})$/)?.[1] || '';
}
