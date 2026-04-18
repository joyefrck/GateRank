import { useEffect, type RefObject } from 'react';

export type MarketingPageKind =
  | 'home'
  | 'full_ranking'
  | 'risk_monitor'
  | 'report'
  | 'methodology'
  | 'news'
  | 'apply'
  | 'publish_token_docs';

export type MarketingPlacement = 'home_card' | 'full_ranking_item' | 'risk_monitor_item' | 'report_header';
export type MarketingTargetKind = 'website' | 'subscription_url';

interface MarketingEventPayload {
  event_type: 'page_view' | 'airport_impression' | 'outbound_click';
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
  occurred_at?: string;
}

interface MarketingAttributionContext {
  external_referrer_host: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
}

interface MarketingImpressionOptions {
  enabled?: boolean;
  airportId: number;
  placement: MarketingPlacement;
  pageKind: MarketingPageKind;
  pagePath?: string;
  dedupeKey?: string;
  threshold?: number;
  ref: RefObject<HTMLElement | null>;
}

const MARKETING_ENDPOINT = '/api/v1/marketing/events';
const SESSION_STORAGE_KEY = 'gaterank_marketing_session_id';
const ATTRIBUTION_STORAGE_KEY = 'gaterank_marketing_attribution';
const FLUSH_DELAY_MS = 1200;

const queue: MarketingEventPayload[] = [];
const trackedImpressions = new Set<string>();
let flushTimer: number | null = null;
let lastTrackedRouteKey = '';
let lastTrackedPagePath = getInitialReferrerPath();
let attributionContext = getInitialAttributionContext();

export function trackMarketingPageView(pageKind: MarketingPageKind, pagePath = window.location.pathname): void {
  const normalizedPath = normalizePath(pagePath);
  const routeKey = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (lastTrackedRouteKey === routeKey) {
    return;
  }

  lastTrackedRouteKey = routeKey;
  enqueueEvent({
    event_type: 'page_view',
    page_kind: pageKind,
    page_path: normalizedPath,
    referrer_path: lastTrackedPagePath,
  });
  lastTrackedPagePath = normalizedPath;
}

export function useMarketingImpression(options: MarketingImpressionOptions): void {
  const {
    enabled = true,
    airportId,
    placement,
    pageKind,
    pagePath = window.location.pathname,
    dedupeKey,
    threshold = 0.45,
    ref,
  } = options;

  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element) {
      return;
    }

    const impressionKey = dedupeKey || `${pageKind}|${placement}|${airportId}|${normalizePath(pagePath)}`;
    if (trackedImpressions.has(impressionKey)) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      const matched = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= threshold);
      if (!matched) {
        return;
      }

      trackedImpressions.add(impressionKey);
      enqueueEvent({
        event_type: 'airport_impression',
        page_kind: pageKind,
        page_path: normalizePath(pagePath),
        airport_id: airportId,
        placement,
      });
      observer.disconnect();
    }, { threshold: [threshold] });

    observer.observe(element);
    return () => observer.disconnect();
  }, [airportId, dedupeKey, enabled, pageKind, pagePath, placement, ref, threshold]);
}

export function createTrackedOutboundClickHandler(input: {
  airportId: number;
  pageKind: MarketingPageKind;
  placement: MarketingPlacement;
  targetKind: MarketingTargetKind;
  targetUrl: string;
  pagePath?: string;
}): () => void {
  return () => {
    enqueueEvent({
      event_type: 'outbound_click',
      page_kind: input.pageKind,
      page_path: normalizePath(input.pagePath || window.location.pathname),
      airport_id: input.airportId,
      placement: input.placement,
      target_kind: input.targetKind,
      target_url: input.targetUrl,
    });
    flushMarketingEvents();
  };
}

