export type NativeProviderVerdict = 'native' | 'broadcast' | 'unknown';
export type NativeLookupError = 'quota' | 'timeout' | 'unavailable' | 'busy';
export interface NativeIpEvidence {
  provider_type: NativeProviderVerdict | null;
  provider_checked_at: string | null;
  provider_cached_only: boolean;
  registered_country: string | null;
  registry: string | null;
  prefix: string | null;
  registry_date: string | null;
  ipok_error: NativeLookupError | null;
  registry_error: NativeLookupError | null;
  checked_at: string;
  cached: boolean;
}
export interface NativeIpResult extends NativeIpEvidence { location_country: string | null }
export function nativeIpAssessment(result: NativeIpResult | null | undefined): { label: string; explanation: string } {
  if (!result) return { label: '暂时无法判定', explanation: '原生 IP 数据查询暂时不可用，请重试。' };
  const comparable = Boolean(result.registered_country && result.location_country);
  const match = comparable && result.registered_country === result.location_country;
  const verdict = result.provider_type;
  if (comparable && ((verdict === 'native' && !match) || (verdict === 'broadcast' && match))) return { label: '数据源存在分歧', explanation: 'IPOK 标签与注册国家对比结果不同，暂不下确定结论。' };
  if (verdict === 'native') return { label: '原生 IP', explanation: 'IPOK 返回原生标签，属于注册归属一致性判定，不代表家庭宽带或平台可用。' };
  if (verdict === 'broadcast') return { label: '广播 IP', explanation: 'IPOK 返回广播标签，属于注册归属一致性判定，不代表恶意行为。' };
  if (comparable) return match
    ? { label: '原生 IP', explanation: 'RIPE NCC 分配记录的国家与定位数据源返回的国家一致。这是归属一致性参考，不能证明实际路由或物理位置。' }
    : { label: '广播 IP', explanation: '按宽松分类，注册国家与定位国家不同显示广播 IP。这是注册归属对比结果，可能受跨区使用、资源迁移或地理库差异影响。' };
  return { label: '证据不足', explanation: '数据源尚未给出明确标签，或缺少注册国家 / 定位国家，暂时无法完成判定。' };
}
