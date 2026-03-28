import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type { Plugin } from 'vite';
import {defineConfig, loadEnv} from 'vite';

function emitSeoAssets(siteUrl: string): Plugin {
  const normalizedSiteUrl = siteUrl.replace(/\/+$/, '');

  return {
    name: 'emit-seo-assets',
    apply: 'build',
    generateBundle() {
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Dynamic news pages are emitted by the backend sitemap route in production -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${normalizedSiteUrl}/</loc>
  </url>
  <url>
    <loc>${normalizedSiteUrl}/rankings/all</loc>
  </url>
  <url>
    <loc>${normalizedSiteUrl}/methodology</loc>
  </url>
  <url>
    <loc>${normalizedSiteUrl}/apply</loc>
  </url>
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
      },
    },
  };
});
