import { createHash } from 'node:crypto';
import geoip from 'geoip-country';
import type { Request } from 'express';
import type {
  MarketingEventType,
  MarketingPageKind,
  MarketingPlacement,
  MarketingSourceType,
  MarketingTargetKind,
} from '../types/domain';
import { formatDateTimeInTimezoneIso, formatSqlDateTimeInTimezone, getDateInTimezone } from './time';

const DEFAULT_MARKETING_HASH_SALT = 'gaterank-marketing-v1';
const UNKNOWN_COUNTRY_CODE = 'ZZ';
const UNKNOWN_COUNTRY_NAME = 'Unknown';
const DIRECT_SOURCE_LABEL = 'Direct / Unknown';
const REGION_DISPLAY_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });

export interface MarketingEventInsertRecord {
  occurred_at: string;
  event_date: string;
  event_type: MarketingEventType;
  page_path: string;
  page_kind: MarketingPageKind;
  referrer_path: string | null;
  external_referrer_host: string | null;
  source_type: MarketingSourceType;
  source_label: string;
  airport_id: number | null;
  placement: MarketingPlacement | null;
  target_kind: MarketingTargetKind | null;
  target_url: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  country_code: string;
  country_name: string;
  visitor_hash: string;
  session_hash: string;
}

export interface MarketingEventPayload {
  occurred_at?: string;
  event_type: MarketingEventType;
  page_path: string;
  page_kind: MarketingPageKind;
  referrer_path?: string | null;
  external_referrer_host?: string | null;
  airport_id?: number | null;
  placement?: MarketingPlacement | null;
  target_kind?: MarketingTargetKind | null;
  target_url?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  client_session_id?: string | null;
}

export function getMarketingHashSalt(): string {
  return process.env.MARKETING_HASH_SALT?.trim() || DEFAULT_MARKETING_HASH_SALT;
}

export function normalizeMarketingPath(value: unknown): string {
  const text = String(value || '').trim();
  if (!text) {
    return '/';
  }
  if (text.startsWith('http://') || text.startsWith('https://')) {
    try {
      const url = new URL(text);
      return url.pathname || '/';
    } catch {
      return '/';
    }
  }
  return text.startsWith('/') ? text : `/${text}`;
}

export function parseMarketingOccurredAt(input?: string | null): Date {
  if (!input) {
    return new Date();
  }
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`invalid occurred_at: ${input}`);
  }
  return parsed;
}

export function buildMarketingIdentity(req: Request, clientSessionId?: string | null): {
  visitor_hash: string;
  session_hash: string;
} {
  const salt = getMarketingHashSalt();
  const ip = getClientIp(req);
  const userAgent = String(req.header('user-agent') || '').trim().slice(0, 512);
  const visitorBasis = `${ip}|${userAgent}`;
  const sessionBasis = `${visitorBasis}|${String(clientSessionId || req.requestId || '').trim()}`;

  return {
    visitor_hash: sha256(`${salt}|visitor|${visitorBasis}`),
    session_hash: sha256(`${salt}|session|${sessionBasis}`),
  };
}

export function buildMarketingEventRecord(
  req: Request,
  payload: MarketingEventPayload,
): MarketingEventInsertRecord {
  const occurredAt = parseMarketingOccurredAt(payload.occurred_at || null);
  const identity = buildMarketingIdentity(req, payload.client_session_id || null);
  const attribution = resolveMarketingAttribution(req, payload);
  const country = resolveMarketingCountry(req);

  return {
    occurred_at: formatSqlDateTimeInTimezone(occurredAt),
    event_date: getDateInTimezone('Asia/Shanghai', occurredAt),
    event_type: payload.event_type,
    page_path: normalizeMarketingPath(payload.page_path),
    page_kind: payload.page_kind,
    referrer_path: payload.referrer_path ? normalizeMarketingPath(payload.referrer_path) : null,
    external_referrer_host: attribution.external_referrer_host,
    source_type: attribution.source_type,
    source_label: attribution.source_label,
    airport_id: payload.airport_id ?? null,
    placement: payload.placement ?? null,
    target_kind: payload.target_kind ?? null,
    target_url: payload.target_url?.trim() || null,
    utm_source: attribution.utm_source,
    utm_medium: attribution.utm_medium,
    utm_campaign: attribution.utm_campaign,
    utm_content: attribution.utm_content,
    utm_term: attribution.utm_term,
    country_code: country.country_code,
    country_name: country.country_name,
    visitor_hash: identity.visitor_hash,
    session_hash: identity.session_hash,
  };
}

