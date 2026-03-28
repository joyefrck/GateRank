const DEFAULT_GA_MEASUREMENT_ID = 'G-4V9Z53GSP2';
const ADMIN_PATH_PREFIX = '/admin';

function getMeasurementId(): string {
  const measurementId = window.__GATERANK_GA_MEASUREMENT_ID__?.trim();
  return measurementId || DEFAULT_GA_MEASUREMENT_ID;
}

export function isAnalyticsEnabled(pathname: string = window.location.pathname): boolean {
  return !pathname.startsWith(ADMIN_PATH_PREFIX) && Boolean(getMeasurementId());
}

export function initializeAnalytics(): void {
  if (!isAnalyticsEnabled() || window.__GATERANK_GA_INITIALIZED__) {
    return;
  }

  if (typeof window.gtag !== 'function') {
    return;
  }

  const measurementId = getMeasurementId();
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
