import React, { useEffect } from 'react';
import { Zap } from 'lucide-react';

import { PUBLIC_SITE_BRAND_NAME } from '../../shared/publicBrand';
import { type PublicNavigationKind } from '../../shared/publicNavigation';
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
    <div className="min-h-screen bg-white font-sans flex flex-col relative">
      <div
        className="fixed inset-0 opacity-[0.015] pointer-events-none z-0"
        style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      />
      <PublicTopNav active={active} />
      <div className="relative z-10 flex-grow">{children}</div>
      <SiteFooter />
    </div>
  );
}

function PublicTopNav({ active }: { active: NavigationKind }) {
  const resolvedActive: PublicNavigationKind = active === 'docs' ? 'home' : active;

  return (
    <>
      <style>{PUBLIC_TOP_NAV_STYLES}</style>
      <div
        onClick={(event) => {
          const link = (event.target as HTMLElement).closest('a[data-client-nav="true"]');
          if (!link) {
            return;
          }
          event.preventDefault();
          const href = link.getAttribute('href');
          if (href) {
            navigate(href);
          }
        }}
        dangerouslySetInnerHTML={{ __html: renderPublicTopNav(resolvedActive) }}
      />
    </>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-white border-t border-neutral-200 mt-24 py-16">
      <div className="max-w-7xl mx-auto px-4 text-center">
        <div className="flex flex-col items-center gap-6 mb-12">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <Zap className="text-white w-5 h-5" />
            </div>
            <span className="font-black text-xl tracking-tighter leading-none">{PUBLIC_SITE_BRAND_NAME}</span>
          </div>
          <p className="max-w-2xl text-[13px] md:text-sm leading-7 text-neutral-500">
            {PUBLIC_SITE_BRAND_NAME}
            以公开监测数据、评分趋势和风险记录构建机场推荐体系，帮助用户在今日推荐、机场排行与测评报告之间完成交叉判断。
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-x-12 gap-y-4 text-sm font-bold text-neutral-600 mb-12">
          <a href={buildHomeHref()} onClick={(event) => { event.preventDefault(); navigate('/'); }} className="hover:text-black transition-colors">今日推荐</a>
          <a href={buildFullRankingHref()} onClick={(event) => { event.preventDefault(); navigate('/rankings/all'); }} className="hover:text-black transition-colors">机场排行</a>
          <a href={buildMonthlyReportsHref()} onClick={(event) => { event.preventDefault(); navigate(buildMonthlyReportsHref()); }} className="hover:text-black transition-colors">月度报告</a>
          <a href={buildDealsHref()} onClick={(event) => { event.preventDefault(); navigate(buildDealsHref()); }} className="hover:text-black transition-colors">活动优惠</a>
          <a href={buildRiskMonitorHref()} onClick={(event) => { event.preventDefault(); navigate(buildRiskMonitorHref()); }} className="hover:text-black transition-colors">跑路监测</a>
          <a href={buildMethodologyHref()} onClick={(event) => { event.preventDefault(); navigate(buildMethodologyHref()); }} className="hover:text-black transition-colors">测评方法</a>
          <a href={buildToolsHref()} onClick={(event) => { event.preventDefault(); navigate(buildToolsHref()); }} className="hover:text-black transition-colors">工具</a>
          <a href={buildToolsDownloadHref()} onClick={(event) => { event.preventDefault(); navigate(buildToolsDownloadHref()); }} className="hover:text-black transition-colors">翻墙工具下载</a>
          <a href={buildNewsHref()} className="hover:text-black transition-colors">News</a>
          <a href="/apply" className="hover:text-black transition-colors">申请入驻</a>
        </div>

        <div className="border-t border-neutral-100 pt-8">
          <div className="text-[11px] md:text-xs text-neutral-400 font-medium">
            © 2026 {PUBLIC_SITE_BRAND_NAME}. All rights reserved. 评分独立性声明：本站不含任何付费推广排名。
          </div>
        </div>
      </div>
    </footer>
  );
}
