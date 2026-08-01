# AI Crawler Access and Sitemap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a curated AI-focused sitemap and allow search/user retrieval crawlers to access GateRank's public tool pages without opening private APIs or installer downloads.

**Architecture:** Add a focused XML renderer and an Express route for `/sitemap-ai.xml`, advertise it next to the standard sitemap in `robots.txt`, and proxy it through the production Nginx configuration. Independently update the existing Cloudflare skip rule so only public `GET`/`HEAD` routes are exempted for search and user-retrieval agents; keep training crawlers and sensitive/download paths outside the exemption.

**Tech Stack:** TypeScript, Express, Node test runner, Nginx, Cloudflare WAF custom rules.

---

### Task 1: Define the AI sitemap contract with failing tests

**Files:**
- Modify: `backend/tests/machineReadableRoutes.test.ts`
- Modify: `backend/tests/nginxConfig.test.ts`

- [x] **Step 1: Add a route regression test**

Add a test that requests `/sitemap-ai.xml`, asserts HTTP 200, `application/xml`, public cache headers, unique absolute `<loc>` entries for the fixed machine-readable resources, `/airports/nebula.md`, and `/monthly-reports/2026-06-airport-vpn-ranking-report.md`.

```ts
test('GET /sitemap-ai.xml returns curated machine-readable and dynamic Markdown URLs', async () => {
  const { baseUrl, close } = await startMachineReadableServer();
  try {
    const response = await fetch(`${baseUrl}/sitemap-ai.xml`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /application\/xml/);
    assert.equal(
      response.headers.get('cache-control'),
      'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
    );
    const xml = await response.text();
    const locations = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), (match) => match[1]);
    assert.equal(new Set(locations).size, locations.length);
    for (const path of [
      '/llms.txt',
      '/llms-full.txt',
      '/for-ai',
      '/data/rankings.json',
      '/data/rankings.md',
      '/data/risk-monitor.json',
      '/data/risk-monitor.md',
      '/deals.md',
      '/monthly-reports.md',
      '/tools',
      '/tools/download',
      '/airports/nebula.md',
      '/monthly-reports/2026-06-airport-vpn-ranking-report.md',
    ]) {
      assert.ok(locations.includes(`${baseUrl}${path}`), path);
    }
  } finally {
    await close();
  }
});
```

- [x] **Step 2: Extend the mounted-route and robots assertions**

Assert that `/sitemap-ai.xml` does not fall through to the application 404 handler and that `robots.txt` contains both:

```text
Sitemap: <origin>/sitemap.xml
Sitemap: <origin>/sitemap-ai.xml
```

Extend the existing mounted-route path array with:

```ts
'/sitemap-ai.xml',
```

Extend the robots test with:

