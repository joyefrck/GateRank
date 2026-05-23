import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface PublicFrontendAssets {
  script: string;
  stylesheet: string;
}

export const FALLBACK_PUBLIC_FRONTEND_ASSETS: PublicFrontendAssets = {
  script: '/assets/index.js',
  stylesheet: '/assets/index.css',
};

interface ViteManifestEntry {
  file?: string;
  css?: string[];
  isEntry?: boolean;
}

type ViteManifest = Record<string, ViteManifestEntry>;

let cachedAssets: PublicFrontendAssets | null = null;

export function resolvePublicFrontendAssets(manifestPath = getDefaultManifestPath()): PublicFrontendAssets {
  if (manifestPath === getDefaultManifestPath() && cachedAssets) {
    return cachedAssets;
  }

  const assets = readManifestAssets(manifestPath) || FALLBACK_PUBLIC_FRONTEND_ASSETS;
  if (manifestPath === getDefaultManifestPath()) {
    cachedAssets = assets;
  }
  return assets;
}

export function readManifestAssets(manifestPath: string): PublicFrontendAssets | null {
  if (!existsSync(manifestPath)) {
    return null;
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ViteManifest;
  const entry = manifest['index.html'] || Object.values(manifest).find((item) => item.isEntry);
  if (!entry?.file) {
    return null;
  }

  return {
    script: toPublicAssetPath(entry.file),
    stylesheet: toPublicAssetPath(entry.css?.[0] || FALLBACK_PUBLIC_FRONTEND_ASSETS.stylesheet),
  };
}

function getDefaultManifestPath(): string {
  return process.env.FRONTEND_MANIFEST_PATH || path.join(process.cwd(), 'dist', '.vite', 'manifest.json');
}

function toPublicAssetPath(file: string): string {
  return file.startsWith('/') ? file : `/${file}`;
}
