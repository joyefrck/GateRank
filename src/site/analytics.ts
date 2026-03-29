const DEFAULT_GA_MEASUREMENT_ID = 'G-4V9Z53GSP2';
const ADMIN_PATH_PREFIX = '/admin';
const GA_SCRIPT_SELECTOR = 'script[data-gaterank-ga="true"]';

function getMeasurementId(): string {
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
  return measurementId || DEFAULT_GA_MEASUREMENT_ID;
}

export function isAnalyticsEnabled(pathname: string = window.location.pathname): boolean {
  return !pathname.startsWith(ADMIN_PATH_PREFIX) && Boolean(getMeasurementId());
}

function ensureAnalyticsRuntime(measurementId: string): void {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(...args) {
    window.dataLayer.push(args);
  };

  if (document.querySelector(GA_SCRIPT_SELECTOR)) {
    return;
  }

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  script.setAttribute('data-gaterank-ga', 'true');
  document.head.appendChild(script);
}

export function initializeAnalytics(): void {
  if (!isAnalyticsEnabled() || window.__GATERANK_GA_INITIALIZED__) {
    return;
  }

  const measurementId = getMeasurementId();
  ensureAnalyticsRuntime(measurementId);

  if (typeof window.gtag !== 'function') {
    return;
  }

  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    send_page_view: false,
  });
  window.__GATERANK_GA_INITIALIZED__ = true;
}

let lastTrackedPageView = '';

export function trackPageView(): void {
  if (!isAnalyticsEnabled() || !window.__GATERANK_GA_INITIALIZED__) {
    return;
  }

  if (typeof window.gtag !== 'function') {
    return;
  }

  const measurementId = getMeasurementId();
  const pagePath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const pageLocation = window.location.href;
  const pageTitle = document.title;
  const dedupeKey = `${pagePath}|${pageTitle}`;

  if (lastTrackedPageView === dedupeKey) {
    return;
  }

  lastTrackedPageView = dedupeKey;
  window.gtag('event', 'page_view', {
    send_to: measurementId,
    page_title: pageTitle,
    page_location: pageLocation,
    page_path: pagePath,
  });
}
