import { DEFAULT_IP_PURITY_CONFIG, IP_PURITY_PATH } from './ipPurity';
import { withPublicBrandTitle } from './publicBrand';

export type PublicToolKey = 'download' | 'streaming_check' | 'ip_check' | 'dns_leak_test' | 'ip_purity';

export interface PublicToolDefinition {
  key: PublicToolKey;
  label: string;
  href: string;
  eyebrow: string;
  summary: string;
  features: readonly string[];
  seo: {
    title: string;
    description: string;
    keywords: string;
  };
}

export const PUBLIC_TOOLS_INDEX_PATH = '/tools';
export const PUBLIC_TOOLS_DOWNLOAD_PATH = '/tools/download';

export const PUBLIC_TOOLS_INDEX_SEO = {
  title: withPublicBrandTitle('网络检测与科学上网工具箱'),
  description: 'GateRank 工具箱集中提供翻墙客户端下载、流媒体解锁检测、IP 地理位置查询、IP 纯净度与 DNS 泄漏检测，帮助用户检查代理客户端和当前网络环境。',
  keywords: 'GateRank工具箱,翻墙工具下载,流媒体解锁检测,IP检测,DNS泄漏检测,IP纯净度检测,科学上网工具',
} as const;

export const PUBLIC_TOOL_DEFINITIONS: readonly PublicToolDefinition[] = [
  {
    key: 'download',
    label: '翻墙工具下载',
    href: PUBLIC_TOOLS_DOWNLOAD_PATH,
    eyebrow: 'Client downloads',
    summary: '按 Windows、macOS、iOS、Android 与 Linux 查找常用代理客户端和可信安装入口。',
    features: ['五大平台', '受控下载', '官方入口'],
    seo: {
      title: '翻墙工具下载',
      description: '按设备平台选择科学上网客户端、机场订阅工具与可信安装包。',
      keywords: '翻墙工具下载,科学上网客户端,机场订阅工具',
    },
  },
  {
    key: 'streaming_check',
    label: '流媒体解锁检测',
    href: '/tools/streaming-check',
    eyebrow: 'Streaming access',
    summary: '检测 ChatGPT、Netflix、Claude、TikTok、Disney+ 与 HBO Max 的地区覆盖和基础连通性。',
    features: ['六项服务', '地区判断', '连通验证'],
    seo: {
      title: '流媒体解锁检测 | ChatGPT、Netflix、Claude、TikTok、Disney+、HBO Max',
      description: '根据当前出口地区检测 ChatGPT、Netflix、Claude、TikTok、Disney+ 和 HBO Max 的官方覆盖情况，并以基础资源连通结果辅助判断。',
      keywords: '流媒体解锁检测,Netflix解锁检测,ChatGPT检测,Claude检测,TikTok检测,Disney+检测,HBO Max检测',
    },
  },
  {
    key: 'ip_check',
    label: 'IP 检测',
    href: '/tools/ip-check',
    eyebrow: 'IP geolocation',
    summary: '查询当前出口 IP、IPv4、IPv6 或域名对应的地区、ISP、组织、ASN 与时区信息。',
    features: ['IPv4 / IPv6', 'ISP / ASN', '地图定位'],
    seo: {
      title: 'IP 地理位置查询 | IP 地址、域名、ISP 与 ASN 检测',
      description: '免费查询当前出口 IP、IPv4、IPv6 或域名的国家地区、城市、经纬度、时区、ISP、组织与 ASN 信息。',
      keywords: 'IP检测,IP地址查询,IP归属地,域名查询,IPv6查询,ISP查询,ASN查询',
    },
  },
  {
    key: 'ip_purity',
    label: 'IP 纯净度检测',
    href: IP_PURITY_PATH,
    eyebrow: 'IP risk intelligence',
    summary: '查询原生 IP、网络归属、ASN 路由历史与注册分配记录。',
    features: ['原生 IP', 'ASN 历史', '注册记录'],
    seo: { title: DEFAULT_IP_PURITY_CONFIG.seo_title, description: DEFAULT_IP_PURITY_CONFIG.seo_description, keywords: DEFAULT_IP_PURITY_CONFIG.seo_keywords },
  },
  {
    key: 'dns_leak_test',
    label: 'DNS 泄漏检测',
    href: '/tools/dns-leak-test',
    eyebrow: 'Resolver inspection',
    summary: '通过独立权威 DNS 探针识别递归解析器，并比较出口地区、运营商与 DNSSEC 信号。',
    features: ['十次探针', '解析器证据', 'DNSSEC 信号'],
    seo: {
      title: 'DNS Leak Test | DNS 泄漏、解析器与 DNSSEC 检测',
      description: '通过独立权威 DNS 探针检测当前网络实际使用的递归 DNS 解析器，并比较出口地区、运营商与 DNSSEC 能力信号。',
      keywords: 'DNS Leak Test,DNS泄漏检测,DNS服务器检测,DNSSEC检测,代理DNS泄漏,VPN DNS检测',
    },
  },
] as const;

export function getPublicToolDefinition(key: PublicToolKey): PublicToolDefinition {
  const tool = PUBLIC_TOOL_DEFINITIONS.find((item) => item.key === key);
  if (!tool) {
    throw new Error(`Unknown public tool: ${key}`);
  }
  return tool;
}
