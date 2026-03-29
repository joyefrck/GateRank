export {};

declare global {
  interface Window {
    __GATERANK_GA_INITIALIZED__?: boolean;
    dataLayer: unknown[];
    gtag?: (
      command: 'js' | 'config' | 'event',
      target: string | Date,
      params?: Record<string, unknown>,
    ) => void;
  }
}
