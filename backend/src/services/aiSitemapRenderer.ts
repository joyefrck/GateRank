const AI_SITEMAP_STATIC_PATHS = [
  '/llms.txt',
  '/llms-full.txt',
  '/for-ai',
  '/data',
  '/data/summary.json',
  '/data/summary.md',
  '/data/rankings.json',
  '/data/rankings.md',
  '/data/risk-monitor.json',
  '/data/risk-monitor.md',
  '/data/deals.json',
  '/deals.md',
  '/data/monthly-reports.json',
  '/monthly-reports.md',
  '/tools',
  '/tools/download',
  '/tools/streaming-check',
  '/tools/ip-check',
      '/tools/ip-purity-check',
  '/tools/dns-leak-test',
] as const;

export function renderAiSitemapXml(
  siteUrl: string,
  airportReportPaths: string[],
  monthlyReportSlugs: string[],
): string {
  const origin = siteUrl.replace(/\/+$/, '');
  const paths = [
    ...AI_SITEMAP_STATIC_PATHS,
    ...airportReportPaths
      .filter((path) => path.startsWith('/airports/'))
      .map((path) => `${path}.md`),
    ...monthlyReportSlugs.map((slug) => `/monthly-reports/${slug}.md`),
  ];
  const urls = Array.from(new Set(paths)).map((path) => `${origin}${path}`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((url) => `  <url>
    <loc>${escapeXml(url)}</loc>
  </url>`)
  .join('\n')}
</urlset>
`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
