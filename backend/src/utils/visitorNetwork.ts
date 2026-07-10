import geoip from 'geoip-country';
import type { Request } from 'express';
import { normalizeCountryCode } from '../../../shared/streamingCheck';

const UNKNOWN_COUNTRY_CODE = 'ZZ';
const UNKNOWN_COUNTRY_NAME = '未知地区';
const REGION_DISPLAY_NAMES = new Intl.DisplayNames(['zh-CN'], { type: 'region' });

export interface VisitorNetwork {
  ip: string;
  country_code: string;
  country_name: string;
}

export function resolveVisitorNetwork(req: Request): VisitorNetwork {
  const ip = resolveVisitorIp(req);
  const headerCountry = resolveHeaderCountry(req);
  if (headerCountry) {
    return {
      ip,
      country_code: headerCountry,
      country_name: countryNameFromCode(headerCountry),
    };
  }

  const match = ip ? geoip.lookup(ip) : null;
  const lookupCountry = normalizeCountryCode(match?.country);
  if (lookupCountry) {
    return {
      ip,
      country_code: lookupCountry,
      country_name: match?.name || countryNameFromCode(lookupCountry),
    };
  }

  return {
    ip: ip || 'unknown',
    country_code: UNKNOWN_COUNTRY_CODE,
    country_name: UNKNOWN_COUNTRY_NAME,
  };
}

export function resolveVisitorIp(req: Request): string {
  const candidates = [
    req.header('cf-connecting-ip'),
    firstForwardedIp(req.header('x-forwarded-for')),
    req.header('x-real-ip'),
    req.ip,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeIp(candidate);
    if (normalized) return normalized;
  }
  return 'unknown';
}

function resolveHeaderCountry(req: Request): string {
  for (const candidate of [
    req.header('cf-ipcountry'),
    req.header('cloudfront-viewer-country'),
    req.header('x-vercel-ip-country'),
    req.header('x-country-code'),
  ]) {
    const normalized = normalizeCountryCode(candidate);
    if (normalized) return normalized;
  }
  return '';
}

function firstForwardedIp(value: string | undefined): string {
  return String(value || '').split(',')[0]?.trim() || '';
}

function normalizeIp(value: unknown): string {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.startsWith('::ffff:')) return text.slice('::ffff:'.length);
  return text.replace(/^\[|\]$/g, '');
}

function countryNameFromCode(countryCode: string): string {
  return REGION_DISPLAY_NAMES.of(countryCode) || UNKNOWN_COUNTRY_NAME;
}