export function buildServerPageViewRecord(
  req: Request,
  input: {
    page_kind: MarketingPageKind;
    page_path: string;
    occurred_at?: Date;
  },
): MarketingEventInsertRecord {
  const occurredAt = input.occurred_at || new Date();
  const identity = buildMarketingIdentity(req, null);
  const attribution = resolveMarketingAttribution(req, {});
  const country = resolveMarketingCountry(req);

  return {
    occurred_at: formatSqlDateTimeInTimezone(occurredAt),
    event_date: getDateInTimezone('Asia/Shanghai', occurredAt),
    event_type: 'page_view',
    page_path: normalizeMarketingPath(input.page_path),
    page_kind: input.page_kind,
    referrer_path: getInternalReferrerPath(req),
    external_referrer_host: attribution.external_referrer_host,
    source_type: attribution.source_type,
    source_label: attribution.source_label,
    airport_id: null,
    placement: null,
    target_kind: null,
    target_url: null,
    utm_source: attribution.utm_source,
    utm_medium: attribution.utm_medium,
    utm_campaign: attribution.utm_campaign,
    utm_content: attribution.utm_content,
    utm_term: attribution.utm_term,
    country_code: country.country_code,
    country_name: country.country_name,
    visitor_hash: identity.visitor_hash,
    session_hash: identity.session_hash,
  };
}

export function toIsoOrNull(value: unknown): string | null {
  if (!value) {
    return null;
  }
  return formatDateTimeInTimezoneIso(value instanceof Date ? value : new Date(String(value)));
}

export function resolveMarketingAttribution(
  req: Request,
  payload: Pick<
    MarketingEventPayload,
    'external_referrer_host' | 'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_content' | 'utm_term'
  >,
): {
  external_referrer_host: string | null;
  source_type: MarketingSourceType;
  source_label: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
} {
  const utmSource = normalizeMarketingText(payload.utm_source ?? getQueryValue(req, 'utm_source'));
  const utmMedium = normalizeMarketingText(payload.utm_medium ?? getQueryValue(req, 'utm_medium'));
  const utmCampaign = normalizeMarketingText(payload.utm_campaign ?? getQueryValue(req, 'utm_campaign'));
  const utmContent = normalizeMarketingText(payload.utm_content ?? getQueryValue(req, 'utm_content'));
  const utmTerm = normalizeMarketingText(payload.utm_term ?? getQueryValue(req, 'utm_term'));
  const externalReferrerHost = normalizeMarketingHost(payload.external_referrer_host)
    || getExternalReferrerHost(req);
  const source = resolveMarketingSource({
    utmSource,
    externalReferrerHost,
  });

  return {
    external_referrer_host: externalReferrerHost,
    source_type: source.source_type,
    source_label: source.source_label,
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
    utm_content: utmContent,
    utm_term: utmTerm,
  };
}

export function resolveMarketingSource(input: {
  utmSource?: string | null;
  externalReferrerHost?: string | null;
}): {
  source_type: MarketingSourceType;
  source_label: string;
} {
  const normalizedUtmSource = normalizeSourceToken(input.utmSource);
  if (normalizedUtmSource) {
    const classified = classifyKnownMarketingSource(normalizedUtmSource);
    if (classified) {
      return classified;
    }
    return {
      source_type: 'other_referral',
      source_label: input.utmSource?.trim() || normalizedUtmSource,
    };
  }

  const host = normalizeMarketingHost(input.externalReferrerHost);
  if (host) {
    const classified = classifyKnownMarketingSource(host);
    if (classified) {
      return classified;
    }
    return {
      source_type: 'other_referral',
      source_label: host,
    };
  }

  return {
    source_type: 'direct_or_unknown',
    source_label: DIRECT_SOURCE_LABEL,
  };
}

export function resolveMarketingCountry(req: Request): {
  country_code: string;
  country_name: string;
} {
  const headerCountryCode = getHeaderCountryCode(req);
  if (headerCountryCode) {
    return {
      country_code: headerCountryCode,
      country_name: countryNameFromCode(headerCountryCode),
    };
  }

  const ip = getClientIp(req);
  if (ip) {
    const match = geoip.lookup(ip);
    if (match?.country) {
      const countryCode = normalizeCountryCode(match.country);
      if (countryCode) {
        return {
          country_code: countryCode,
          country_name: match.name || countryNameFromCode(countryCode),
        };
      }
    }
  }

  return {
    country_code: UNKNOWN_COUNTRY_CODE,
    country_name: UNKNOWN_COUNTRY_NAME,
  };
}