```ts
assert.match(body, new RegExp(`^Sitemap: ${baseUrl.replace(/\//g, '\\/')}/sitemap-ai\\.xml$`, 'm'));
```

- [x] **Step 3: Add the Nginx contract assertion**

Add `/sitemap-ai.xml` to the exact public SEO routes that must proxy to `gaterank-api:8787`.

```ts
'/sitemap-ai.xml',
```

- [x] **Step 4: Run the focused tests and confirm the red state**

Run:

```bash
npx tsx --test backend/tests/machineReadableRoutes.test.ts backend/tests/nginxConfig.test.ts
```

Expected: failures showing `/sitemap-ai.xml` is currently 404, the second robots sitemap line is absent, and the exact Nginx location is missing.

### Task 2: Implement the curated AI sitemap

**Files:**
- Create: `backend/src/services/aiSitemapRenderer.ts`
- Modify: `backend/src/routes/machineReadableRoutes.ts`
- Modify: `backend/src/services/machineReadableRenderer.ts`
- Modify: `nginx.conf`
- Modify: `vite.config.ts`

- [x] **Step 1: Implement a pure XML renderer**

Create `renderAiSitemapXml(siteUrl, airportReportPaths, monthlyReportSlugs)` that emits UTF-8 Sitemap Protocol XML, deduplicates URLs, escapes XML values, and contains the fixed public machine-readable and tool-page paths plus dynamic airport and monthly-report Markdown paths.

```ts
const AI_SITEMAP_STATIC_PATHS = [
  '/llms.txt', '/llms-full.txt', '/for-ai', '/data',
  '/data/summary.json', '/data/summary.md',
  '/data/rankings.json', '/data/rankings.md',
  '/data/risk-monitor.json', '/data/risk-monitor.md',
  '/data/deals.json', '/deals.md',
  '/data/monthly-reports.json', '/monthly-reports.md',
  '/tools', '/tools/download', '/tools/streaming-check',
  '/tools/ip-check', '/tools/dns-leak-test',
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
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((url) => `  <url>\n    <loc>${escapeXml(url)}</loc>\n  </url>`)
    .join('\n')}\n</urlset>\n`;
}
```

- [x] **Step 2: Mount `/sitemap-ai.xml`**

Load the full ranking view and published monthly-report sitemap items, render the XML, set public cache headers, and return `application/xml`. If monthly reports are unavailable, retain the fixed and airport entries rather than failing the whole sitemap.

```ts
router.get('/sitemap-ai.xml', async (req, res) => {
  try {
    const date = getDateInTimezone();
    const [rankingsView, monthlyReportSlugs] = await Promise.all([
      deps.publicViewService.getFullRankingView(date, 1, MACHINE_READABLE_PAGE_SIZE),
      getAiSitemapMonthlyReportSlugs(deps),
    ]);
    const airportReportPaths = rankingsView.items
      .map((item) => item.report_url || '')
      .filter((path) => path.startsWith('/airports/'));
    setPublicCacheHeaders(res);
    res
      .status(200)
      .type('application/xml')
      .send(renderAiSitemapXml(getSiteOrigin(req), airportReportPaths, monthlyReportSlugs));
  } catch (error) {
    console.error('[machine-readable] failed to render sitemap-ai.xml', {
      error,
      requestId: req.requestId || 'unknown',
    });
    sendText(res.status(500), 'text/plain; charset=utf-8', 'GateRank AI sitemap 暂时无法生成');
  }
});

async function getAiSitemapMonthlyReportSlugs(deps: MachineReadableDeps): Promise<string[]> {
  if (!deps.monthlyReportPublicService) return [];
  try {
    const items = await deps.monthlyReportPublicService.getSitemapItems();
    return items
      .filter((item) => item.status === 'published' && Boolean(item.published_at))
      .map((item) => item.slug);
  } catch (error) {
    console.error('[machine-readable] failed to load AI sitemap monthly reports', { error });
    return [];
  }
}
```

- [x] **Step 3: Advertise the second sitemap**

Append `Sitemap: ${siteUrl}/sitemap-ai.xml` immediately after the existing standard sitemap line in `renderRobotsTxt`.

```ts
`Sitemap: ${siteUrl}/sitemap.xml`,
`Sitemap: ${siteUrl}/sitemap-ai.xml`,
```

- [x] **Step 4: Proxy the new route through Nginx**

Add an exact `/sitemap-ai.xml` location matching the headers and upstream used by `/sitemap.xml`.

```nginx
location = /sitemap-ai.xml {
  proxy_pass http://gaterank-api:8787/sitemap-ai.xml;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-Host $host;
}
```

Also add `/sitemap-ai.xml` to the Vite development proxy and keep the build-generated `robots.txt` declaration aligned with the backend renderer.

- [x] **Step 5: Run the focused tests and confirm green**

Run:

```bash
npx tsx --test backend/tests/machineReadableRoutes.test.ts backend/tests/nginxConfig.test.ts
```

Expected: all focused tests pass.

### Task 3: Update Cloudflare crawler access without widening protected surfaces

**Files:**
- External configuration: Cloudflare custom rule `Allow AI crawlers on public content`

- [x] **Step 1: Preserve the existing method boundary**

Keep the expression limited to `GET` and `HEAD`.

- [x] **Step 2: Align crawler identities with search/retrieval policy**

Allow the search/user agents `chatgpt-user`, `oai-searchbot`, `perplexitybot`, `perplexity-user`, `claude-searchbot`, and `claude-user`. Remove training-only agents from this exception so `GPTBot`, `ClaudeBot`, and `Bytespider` continue to follow GateRank's `ai-train=no` policy.

- [x] **Step 3: Add exact public tool and AI sitemap paths**

Add `/sitemap-ai.xml`, `/tools`, `/tools/download`, `/tools/streaming-check`, `/tools/ip-check`, and `/tools/dns-leak-test`. Do not add `/download/file/`, `/api/`, `/admin`, or `/portal` paths.

Use this complete expression:

```text
(http.request.method in {"GET" "HEAD"} and (
  lower(http.user_agent) contains "chatgpt-user" or
  lower(http.user_agent) contains "oai-searchbot" or
  lower(http.user_agent) contains "perplexitybot" or
  lower(http.user_agent) contains "perplexity-user" or
  lower(http.user_agent) contains "claude-searchbot" or
  lower(http.user_agent) contains "claude-user"
) and (
  http.request.uri.path in {
    "/" "/risk-monitor" "/methodology" "/deals" "/deals.md"
    "/monthly-reports" "/monthly-reports.md" "/news"
    "/llms.txt" "/llms-full.txt" "/for-ai" "/data"
    "/robots.txt" "/sitemap.xml" "/sitemap-ai.xml"
    "/tools" "/tools/download" "/tools/streaming-check"
    "/tools/ip-check" "/tools/dns-leak-test"
  } or
  starts_with(http.request.uri.path, "/rankings/") or
  starts_with(http.request.uri.path, "/airports/") or
  starts_with(http.request.uri.path, "/monthly-reports/") or
  starts_with(http.request.uri.path, "/news/") or
  starts_with(http.request.uri.path, "/data/")
))
```

- [x] **Step 4: Save the rule and verify its displayed expression**

Confirm the rule stays active, remains first in custom-rule order, and retains its Skip action for the relevant later AI-bot blocking rule.

### Task 4: Full regression and live acceptance

**Files:**
- Verification only

- [x] **Step 1: Run repository verification**

Run:

```bash
npm run test:backend
npm run build
```

Expected: backend suite and production build exit 0. Record unrelated baseline failures separately if present.

- [x] **Step 2: Verify local route semantics**

Confirm `/sitemap-ai.xml` returns 200 XML, contains no duplicate `<loc>` entries, lists the dynamic airport/monthly Markdown resources, and `robots.txt` advertises both sitemaps.

- [x] **Step 3: Verify the live Cloudflare UA matrix**

Check public core, tool, and sitemap paths with the six search/user UAs. Tool pages must return 200 after the Cloudflare change. Training UAs must not be granted the new broad exception.

- [x] **Step 4: Review the final diff**

Run:

```bash
git status --short --branch
git diff --check
git diff --stat
```

Expected: only the plan, renderer, route, robots, Nginx, and focused test files are changed; no whitespace errors.
