import type {
  DnsLeakResolverInfo,
  DnsLeakTestResultResponse,
  DnsLeakVerdict,
  DnsLeakCountryConsistency,
  DnssecSignal,
} from '../../../shared/dnsLeakTest';
import {
  compareDnsLeakResolvers,
  normalizeCountryCode,
  sortDnsQueryTypes,
} from '../../../shared/dnsLeakTest';

const zhRegionNames = new Intl.DisplayNames(['zh-Hans'], { type: 'region' });

export interface DnsResolverEvidenceRow {
  ip: string;
  location: string;
  network: string;
  asn: string;
  asnValue: string;
  observation: string;
  queryTypes: string[];
}

export function dnsLeakVerdictLabel(value: DnsLeakVerdict): string {
  if (value === 'no_obvious_leak') return '未发现明显异常';
  if (value === 'possible_leak') return '可能存在 DNS 泄漏';
  return '无法判定';
}

export function countryConsistencyLabel(value: DnsLeakCountryConsistency): string {
  if (value === 'matched') return '一致';
  if (value === 'mismatched') return '不一致';
  return '无法判断';
}

export function dnssecSignalLabel(value: DnssecSignal): string {
  if (value === 'observed') return '观察到 DNSSEC 能力信号';
  if (value === 'not_observed') return '未观察到 DNSSEC 能力信号';
  return '无法判断';
}

export function resolveDnsLeakErrorMessage(code: string): string {
  if (code === 'DNS_LEAK_TEST_NOT_CONFIGURED') return 'DNS 泄漏检测尚未配置，请稍后再试。';
  if (code === 'DNS_LEAK_TEST_CLIENT_IP_REQUIRED') return '无法识别当前出口 IP，请检查网络后重试。';
  if (code === 'DNS_LEAK_TEST_SESSION_NOT_FOUND') return '检测会话已过期，请重新开始检测。';
  if (code === 'DNS_LEAK_TEST_RATE_LIMITED') return '检测请求过于频繁，请稍后再试。';
  if (code === 'DNS_LEAK_TEST_TIMEOUT') return '检测请求超时，请重新检测。';
  return 'DNS 泄漏检测暂时不可用，请稍后重试。';
}

export function formatDnsCountryName(countryCode: string, fallback: string): string {
  const code = normalizeCountryCode(countryCode);
  const localized = code ? zhRegionNames.of(code) : '';
  return localized && localized !== code
    ? localized
    : String(fallback || '').trim() || '地区未知';
}

export function formatDnsAsnLabel(asn: string): string {
  const value = String(asn || '').trim().toUpperCase();
  return value ? `自治系统编号 ${value}` : '自治系统编号未知';
}

export function formatDnsQueryTypeLabel(queryType: string): string {
  const value = String(queryType || '').trim().toUpperCase();
  if (value === 'A') return 'A · IPv4 地址查询';
  if (value === 'AAAA') return 'AAAA · IPv6 地址查询';
  if (value === 'HTTPS') return 'HTTPS · HTTPS 服务参数查询';
  return `${value || '未知类型'} · 其他 DNS 查询`;
}

export function buildDnsResolverEvidenceRows(
  resolvers: ReadonlyArray<DnsLeakResolverInfo>,
  totalProbes: number,
): DnsResolverEvidenceRow[] {
  return [...resolvers]
    .sort(compareDnsLeakResolvers)
    .map((resolver) => {
      const queryTypes = sortDnsQueryTypes(resolver.query_types);
      return {
        ip: resolver.ip,
        location: formatDnsCountryName(resolver.country_code, resolver.country),
        network: resolver.organization || resolver.isp || '所属网络未知',
        asn: formatDnsAsnLabel(resolver.asn),
        asnValue: String(resolver.asn || '').trim().toUpperCase() || '未知',
        observation: `命中 ${resolver.observation_count}/${totalProbes} 个测试域名`,
        queryTypes: (queryTypes.length > 0 ? queryTypes : ['']).map(formatDnsQueryTypeLabel),
      };
    });
}

export function formatDnsLeakTestCopy(result: DnsLeakTestResultResponse): string {
  const resolverRows = buildDnsResolverEvidenceRows(
    result.resolvers,
    result.total_probes,
  );
  const resolvers = resolverRows.length > 0
    ? resolverRows.map((row, index) => [
      `${index + 1}. ${row.ip} · ${row.location} · ${row.network} · ${row.asn}`,
      `   ${row.observation} · ${row.queryTypes.join('；')}`,
    ].join('\n')).join('\n')
    : '未发现解析器';

  return [
    'GateRank DNS Leak Test',
    `检测时间：${result.checked_at}`,
    `当前出口：${result.network.ip || '未知'} · ${formatDnsCountryName(result.network.country_code, result.network.country)} · ${result.network.organization || result.network.isp || '所属网络未知'}`,
    `泄漏风险：${dnsLeakVerdictLabel(result.verdict)}`,
    `DNS 与出口地区：${countryConsistencyLabel(result.country_consistency)}`,
    `DNSSEC：${dnssecSignalLabel(result.dnssec_signal)}`,
    'DoH：网页无法可靠判断',
    'DoT：网页无法可靠判断',
    '',
    '检测到的 DNS 解析器：',
    resolvers,
    '',
    '说明：结果是基于本轮权威 DNS 查询与 HTTP 出口国家的风险比较，不代表对 VPN 配置的绝对判定。',
  ].join('\n');
}
