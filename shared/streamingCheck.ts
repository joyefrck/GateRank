export type StreamingServiceKey =
  | 'chatgpt'
  | 'netflix'
  | 'claude'
  | 'tiktok'
  | 'disney_plus'
  | 'hbo_max';

export type StreamingRegionSupport = 'supported' | 'unsupported' | 'unknown';
export type StreamingReachability = 'pending' | 'reachable' | 'unreachable' | 'timeout';
export type StreamingMergedState =
  | 'pending'
  | 'likely_supported'
  | 'reachable_region_unsupported'
  | 'reachable_only'
  | 'unconfirmed';
export type NetflixInferredRegion = 'us' | 'jp' | 'sg' | 'other' | 'unknown';

export interface StreamingServiceDefinition {
  key: StreamingServiceKey;
  label: string;
  short_label: string;
  probe_url: string;
}

export interface StreamingRegionAssessment {
  key: StreamingServiceKey;
  label: string;
  region_support: StreamingRegionSupport;
  basis: 'official_country_policy' | 'connectivity_only';
  note: string;
}

export interface StreamingCheckResponse {
  checked_at: string;
  policy_checked_at: string;
  network: {
    ip: string;
    country_code: string;
    country_name: string;
  };
  services: StreamingRegionAssessment[];
  netflix: {
    inferred_region: NetflixInferredRegion;
    catalog_scope: 'unconfirmed';
  };
}

export interface NetflixManualTest {
  key: 'public' | 'us' | 'jp' | 'sg';
  label: string;
  title: string;
  title_id: string;
  target_region: 'GLOBAL' | 'US' | 'JP' | 'SG';
  checked_at: string;
  href: string;
}

export const STREAMING_POLICY_CHECKED_AT = '2026-07-10';

export const STREAMING_SERVICES: readonly StreamingServiceDefinition[] = [
  { key: 'chatgpt', label: 'ChatGPT', short_label: 'AI', probe_url: 'https://chatgpt.com/' },
  { key: 'netflix', label: 'Netflix', short_label: 'NF', probe_url: 'https://www.netflix.com/' },
  { key: 'claude', label: 'Claude', short_label: 'CL', probe_url: 'https://claude.ai/' },
  { key: 'tiktok', label: 'TikTok', short_label: 'TT', probe_url: 'https://www.tiktok.com/' },
  { key: 'disney_plus', label: 'Disney+', short_label: 'D+', probe_url: 'https://www.disneyplus.com/' },
  { key: 'hbo_max', label: 'HBO Max', short_label: 'MAX', probe_url: 'https://www.hbomax.com/' },
] as const;

export const NETFLIX_MANUAL_TESTS: readonly NetflixManualTest[] = [
  buildNetflixManualTest('public', '公共片源', 'Netflix 全球片源参考', '80018499', 'GLOBAL'),
  buildNetflixManualTest('us', '美国片源', '绝命毒师', '70143836', 'US'),
  buildNetflixManualTest('jp', '日本片源', '夫よ、死んでくれないか', '82653483', 'JP'),
  buildNetflixManualTest('sg', '新加坡片源', 'Emerald Hill', '82005805', 'SG'),
] as const;

const CHATGPT_SUPPORTED_COUNTRIES = new Set([
  'AL', 'DZ', 'AD', 'AO', 'AR', 'AM', 'AU', 'AT', 'AZ', 'BH', 'BD', 'BE', 'BZ', 'BJ', 'BT', 'BO', 'BA',
  'BW', 'BR', 'BN', 'BG', 'KH', 'CM', 'CA', 'CL', 'CO', 'CR', 'HR', 'CY', 'CZ', 'DK', 'DO', 'EC', 'EG',
  'SV', 'EE', 'FI', 'FR', 'GE', 'DE', 'GH', 'GR', 'GT', 'HN', 'HU', 'IS', 'IN', 'ID', 'IQ', 'IE', 'IL',
  'IT', 'JM', 'JP', 'JO', 'KZ', 'KE', 'KW', 'KG', 'LA', 'LV', 'LB', 'LI', 'LT', 'LU', 'MY', 'MV', 'MT',
  'MU', 'MX', 'MD', 'MC', 'MN', 'ME', 'MA', 'MM', 'NP', 'NL', 'NZ', 'NI', 'NG', 'MK', 'NO', 'OM', 'PK',
  'PA', 'PY', 'PE', 'PH', 'PL', 'PT', 'QA', 'RO', 'RW', 'SA', 'RS', 'SG', 'SK', 'SI', 'ZA', 'KR', 'ES',
  'LK', 'SE', 'CH', 'TW', 'TH', 'TN', 'TR', 'UG', 'UA', 'AE', 'GB', 'US', 'UY', 'UZ', 'VN', 'ZM', 'ZW',
]);

const CLAUDE_SUPPORTED_COUNTRIES = new Set([
  'AL', 'DZ', 'AD', 'AO', 'AR', 'AM', 'AU', 'AT', 'AZ', 'BH', 'BD', 'BE', 'BZ', 'BJ', 'BT', 'BO', 'BA',
  'BW', 'BR', 'BN', 'BG', 'KH', 'CM', 'CA', 'CL', 'CO', 'CR', 'HR', 'CY', 'CZ', 'DK', 'DO', 'EC', 'EG',
  'SV', 'EE', 'FI', 'FR', 'GE', 'DE', 'GH', 'GR', 'GT', 'HN', 'HU', 'IS', 'IN', 'ID', 'IQ', 'IE', 'IL',
  'IT', 'JM', 'JP', 'JO', 'KZ', 'KE', 'KW', 'KG', 'LA', 'LV', 'LB', 'LI', 'LT', 'LU', 'MY', 'MV', 'MT',
  'MU', 'MX', 'MD', 'MC', 'MN', 'ME', 'MA', 'NP', 'NL', 'NZ', 'NG', 'MK', 'NO', 'OM', 'PK', 'PA', 'PY',
  'PE', 'PH', 'PL', 'PT', 'QA', 'RO', 'RW', 'SA', 'RS', 'SG', 'SK', 'SI', 'ZA', 'KR', 'ES', 'LK', 'SE',
  'CH', 'TW', 'TH', 'TN', 'TR', 'UG', 'UA', 'AE', 'GB', 'US', 'UY', 'UZ', 'VN', 'ZM', 'ZW',
]);

