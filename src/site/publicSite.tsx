import React, { useEffect, useRef } from 'react';
import { Zap } from 'lucide-react';

import { PUBLIC_SITE_BRAND_NAME } from '../../shared/publicBrand';
import { PUBLIC_NAVIGATION_ITEMS, type PublicNavigationKind } from '../../shared/publicNavigation';
import { PUBLIC_TOP_NAV_STYLES, renderPublicTopNav } from '../../shared/publicTopNav';
import { getPublicOgImageForPath, type PublicOgImage } from '../../shared/publicSeo';
import { buildFullRankingPath, EMPTY_FULL_RANKING_FILTERS, type FullRankingFilters } from '../../shared/fullRankingFilters';

export type NavigationKind = PublicNavigationKind | 'docs';

export interface SeoConfig {
  title: string;
  description: string;
  keywords: string;
  canonicalPath: string;
  robots?: string;
  ogImage?: {
    url: string;
    alt: string;
    type?: string;
    width?: number;
    height?: number;
  };
  structuredData?: Record<string, unknown> | Array<Record<string, unknown>>;
}

function getSiteUrl(): string {
  const fromEnv = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_SITE_URL;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }
  return 'http://localhost:3000';
}

export function buildAbsoluteUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getSiteUrl()}${normalizedPath}`;
}

export function normalizeExternalHref(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '#';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

export function resolvePageOgImageMeta(canonicalPath: string): PublicOgImage | undefined {
  return getPublicOgImageForPath(canonicalPath);
}

export function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

export function buildHomeHref(date?: string): string {
  return `/${buildQuery({ date })}`;
}

export function buildFullRankingHref(date?: string, page = 1, filters: FullRankingFilters = EMPTY_FULL_RANKING_FILTERS): string {
  return buildFullRankingPath(filters, {
    date,
    page: page > 1 ? page : undefined,
  });
}

export function buildMonthlyReportsHref(page = 1): string {
  return `/monthly-reports${buildQuery({ page: page > 1 ? page : undefined })}`;
}

export function buildRiskMonitorHref(date?: string, page = 1): string {
  return `/risk-monitor${buildQuery({
    date,
    page: page > 1 ? page : undefined,
  })}`;
}

export function buildDealsHref(): string {
  return '/deals';
}

export function buildMethodologyHref(): string {
  return '/methodology';
}

export function buildRankingTransparencyHref(): string {
  return '/ranking-transparency';
}

export function buildPublishTokenDocsHref(): string {
  return '/publish-token-docs';
}

export function buildNewsHref(): string {
  return '/news';
}

export function buildToolsHref(): string {
  return '/tools';
}

export function buildToolsDownloadHref(platform?: string): string {
  return `/tools/download${buildQuery({ platform })}`;
}

function ensureMetaTag(selector: string, create: () => HTMLMetaElement): HTMLMetaElement {
  let meta = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!meta) {
    meta = create();
    document.head.appendChild(meta);
  }
  return meta;
}

function ensureLinkTag(selector: string, create: () => HTMLLinkElement): HTMLLinkElement {
  let link = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (!link) {
    link = create();
    document.head.appendChild(link);
  }
  return link;
}

function setNamedMeta(name: string, content: string) {
  const meta = ensureMetaTag(`meta[name="${name}"]`, () => {
    const element = document.createElement('meta');
    element.setAttribute('name', name);
    return element;
  });
  meta.setAttribute('content', content);
}

function setPropertyMeta(property: string, content: string) {
  const meta = ensureMetaTag(`meta[property="${property}"]`, () => {
    const element = document.createElement('meta');
    element.setAttribute('property', property);
    return element;
  });
  meta.setAttribute('content', content);
}

export function usePageSeo(config: SeoConfig) {
  useEffect(() => {
    const canonicalUrl = buildAbsoluteUrl(config.canonicalPath);
    document.title = config.title;
    document.documentElement.lang = 'zh-CN';
    setNamedMeta('description', config.description);
    setNamedMeta('keywords', config.keywords);
    setNamedMeta('robots', config.robots || 'index,follow,max-image-preview:large');
    setPropertyMeta('og:type', 'website');
    setPropertyMeta('og:site_name', PUBLIC_SITE_BRAND_NAME);
    setPropertyMeta('og:title', config.title);
    setPropertyMeta('og:description', config.description);
    setPropertyMeta('og:url', canonicalUrl);
    setNamedMeta('twitter:card', 'summary_large_image');
    setNamedMeta('twitter:title', config.title);
    setNamedMeta('twitter:description', config.description);
    const staticOgImage = resolvePageOgImageMeta(config.canonicalPath);
    const ogImage = config.ogImage?.url
      ? {
        path: config.ogImage.url,
        alt: config.ogImage.alt,
        type: config.ogImage.type || inferImageMimeType(config.ogImage.url),
        width: config.ogImage.width,
        height: config.ogImage.height,
      }
      : staticOgImage;
    if (ogImage) {
      const imageUrl = toAbsoluteImageUrl(ogImage.path);
      setPropertyMeta('og:image', imageUrl);
      setPropertyMeta('og:image:secure_url', imageUrl);
      setPropertyMeta('og:image:type', ogImage.type);
      if (ogImage.width) setPropertyMeta('og:image:width', String(ogImage.width));
      if (ogImage.height) setPropertyMeta('og:image:height', String(ogImage.height));
      setPropertyMeta('og:image:alt', ogImage.alt);
      setNamedMeta('twitter:image', imageUrl);
      setNamedMeta('twitter:image:alt', ogImage.alt);
    }

    const canonical = ensureLinkTag('link[rel="canonical"]', () => {
      const element = document.createElement('link');
      element.setAttribute('rel', 'canonical');
      return element;
    });
    canonical.setAttribute('href', canonicalUrl);

    const scriptId = 'gaterank-jsonld';
    let script = (document.getElementById(scriptId) as HTMLScriptElement | null)
      || (document.head.querySelector('script[type="application/ld+json"]') as HTMLScriptElement | null);
    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.id = scriptId;
    document.head.querySelectorAll('script[type="application/ld+json"]').forEach((element) => {
      if (element !== script) {
        element.remove();
      }
    });
    script.textContent = JSON.stringify(config.structuredData ?? {}, null, 0);
  }, [config]);
}

function toAbsoluteImageUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  return buildAbsoluteUrl(url);
}

function inferImageMimeType(url: string): string {
  const pathname = url.split('?')[0].toLowerCase();
  if (pathname.endsWith('.png')) return 'image/png';
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
  if (pathname.endsWith('.webp')) return 'image/webp';
  return 'image/png';
}

export function navigate(to: string, options: { scrollToTop?: boolean } = {}) {
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
  if (options.scrollToTop) {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
  }
}

export function PageFrame({
  active,
  children,
}: {
  active: NavigationKind;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#fafafa] font-sans flex flex-col relative">
      <PublicTopNav active={active} />
      <div className="relative z-10 flex-grow">{children}</div>
      <SiteFooter />
    </div>
  );
}

function PublicTopNav({ active }: { active: NavigationKind }) {
  const resolvedActive: PublicNavigationKind = active === 'docs' ? 'home' : active;
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const drawer = root?.querySelector<HTMLDetailsElement>('[data-public-mobile-drawer="true"]');
    const summary = drawer?.querySelector<HTMLElement>('summary');
    if (!drawer || !summary) return;

    const onToggle = () => {
      summary.setAttribute('aria-label', drawer.open ? '关闭主导航' : '打开主导航');
      document.documentElement.style.overflow = drawer.open ? 'hidden' : '';
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !drawer.open) return;
      drawer.open = false;
      onToggle();
      summary.focus();
    };
    const onRootClick = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('[data-public-mobile-drawer="true"] > summary')) return;
      window.requestAnimationFrame(onToggle);
    };
    drawer.addEventListener('toggle', onToggle);
    root.addEventListener('click', onRootClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      drawer.removeEventListener('toggle', onToggle);
      root.removeEventListener('click', onRootClick);
      document.removeEventListener('keydown', onKeyDown);
      document.documentElement.style.overflow = '';
    };
  }, []);

  return (
    <>
      <style>{PUBLIC_TOP_NAV_STYLES}</style>
      <div
        ref={rootRef}
        className="public-top-nav-root"
        onClick={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest('[data-public-mobile-drawer="true"] > summary')) {
            window.setTimeout(() => {
              const drawer = rootRef.current?.querySelector<HTMLDetailsElement>('[data-public-mobile-drawer="true"]');
              const summary = drawer?.querySelector<HTMLElement>('summary');
              if (!drawer || !summary) return;
              summary.setAttribute('aria-label', drawer.open ? '关闭主导航' : '打开主导航');
              document.documentElement.style.overflow = drawer.open ? 'hidden' : '';
            }, 0);
          }
          const link = target.closest('a[data-client-nav="true"]');
          if (!link) {
            return;
          }
          const drawer = rootRef.current?.querySelector<HTMLDetailsElement>('[data-public-mobile-drawer="true"]');
          if (drawer?.open) drawer.open = false;
          event.preventDefault();
          const href = link.getAttribute('href');
          if (href) {
            navigate(href);
          }
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          const drawer = rootRef.current?.querySelector<HTMLDetailsElement>('[data-public-mobile-drawer="true"]');
          const summary = drawer?.querySelector<HTMLElement>('summary');
          if (!drawer?.open || !summary) return;
          drawer.open = false;
          summary.setAttribute('aria-label', '打开主导航');
          document.documentElement.style.overflow = '';
          summary.focus();
        }}
        dangerouslySetInnerHTML={{ __html: renderPublicTopNav(resolvedActive) }}
      />
    </>
  );
}

function SiteFooter() {
  const footerNavigation = PUBLIC_NAVIGATION_ITEMS.filter((item) => item.href);
  return (
    <footer
      className="relative mt-16 overflow-hidden border-t border-gray-100 bg-white py-16"
      style={{
        backgroundImage: 'linear-gradient(to right, rgba(0, 0, 0, 0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 0, 0, 0.03) 1px, transparent 1px)',
        backgroundSize: '30px 30px',
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(#f3f3f3_1.2px,transparent_1.2px)] [background-size:24px_24px] opacity-60" />
      <div className="relative mx-auto max-w-7xl space-y-8 px-4 text-center sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-black shadow-sm">
            <Zap className="h-6 w-6 fill-white text-white" />
          </div>
          <h2 className="text-[18px] font-bold tracking-tight text-gray-950">{PUBLIC_SITE_BRAND_NAME}</h2>
        </div>
        <p className="mx-auto max-w-3xl text-sm leading-relaxed text-gray-400">
            {PUBLIC_SITE_BRAND_NAME}
            以公开监测数据、评分趋势和风险记录构建机场推荐体系，帮助用户在今日推荐、机场排行与测评报告之间完成交叉判断。
        </p>

        <nav aria-label="页脚导航" className="flex flex-wrap justify-center gap-x-8 gap-y-3 pt-2 text-[14px] font-semibold text-gray-700">
          {footerNavigation.map((item) => item.kind === 'news' ? (
            <a key={item.kind} href={item.href} className="transition-colors hover:text-black">{item.label}</a>
          ) : (
            <a key={item.kind} href={item.href} onClick={(event) => { event.preventDefault(); navigate(item.href || '/'); }} className="transition-colors hover:text-black">{item.label}</a>
          ))}
          <a href="/apply" className="hover:text-black transition-colors">申请入驻</a>
        </nav>

        <div className="mx-auto max-w-5xl border-t border-gray-100" />
        <div className="text-[12px] font-medium tracking-wide text-gray-400">
          <span>© 2026 {PUBLIC_SITE_BRAND_NAME}. All rights reserved. </span>
          <span className="mt-1 block font-normal text-gray-300 sm:mt-0 sm:inline">评分独立性声明：本站不含任何付费推广排名。</span>
        </div>
      </div>
    </footer>
  );
}
