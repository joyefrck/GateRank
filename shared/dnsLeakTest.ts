export const DNS_LEAK_TEST_TOTAL_PROBES = 10;
export const DNS_LEAK_TEST_DURATION_MS = 8_000;
export const DNS_LEAK_TEST_SESSION_TTL_MS = 120_000;

export type DnsLeakTestStatus = 'running' | 'complete' | 'inconclusive';
export type DnsLeakVerdict = 'no_obvious_leak' | 'possible_leak' | 'inconclusive';
export type DnsLeakCountryConsistency = 'matched' | 'mismatched' | 'unknown';
export type DnssecSignal = 'observed' | 'not_observed' | 'unknown';
export type EncryptedDnsDetection = 'not_detectable';

export interface DnsLeakNetworkInfo {
  ip: string;
  country: string;
  country_code: string;
  isp: string;
  organization: string;
  asn: string;
}

export interface DnsLeakResolverInfo extends DnsLeakNetworkInfo {
  dnssec_ok: boolean;
  query_types: string[];
  observation_count: number;
}

export interface DnsLeakTestStartResponse {
  session_id: string;
  expires_at: string;
  complete_after: string;
  total_probes: typeof DNS_LEAK_TEST_TOTAL_PROBES;
  probe_hosts: string[];
}

export interface DnsLeakTestResultRequest {
  session_id: string;
}

export interface DnsLeakTestResultResponse {
  status: DnsLeakTestStatus;
  checked_at: string;
  observed_probe_count: number;
  total_probes: typeof DNS_LEAK_TEST_TOTAL_PROBES;
  network: DnsLeakNetworkInfo;
  resolvers: DnsLeakResolverInfo[];
  verdict: DnsLeakVerdict;
  country_consistency: DnsLeakCountryConsistency;
  dnssec_signal: DnssecSignal;
  doh: EncryptedDnsDetection;
  dot: EncryptedDnsDetection;
}

export interface DnsLeakObservation {
  event_id: string;
  session_id: string;
  probe_index: number;
  resolver_ip: string;
  query_type: string;
  dnssec_ok: boolean;
  observed_at: string;
}

export interface DnsLeakAssessment {
  verdict: DnsLeakVerdict;
  country_consistency: DnsLeakCountryConsistency;
}

const DNS_QUERY_TYPE_PRIORITY: Readonly<Record<string, number>> = {
  A: 0,
  AAAA: 1,
  HTTPS: 2,
};

export function sortDnsQueryTypes(values: ReadonlyArray<string>): string[] {
  return [...new Set(
    values
      .map((value) => String(value || '').trim().toUpperCase())
      .filter(Boolean),
  )].sort((left, right) => (
    (DNS_QUERY_TYPE_PRIORITY[left] ?? Number.MAX_SAFE_INTEGER)
    - (DNS_QUERY_TYPE_PRIORITY[right] ?? Number.MAX_SAFE_INTEGER)
    || left.localeCompare(right)
  ));
}

export function compareDnsLeakResolvers(
  left: Pick<DnsLeakResolverInfo, 'ip' | 'observation_count'>,
  right: Pick<DnsLeakResolverInfo, 'ip' | 'observation_count'>,
): number {
  return right.observation_count - left.observation_count
    || left.ip.localeCompare(right.ip);
}

export function assessDnsLeak(
  networkCountryCode: string,
  resolvers: ReadonlyArray<Pick<DnsLeakResolverInfo, 'country_code'>>,
): DnsLeakAssessment {
  const networkCountry = normalizeCountryCode(networkCountryCode);
  if (!networkCountry || resolvers.length === 0) {
    return {
      verdict: 'inconclusive',
      country_consistency: 'unknown',
    };
  }

  const resolverCountries = resolvers.map((resolver) => normalizeCountryCode(resolver.country_code));
  if (resolverCountries.some((country) => country && country !== networkCountry)) {
    return {
      verdict: 'possible_leak',
      country_consistency: 'mismatched',
    };
  }
  if (resolverCountries.some((country) => !country)) {
    return {
      verdict: 'inconclusive',
      country_consistency: 'unknown',
    };
  }
  return {
    verdict: 'no_obvious_leak',
    country_consistency: 'matched',
  };
}

export function deriveDnssecSignal(
  observations: ReadonlyArray<Pick<DnsLeakObservation, 'dnssec_ok'>>,
): DnssecSignal {
  if (observations.length === 0) return 'unknown';
  return observations.some((observation) => observation.dnssec_ok)
    ? 'observed'
    : 'not_observed';
}

export function normalizeCountryCode(value: unknown): string {
  const code = String(value || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) && !['XX', 'T1', 'ZZ'].includes(code) ? code : '';
}
