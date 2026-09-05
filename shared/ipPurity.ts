import type { IpHistoryResult } from './ipHistory';
import type { NativeIpResult } from './nativeIp';
import type { IpCheckResult } from './ipCheck';
import { withPublicBrandTitle } from './publicBrand';

export const IP_PURITY_PATH = '/tools/ip-purity-check';
export interface IpPurityPageConfig {
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  og_image_url: string;
  og_image_alt: string;
}
export const DEFAULT_IP_PURITY_CONFIG: IpPurityPageConfig = {
  seo_title: '免费 IP 纯净度检测、原生 IP 查询与 ASN 历史',
  seo_description: '机场榜 GateRank 免费 IP 纯净度检测工具，支持机场节点出口 IP、IPv4 与 IPv6 查询，识别原生 IP、广播 IP、家庭宽带 IP 与 IDC 机房 IP，查看城市归属地、ISP、ASN 路由历史、企业登记和注册国家，帮助了解代理节点的网络归属。',
  seo_keywords: '机场榜,GateRank,机场榜GateRank,机场榜IP纯净度检测,GateRank原生IP查询,免费IP纯净度检测,机场节点IP检测,机场出口IP查询,代理节点IP归属地查询,原生IP查询,广播IP检测,家庭宽带IP检测,IDC机房IP查询,IPv4归属地查询,IPv6归属地查询,ASN历史查询,IP注册国家查询',
  og_image_url: '/og/tools.png',
  og_image_alt: '机场榜 GateRank 免费 IP 纯净度检测与原生 IP 查询工具',
};
export type IpPurityFailure = 'quota' | 'timeout' | 'unavailable';
export interface IpPurityRisk {
  score: number | null;
  proxy: boolean | null;
  vpn: boolean | null;
  tor: boolean | null;
  hosting: boolean | null;
  checked_at: string;
  cached: boolean;
}
export interface IpPurityGeo extends IpCheckResult {
  source?: 'FreeIPAPI' | 'ipwho.is';
  checked_at?: string;
  cached?: boolean;
}
export interface IpPurityResult {
  ip: string;
  checked_at: string;
  geo: IpPurityGeo | null;
  risk: IpPurityRisk | null;
  risk_error: IpPurityFailure | null;
  native?: NativeIpResult | null;
  history?: IpHistoryResult | null;
}
export const IP_PURITY_FAQ = [
  { question: '机场榜 GateRank 如何查询机场节点出口 IP？', answer: '连接需要查询的节点后，打开 GateRank IP 纯净度检测工具，留空查询框并点击查询即可识别当前出口；也可以输入指定公网 IPv4 或 IPv6 地址，查看原生 IP 分类、城市归属地、ISP 和 ASN 历史。' },
  { question: '原生 IP 或家庭宽带 IP 能保证流媒体解锁吗？', answer: '不能。IP 类型和注册归属不能直接代表流媒体或其他平台的可用性。机场榜 GateRank 同时提供流媒体解锁检测与 DNS 泄漏检测，可结合这些工具检查当前节点的实际表现。' },
  { question: '这些历史记录说明什么？', answer: '本工具结合原生标签、网络归属和历史记录帮助了解 IP。ASN 历史来自路由观测，注册地历史来自分配记录；企业登记记录不等于完整企业变更历史。' },
  { question: '网络类型如何分类？', answer: '采用宽松分类：数据源明确返回未检测到机房时，显示“家庭宽带 IP”；检测到机房时显示“IDC机房 IP”；查询失败或缺少机房字段时显示暂无数据。这是基于机房信号的分类口径，并非家庭宽带线路的直接认证。' },
  { question: '原生 IP 是如何判定的？', answer: '优先展示 IPOK 返回的原生或广播标签；缺少标签时，对比 RIPE NCC 的 IP 分配注册国家和定位数据源返回的国家，注册国家一致时显示“原生 IP”，不一致时按宽松分类显示“广播 IP”；这里的原生标签采用注册归属一致性的判定口径。国家一致只是归属参考，不证明实际路由、家庭宽带或平台可用；来源冲突时显示分歧，缺少证据时保留未知。' },
  { question: '查询如何处理我的 IP 地址？', answer: '查询 IP 会发送给 FreeIPAPI 获取城市归属地，失败时回退到 ipwho.is，发送给 proxycheck.io 获取风险信号，并通过 IPOK 和 RIPE NCC 查询原生标签与注册国家。GateRank 不持久保存检测结果；风险结果在进程内缓存最多 1 小时，基础归属地与注册国家最多 24 小时，IPOK 标签最多 1 小时。供应商按各自政策处理查询。' },
  { question: '为什么检测结果会变化或暂时不可用？', answer: 'IP 分配和数据源记录会变化，重新检测可能复用标明时间的缓存。免费额度耗尽、超时或缺少字段时显示暂无数据或不可用，不将失败解释成低风险。' },
] as const;
export function riskLevel(score: number | null): { label: string; tone: 'unknown' | 'low' | 'medium' | 'high' } {
  if (score === null) return { label: '暂无评分', tone: 'unknown' };
  if (score <= 25) return { label: '低风险', tone: 'low' };
  if (score <= 50) return { label: '需关注', tone: 'medium' };
  return { label: '高风险', tone: 'high' };
}
export function buildIpPuritySeo(config: IpPurityPageConfig, siteUrl: string) {
  const origin = siteUrl.replace(/\/+$/, '');
  return {
    title: withPublicBrandTitle(config.seo_title),
    description: config.seo_description,
    keywords: config.seo_keywords,
    canonicalPath: IP_PURITY_PATH,
    ogImage: { url: new URL(config.og_image_url, origin).href, alt: config.og_image_alt },
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebApplication', name: 'GateRank IP 纯净度检测', description: config.seo_description, url: `${origin}${IP_PURITY_PATH}`, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Web', offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' } },
        { '@type': 'BreadcrumbList', itemListElement: [['首页', '/'], ['工具', '/tools'], ['IP 纯净度检测', IP_PURITY_PATH]].map(([name, path], index) => ({ '@type': 'ListItem', position: index + 1, name, item: `${origin}${path}` })) },
        { '@type': 'FAQPage', mainEntity: IP_PURITY_FAQ.map(({ question, answer }) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })) },
      ],
    },
  };
}
