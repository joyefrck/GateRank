import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type { Plugin } from 'vite';
import {defineConfig, loadEnv} from 'vite';
import { DEFAULT_NEWS_CATEGORIES, DEFAULT_NEWS_TOPICS } from './shared/newsTaxonomy';
import { PUBLISH_TOKEN_DOCS_LAST_UPDATED } from './shared/publishTokenDocs';
import { PUBLIC_DEALS_LASTMOD, PUBLIC_SEO_STATIC_LASTMOD } from './shared/publicSeo';
import { getIndexableFullRankingFilterPaths } from './shared/fullRankingFilters';

function emitSeoAssets(siteUrl: string): Plugin {
  const normalizedSiteUrl = siteUrl.replace(/\/+$/, '');

  return {
    name: 'emit-seo-assets',
    apply: 'build',
    generateBundle() {
      const urls = [
        ['/', PUBLIC_SEO_STATIC_LASTMOD],
        ['/rankings/all', PUBLIC_SEO_STATIC_LASTMOD],
        ...getIndexableFullRankingFilterPaths().map((pathname) => [pathname, PUBLIC_SEO_STATIC_LASTMOD] as const),
        ['/monthly-reports', PUBLIC_SEO_STATIC_LASTMOD],
        ['/deals', PUBLIC_DEALS_LASTMOD],
        ['/methodology', PUBLIC_SEO_STATIC_LASTMOD],
        ['/apply', PUBLIC_SEO_STATIC_LASTMOD],
        ['/risk-monitor', PUBLIC_SEO_STATIC_LASTMOD],
        ['/for-ai', PUBLIC_SEO_STATIC_LASTMOD],
        ['/publish-token-docs', PUBLISH_TOKEN_DOCS_LAST_UPDATED],
        ['/tools', '2026-07-25T00:00:00+08:00'],
        ['/tools/download', '2026-07-25T00:00:00+08:00'],
        ['/tools/streaming-check', '2026-07-10T00:00:00+08:00'],
        ['/tools/ip-check', '2026-07-24T00:00:00+08:00'],
        ['/tools/dns-leak-test', '2026-07-25T00:00:00+08:00'],
        ...DEFAULT_NEWS_CATEGORIES.map((item) => [`/news/category/${item.slug}`, PUBLIC_SEO_STATIC_LASTMOD] as const),
        ...DEFAULT_NEWS_TOPICS.map((item) => [`/news/topic/${item.slug}`, PUBLIC_SEO_STATIC_LASTMOD] as const),
      ] as const;
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Dynamic news pages are emitted by the backend sitemap route in production -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([pathname, lastmod]) => `  <url>
    <loc>${normalizedSiteUrl}${pathname}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`).join('\n')}
</urlset>
`;

      const robots = `User-agent: *
Disallow: /admin
Disallow: /api/v1/admin
Disallow: /portal
Disallow: /api/v1/portal
Allow: /

Sitemap: ${normalizedSiteUrl}/sitemap.xml

# Content signals
# GateRank allows search indexing and AI retrieval/grounding.
# GateRank does not grant permission for model training unless separately authorized.
Content-Signal: search=yes, ai-input=yes, ai-train=no
`;

      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: sitemap,
      });

      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: robots,
      });
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const siteUrl = (env.VITE_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');

  return {
    plugins: [react(), tailwindcss(), emitSeoAssets(siteUrl)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      manifest: true,
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name][extname]',
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8787',
          changeOrigin: true,
        },
        '/news': {
          target: env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8787',
          changeOrigin: true,
        },
        '/uploads': {
          target: env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8787',
          changeOrigin: true,
        },
        '/sitemap.xml': {
          target: env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8787',
          changeOrigin: true,
        },
        '/publish-token-docs.md': {
          target: env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8787',
          changeOrigin: true,
        },
        '/tools': {
          target: env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8787',
          changeOrigin: true,
        },
        '/download': {
          target: env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8787',
          changeOrigin: true,
        },
      },
    },
  };
});
