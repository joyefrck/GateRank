import React, { useEffect } from 'react';
import { ExternalLink, Zap } from 'lucide-react';

import { PUBLIC_SITE_BRAND_NAME } from '../../shared/publicBrand';

export type NavigationKind = 'home' | 'full_ranking' | 'risk_monitor' | 'methodology' | 'docs';

export interface SeoConfig {
  title: string;
  description: string;
  keywords: string;
  canonicalPath: string;
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

export function buildFullRankingHref(date?: string, page = 1): string {
  return `/rankings/all${buildQuery({
    date,
    page: page > 1 ? page : undefined,
  })}`;
}

export function buildRiskMonitorHref(date?: string, page = 1): string {
  return `/risk-monitor${buildQuery({
    date,
    page: page > 1 ? page : undefined,
  })}`;
}

export function buildMethodologyHref(): string {
  return '/methodology';
}

export function buildPublishTokenDocsHref(): string {
  return '/publish-token-docs';
}

export function buildNewsHref(): string {
  return '/news';
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
    setNamedMeta('robots', 'index,follow,max-image-preview:large');
    setPropertyMeta('og:type', 'website');
    setPropertyMeta('og:site_name', PUBLIC_SITE_BRAND_NAME);
    setPropertyMeta('og:title', config.title);
    setPropertyMeta('og:description', config.description);
    setPropertyMeta('og:url', canonicalUrl);
    setNamedMeta('twitter:card', 'summary_large_image');
    setNamedMeta('twitter:title', config.title);
    setNamedMeta('twitter:description', config.description);

    const canonical = ensureLinkTag('link[rel="canonical"]', () => {
      const element = document.createElement('link');
      element.setAttribute('rel', 'canonical');
      return element;
    });
    canonical.setAttribute('href', canonicalUrl);

    const scriptId = 'gaterank-jsonld';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(config.structuredData ?? {}, null, 0);
  }, [config]);
}

export function navigate(to: string) {
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
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
  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-100">
      <div className="max-w-7xl mx-auto px-4 h-[72px] flex items-center justify-between gap-4">
        <div className="flex items-center gap-10">
          <a
            href="/"
            className="flex items-center gap-3"
            onClick={(event) => {
              event.preventDefault();
              navigate('/');
            }}
          >
            <div className="w-9 h-9 bg-neutral-900 rounded-lg flex items-center justify-center shadow-xl">
              <Zap className="text-white w-5 h-5" />
            </div>
            <span className="font-black text-lg tracking-tighter leading-none">{PUBLIC_SITE_BRAND_NAME}</span>
          </a>
          <div className="hidden lg:flex items-center gap-3 text-[13px] font-black uppercase tracking-[0.18em]">
            <PublicNavLink href="/" label="今日推荐" active={active === 'home'} />
            <PublicNavLink href="/rankings/all" label="全量榜单" active={active === 'full_ranking'} />
            <a
              href={buildRiskMonitorHref()}
              onClick={(event) => {
                event.preventDefault();
                navigate(buildRiskMonitorHref());
              }}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 transition-colors ${
                active === 'risk_monitor' ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              跑路监测
              <span className="rounded-md bg-rose-500 px-2 py-1 text-[10px] tracking-[0.18em] text-white">实时</span>
            </a>
            <PublicNavLink href={buildMethodologyHref()} label="测评方法" active={active === 'methodology'} />
            <a
              href={buildNewsHref()}
              className="rounded-full px-4 py-2 text-[18px] text-[#c93a2e] transition-all hover:bg-neutral-100 font-serif"
            >
              News
            </a>
          </div>
        </div>
        <a
          className="bg-neutral-900 hover:bg-neutral-800 text-white min-h-12 px-5 py-3 rounded-lg text-[11px] md:text-xs font-black uppercase tracking-[0.18em] transition-all shadow-xl flex items-center gap-3"
          href="/apply"
          target="_blank"
          rel="noreferrer"
        >
          <span className="hidden sm:inline">申请入驻测试</span>
          <span className="sm:hidden">申请</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </nav>
  );
}

function PublicNavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <a
      href={href}
      className={`rounded-full px-4 py-2 transition-all ${
        active
          ? 'bg-neutral-900 text-white shadow-lg'
          : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
      }`}
      onClick={(event) => {
        event.preventDefault();
        navigate(href);
      }}
    >
      {label}
    </a>
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
            以公开监测数据、评分趋势和风险记录构建机场推荐体系，帮助用户在今日推荐、全量榜单与测评报告之间完成交叉判断。
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-x-12 gap-y-4 text-sm font-bold text-neutral-600 mb-12">
          <a href={buildHomeHref()} onClick={(event) => { event.preventDefault(); navigate('/'); }} className="hover:text-black transition-colors">今日推荐</a>
          <a href={buildFullRankingHref()} onClick={(event) => { event.preventDefault(); navigate('/rankings/all'); }} className="hover:text-black transition-colors">全量榜单</a>
          <a href={buildRiskMonitorHref()} onClick={(event) => { event.preventDefault(); navigate(buildRiskMonitorHref()); }} className="hover:text-black transition-colors">跑路监测</a>
          <a href={buildMethodologyHref()} onClick={(event) => { event.preventDefault(); navigate(buildMethodologyHref()); }} className="hover:text-black transition-colors">测评方法</a>
          <a href={buildNewsHref()} className="hover:text-black transition-colors">News</a>
          <a href="/apply" className="hover:text-black transition-colors">申请入驻</a>
          <a href="/portal" target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-600 transition-colors">申请人登录</a>
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
