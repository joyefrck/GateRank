/** Keep API and web builds aligned while separating every release's browser cache. */
export function frontendAssetDirectory(version?: string): string {
  const release = version?.trim();
  if (!release) return 'assets';
  if (!/^[a-zA-Z0-9._-]+$/.test(release)) throw new Error('Invalid frontend asset release version');
  return `assets/${release}`;
}