const DISNEY_PLUS_SUPPORTED_COUNTRIES = new Set([
  'US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'CR', 'EC', 'PA', 'PE', 'UY',
  'GB', 'IE', 'FR', 'DE', 'ES', 'PT', 'IT', 'NL', 'BE', 'LU', 'AT', 'CH', 'DK', 'FI', 'IS', 'NO', 'SE',
  'PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'HR', 'SI', 'GR', 'EE', 'LV', 'LT', 'TR',
  'AU', 'NZ', 'JP', 'KR', 'SG', 'HK', 'TW', 'ID', 'MY', 'PH', 'TH', 'IN', 'ZA',
]);

const HBO_MAX_SUPPORTED_COUNTRIES = new Set([
  'US', 'AS', 'GU', 'MP', 'PR', 'VI', 'AU', 'HK', 'ID', 'MY', 'PH', 'SG', 'TW', 'TH',
  'AD', 'BE', 'BA', 'BG', 'HR', 'CZ', 'DK', 'FI', 'FR', 'HU', 'MD', 'ME', 'NL', 'MK', 'NO', 'PL', 'PT',
  'RO', 'RS', 'SK', 'SI', 'ES', 'SE', 'TR', 'AR', 'BZ', 'BO', 'BR', 'CL', 'CO', 'CR', 'EC', 'SV', 'GT',
  'GY', 'HN', 'MX', 'NI', 'PA', 'PY', 'PE', 'SR', 'UY', 'VE', 'AG', 'AW', 'BS', 'BB', 'CW', 'DM', 'DO',
  'GD', 'HT', 'JM', 'KN', 'LC', 'VC', 'TT',
]);

const NETFLIX_UNSUPPORTED_COUNTRIES = new Set(['CN', 'KP', 'RU', 'SY']);

export function buildStreamingRegionAssessments(countryCode: string): StreamingRegionAssessment[] {
  const country = normalizeCountryCode(countryCode);
  return STREAMING_SERVICES.map((service) => {
    if (service.key === 'tiktok') {
      return {
        key: service.key,
        label: service.label,
        region_support: 'unknown',
        basis: 'connectivity_only',
        note: 'TikTok 缺少稳定的官方完整地区清单，本项以浏览器连通结果为主。',
      };
    }
    if (!country) {
      return buildAssessment(service, 'unknown', '未识别到可靠的出口国家或地区。');
    }
    if (service.key === 'netflix') {
      return NETFLIX_UNSUPPORTED_COUNTRIES.has(country)
        ? buildAssessment(service, 'unsupported', 'Netflix 官方未在当前国家或地区提供服务。')
        : buildAssessment(service, 'supported', 'Netflix 官方覆盖当前国家或地区，但片库范围仍需手动验证。');
    }

    const supportedCountries = service.key === 'chatgpt'
      ? CHATGPT_SUPPORTED_COUNTRIES
      : service.key === 'claude'
        ? CLAUDE_SUPPORTED_COUNTRIES
        : service.key === 'disney_plus'
          ? DISNEY_PLUS_SUPPORTED_COUNTRIES
          : HBO_MAX_SUPPORTED_COUNTRIES;

    return supportedCountries.has(country)
      ? buildAssessment(service, 'supported', `${service.label} 官方覆盖信息包含当前国家或地区。`)
      : buildAssessment(service, 'unknown', `${service.label} 当前地区无法仅凭现有官方覆盖表确认。`);
  });
}

export function inferNetflixRegion(countryCode: string): NetflixInferredRegion {
  const country = normalizeCountryCode(countryCode);
  if (!country) return 'unknown';
  if (country === 'US') return 'us';
  if (country === 'JP') return 'jp';
  if (country === 'SG') return 'sg';
  return 'other';
}

export function mergeStreamingEvidence(
  reachability: StreamingReachability,
  regionSupport: StreamingRegionSupport,
  hasKnownCountry: boolean,
): StreamingMergedState {
  if (reachability === 'pending') return 'pending';
  if (reachability === 'unreachable' || reachability === 'timeout') return 'unconfirmed';
  if (!hasKnownCountry || regionSupport === 'unknown') return 'reachable_only';
  if (regionSupport === 'supported') return 'likely_supported';
  return 'reachable_region_unsupported';
}

export function normalizeCountryCode(value: unknown): string {
  const code = String(value || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) && code !== 'XX' && code !== 'T1' && code !== 'ZZ' ? code : '';
}

function buildAssessment(
  service: StreamingServiceDefinition,
  regionSupport: StreamingRegionSupport,
  note: string,
): StreamingRegionAssessment {
  return {
    key: service.key,
    label: service.label,
    region_support: regionSupport,
    basis: 'official_country_policy',
    note,
  };
}

function buildNetflixManualTest(
  key: NetflixManualTest['key'],
  label: string,
  title: string,
  titleId: string,
  targetRegion: NetflixManualTest['target_region'],
): NetflixManualTest {
  return {
    key,
    label,
    title,
    title_id: titleId,
    target_region: targetRegion,
    checked_at: STREAMING_POLICY_CHECKED_AT,
    href: `https://www.netflix.com/title/${titleId}`,
  };
}