function getClientIp(req: Request): string {
  const forwarded = String(req.header('x-forwarded-for') || '').trim();
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) {
      return normalizeIp(first);
    }
  }
  const realIp = String(req.header('x-real-ip') || '').trim();
  if (realIp) {
    return normalizeIp(realIp);
  }
  return normalizeIp(String(req.ip || '').trim());
}

function getInternalReferrerPath(req: Request): string | null {
  const referrer = String(req.header('referer') || req.header('referrer') || '').trim();
  if (!referrer) {
    return null;
  }
  try {
    const referrerUrl = new URL(referrer);
    const host = req.header('x-forwarded-host') || req.header('host');
    if (host && referrerUrl.host !== host) {
      return null;
    }
    return normalizeMarketingPath(referrerUrl.pathname);
  } catch {
    return null;
  }
}

function getExternalReferrerHost(req: Request): string | null {
  const referrer = String(req.header('referer') || req.header('referrer') || '').trim();
  if (!referrer) {
    return null;
  }
  try {
    const referrerUrl = new URL(referrer);
    const host = req.header('x-forwarded-host') || req.header('host');
    if (host && referrerUrl.host === host) {
      return null;
    }
    return normalizeMarketingHost(referrerUrl.host);
  } catch {
    return null;
  }
}

function getQueryValue(req: Request, key: string): string | null {
  const value = req.query?.[key];
  if (Array.isArray(value)) {
    return normalizeMarketingText(value[0]);
  }
  return normalizeMarketingText(value);
}

function normalizeMarketingText(value: unknown, maxLength = 255): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  return text.slice(0, maxLength);
}

function normalizeMarketingHost(value: unknown): string | null {
  const raw = normalizeMarketingText(value);
  if (!raw) {
    return null;
  }

  try {
    const maybeUrl = raw.includes('://') ? new URL(raw) : new URL(`https://${raw}`);
    return normalizeSourceToken(maybeUrl.host);
  } catch {
    return normalizeSourceToken(raw);
  }
}

function normalizeSourceToken(value: unknown): string | null {
  const text = normalizeMarketingText(value);
  if (!text) {
    return null;
  }
  return text
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/^m\./, '')
    .slice(0, 255);
}

function classifyKnownMarketingSource(value: string): {
  source_type: MarketingSourceType;
  source_label: string;
} | null {
  if (
    value === 'google'
    || value === 'google-search'
    || value.endsWith('.google.com')
    || value.includes('google.')
  ) {
    return { source_type: 'google', source_label: 'Google' };
  }
  if (value === 'baidu' || value.endsWith('.baidu.com') || value.includes('baidu.')) {
    return { source_type: 'baidu', source_label: 'Baidu' };
  }
  if (value === 'x' || value === 'x.com' || value === 'twitter' || value === 'twitter.com' || value === 't.co' || value.endsWith('.x.com')) {
    return { source_type: 'x', source_label: 'X' };
  }
  if (value === 'bing' || value.endsWith('.bing.com') || value.includes('bing.')) {
    return { source_type: 'bing', source_label: 'Bing' };
  }
  if (value === 'reddit' || value.endsWith('.reddit.com') || value.includes('reddit.')) {
    return { source_type: 'reddit', source_label: 'Reddit' };
  }
  if (value === 'telegram' || value.endsWith('.t.me') || value === 't.me' || value.includes('telegram')) {
    return { source_type: 'telegram', source_label: 'Telegram' };
  }
  if (value === 'wechat' || value.includes('weixin') || value.includes('wechat') || value.endsWith('.wechat.com')) {
    return { source_type: 'wechat', source_label: 'WeChat' };
  }
  return null;
}

function getHeaderCountryCode(req: Request): string | null {
  const candidates = [
    req.header('cf-ipcountry'),
    req.header('cloudfront-viewer-country'),
    req.header('x-vercel-ip-country'),
    req.header('x-country-code'),
  ];
  for (const candidate of candidates) {
    const normalized = normalizeCountryCode(candidate);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

function normalizeCountryCode(value: unknown): string | null {
  const text = String(value || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(text) || text === 'XX' || text === 'T1') {
    return null;
  }
  return text;
}

function countryNameFromCode(countryCode: string): string {
  return REGION_DISPLAY_NAMES.of(countryCode) || UNKNOWN_COUNTRY_NAME;
}

function normalizeIp(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.startsWith('::ffff:')) {
    return trimmed.slice('::ffff:'.length);
  }
  return trimmed.replace(/^\[|\]$/g, '');
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
