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
  airport_id?: number | null;
  placement?: MarketingPlacement | null;
  target_kind?: MarketingTargetKind | null;
  target_url?: string | null;
  client_session_id?: string | null;
  occurred_at?: string;
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
const FLUSH_DELAY_MS = 1200;

const queue: MarketingEventPayload[] = [];
const trackedImpressions = new Set<string>();
let flushTimer: number | null = null;
let lastTrackedRouteKey = '';
let lastTrackedPagePath = getInitialReferrerPath();

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
  queue.push({
    ...payload,
    page_path: normalizePath(payload.page_path),
    referrer_path: payload.referrer_path ? normalizePath(payload.referrer_path) : null,
    target_url: payload.target_url?.trim() || null,
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