export function flushMarketingEvents(): void {
  if (flushTimer !== null) {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (queue.length === 0) {
    return;
  }

  const payload = JSON.stringify({ events: queue.splice(0, queue.length) });
  const blob = new Blob([payload], { type: 'application/json' });

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const accepted = navigator.sendBeacon(MARKETING_ENDPOINT, blob);
    if (accepted) {
      return;
    }
  }

  void fetch(MARKETING_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}

function enqueueEvent(payload: MarketingEventPayload): void {
  attributionContext = resolveAttributionContext();
  queue.push({
    ...payload,
    page_path: normalizePath(payload.page_path),
    referrer_path: payload.referrer_path ? normalizePath(payload.referrer_path) : null,
    external_referrer_host: attributionContext.external_referrer_host,
    target_url: payload.target_url?.trim() || null,
    utm_source: attributionContext.utm_source,
    utm_medium: attributionContext.utm_medium,
    utm_campaign: attributionContext.utm_campaign,
    utm_content: attributionContext.utm_content,
    utm_term: attributionContext.utm_term,
    client_session_id: getClientSessionId(),
    occurred_at: new Date().toISOString(),
  });

  if (queue.length >= 10) {
    flushMarketingEvents();
    return;
  }

  if (flushTimer !== null) {
    return;
  }

  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    flushMarketingEvents();
  }, FLUSH_DELAY_MS);
}

function getClientSessionId(): string {
  try {
    const current = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (current) {
      return current;
    }
    const next = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, next);
    return next;
  } catch {
    return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function normalizePath(value: string): string {
  const text = String(value || '').trim();
  if (!text) {
    return '/';
  }
  return text.startsWith('/') ? text : `/${text}`;
}

function getInitialReferrerPath(): string | null {
  const referrer = document.referrer;
  if (!referrer) {
    return null;
  }
  try {
    const url = new URL(referrer);
    if (url.origin !== window.location.origin) {
      return null;
    }
    return normalizePath(url.pathname);
  } catch {
    return null;
  }
}

function getInitialAttributionContext(): MarketingAttributionContext {
  const resolved = resolveAttributionContext();
  persistAttributionContext(resolved);
  return resolved;
}

function resolveAttributionContext(): MarketingAttributionContext {
  const fresh = readAttributionFromLocation();
  if (hasAttribution(fresh)) {
    persistAttributionContext(fresh);
    return fresh;
  }
  return readStoredAttributionContext();
}

function readAttributionFromLocation(): MarketingAttributionContext {
  const params = new URLSearchParams(window.location.search);
  return {
    external_referrer_host: getExternalReferrerHost(document.referrer),
    utm_source: normalizeOptionalText(params.get('utm_source')),
    utm_medium: normalizeOptionalText(params.get('utm_medium')),
    utm_campaign: normalizeOptionalText(params.get('utm_campaign')),
    utm_content: normalizeOptionalText(params.get('utm_content')),
    utm_term: normalizeOptionalText(params.get('utm_term')),
  };
}

function getExternalReferrerHost(referrer: string): string | null {
  if (!referrer) {
    return null;
  }
  try {
    const url = new URL(referrer);
    if (url.origin === window.location.origin) {
      return null;
    }
    return normalizeHost(url.host);
  } catch {
    return null;
  }
}

function readStoredAttributionContext(): MarketingAttributionContext {
  try {
    const raw = window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) {
      return emptyAttributionContext();
    }
    const parsed = JSON.parse(raw) as Partial<MarketingAttributionContext>;
    return {
      external_referrer_host: normalizeHost(parsed.external_referrer_host),
      utm_source: normalizeOptionalText(parsed.utm_source),
      utm_medium: normalizeOptionalText(parsed.utm_medium),
      utm_campaign: normalizeOptionalText(parsed.utm_campaign),
      utm_content: normalizeOptionalText(parsed.utm_content),
      utm_term: normalizeOptionalText(parsed.utm_term),
    };
  } catch {
    return emptyAttributionContext();
  }
}

function persistAttributionContext(context: MarketingAttributionContext): void {
  try {
    window.sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(context));
  } catch {
    // Ignore storage failures and continue with in-memory attribution.
  }
}

function hasAttribution(context: MarketingAttributionContext): boolean {
  return Boolean(
    context.external_referrer_host
    || context.utm_source
    || context.utm_medium
    || context.utm_campaign
    || context.utm_content
    || context.utm_term,
  );
}

function emptyAttributionContext(): MarketingAttributionContext {
  return {
    external_referrer_host: null,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
  };
}

function normalizeOptionalText(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const text = String(value).trim();
  return text ? text.slice(0, 255) : null;
}

function normalizeHost(value: unknown): string | null {
  const text = normalizeOptionalText(value);
  if (!text) {
    return null;
  }
  return text.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
}
