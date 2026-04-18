import { createHash } from 'node:crypto';
import type { Request } from 'express';
import type {
  MarketingEventType,
  MarketingPageKind,
  MarketingPlacement,
  MarketingTargetKind,
} from '../types/domain';
import { formatDateTimeInTimezoneIso, formatSqlDateTimeInTimezone, getDateInTimezone } from './time';

const DEFAULT_MARKETING_HASH_SALT = 'gaterank-marketing-v1';

export interface MarketingEventInsertRecord {
  occurred_at: string;
  event_date: string;
  event_type: MarketingEventType;
  page_path: string;
  page_kind: MarketingPageKind;
  referrer_path: string | null;
  airport_id: number | null;
  placement: MarketingPlacement | null;
  target_kind: MarketingTargetKind | null;
  target_url: string | null;
  visitor_hash: string;
  session_hash: string;
}

export interface MarketingEventPayload {
  occurred_at?: string;
  event_type: MarketingEventType;
  page_path: string;
  page_kind: MarketingPageKind;
  referrer_path?: string | null;
  airport_id?: number | null;
  placement?: MarketingPlacement | null;
  target_kind?: MarketingTargetKind | null;
  target_url?: string | null;
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

  return {
    occurred_at: formatSqlDateTimeInTimezone(occurredAt),
    event_date: getDateInTimezone('Asia/Shanghai', occurredAt),
    event_type: payload.event_type,
    page_path: normalizeMarketingPath(payload.page_path),
    page_kind: payload.page_kind,
    referrer_path: payload.referrer_path ? normalizeMarketingPath(payload.referrer_path) : null,
    airport_id: payload.airport_id ?? null,
    placement: payload.placement ?? null,
    target_kind: payload.target_kind ?? null,
    target_url: payload.target_url?.trim() || null,
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

  return {
    occurred_at: formatSqlDateTimeInTimezone(occurredAt),
    event_date: getDateInTimezone('Asia/Shanghai', occurredAt),
    event_type: 'page_view',
    page_path: normalizeMarketingPath(input.page_path),
    page_kind: input.page_kind,
    referrer_path: getInternalReferrerPath(req),
    airport_id: null,
    placement: null,
    target_kind: null,
    target_url: null,
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

function getClientIp(req: Request): string {
  const forwarded = String(req.header('x-forwarded-for') || '').trim();
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) {
      return first;
    }
  }
  const realIp = String(req.header('x-real-ip') || '').trim();
  if (realIp) {
    return realIp;
  }
  return String(req.ip || '').trim();
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

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
