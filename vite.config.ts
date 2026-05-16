import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type { Plugin } from 'vite';
import {defineConfig, loadEnv} from 'vite';
import { PUBLISH_TOKEN_DOCS_LAST_UPDATED } from './shared/publishTokenDocs';
import { PUBLIC_SEO_STATIC_LASTMOD } from './shared/publicSeo';

function emitSeoAssets(siteUrl: string): Plugin {
  const normalizedSiteUrl = siteUrl.replace(/\/+$/, '');

  return {
    name: 'emit-seo-assets',
    apply: 'build',
    generateBundle() {
      const urls = [
        ['/', PUBLIC_SEO_STATIC_LASTMOD],
        ['/rankings/all', PUBLIC_SEO_STATIC_LASTMOD],
        ['/methodology', PUBLIC_SEO_STATIC_LASTMOD],
        ['/apply', PUBLIC_SEO_STATIC_LASTMOD],
        ['/risk-monitor', PUBLIC_SEO_STATIC_LASTMOD],
        ['/publish-token-docs', PUBLISH_TOKEN_DOCS_LAST_UPDATED],
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
Allow: /

Sitemap: ${normalizedSiteUrl}/sitemap.xml
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
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[name].js',
          assetFileNames: (assetInfo) => {
            const name = assetInfo.names?.[0] || assetInfo.name || '';
            if (name.endsWith('.css')) {
              return 'assets/[name][extname]';
            }
            return 'assets/[name]-[hash][extname]';
          },
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
      },
    },
  };
});
