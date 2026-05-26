const DEFAULT_GA_MEASUREMENT_ID = 'G-4V9Z53GSP2';
const ADMIN_PATH_PREFIX = '/admin';
const GA_SCRIPT_SELECTOR = 'script[data-gaterank-ga="true"]';

function getMeasurementId(): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const measurementId = env?.VITE_GA_MEASUREMENT_ID?.trim();
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
  window.gtag('config', measurementId);
  lastTrackedPagePath = getCurrentPagePath();
  window.__GATERANK_GA_INITIALIZED__ = true;
}

let lastTrackedPagePath = '';

function getCurrentPagePath(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function trackPageView(): void {
  if (!isAnalyticsEnabled() || !window.__GATERANK_GA_INITIALIZED__) {
    return;
  }

  if (typeof window.gtag !== 'function') {
    return;
  }

  const measurementId = getMeasurementId();
  const pagePath = getCurrentPagePath();
  const pageLocation = window.location.href;
  const pageTitle = document.title;

  if (lastTrackedPagePath === pagePath) {
    return;
  }

  lastTrackedPagePath = pagePath;
  window.gtag('event', 'page_view', {
    send_to: measurementId,
    page_title: pageTitle,
    page_location: pageLocation,
    page_path: pagePath,
  });
}
