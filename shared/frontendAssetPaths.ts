/** Keep API and web builds aligned while separating every release's browser cache. */
export function frontendAssetDirectory(version?: string): string {
  const release = version?.trim();
  if (!release) return 'assets';
  if (!/^[a-zA-Z0-9._-]+$/.test(release)) throw new Error('Invalid frontend asset release version');
  return `assets/${release}`;
}

export interface FrontendAssetCompatibilitySources {
  script: string;
  stylesheet: string;
}

/** Keep cached HTML functional after assets move into a release-specific directory. */
export function frontendAssetCompatibilitySources(
  assetDirectory: string,
): FrontendAssetCompatibilitySources | null {
  if (assetDirectory === 'assets') return null;
  if (!/^assets\/[a-zA-Z0-9._-]+$/.test(assetDirectory)) {
    throw new Error('Invalid frontend asset directory');
  }
  return {
    script: `import "/${assetDirectory}/index.js";\n`,
    stylesheet: `@import url("/${assetDirectory}/index.css");\n`,
  };
}
