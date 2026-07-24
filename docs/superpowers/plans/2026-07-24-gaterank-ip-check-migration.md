# GateRank IP Check Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the visible IP lookup behavior from `ipcha.org` into GateRank at `/tools/ip-check`, use ip-api Pro through the GateRank backend, then retire the old standalone container with a controlled `410 Gone`.

**Architecture:** GateRank SSR renders an indexable IP-check shell and the existing React bundle hydrates it into an interactive page. A shared contract isolates the UI from ip-api Pro, while an injected backend service validates public IP/domain targets, applies timeouts, normalizes provider responses, and avoids persistent query storage.

**Tech Stack:** React 19, Vite 6, TypeScript 5.8, Express 4, Leaflet, ip-api Pro, Node test runner, Docker, 1Panel OpenResty

---

### Task 1: Shared IP-check contract and target validation

**Files:**
- Create: `shared/ipCheck.ts`
- Create: `backend/tests/ipCheckShared.test.ts`

- [ ] **Step 1: Write failing validation and translation tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeIpCheckTarget,
  isPublicIpAddress,
  IP_CHECK_TRANSLATIONS,
} from '../../shared/ipCheck';

test('normalizes public IP addresses and domains', () => {
  assert.equal(normalizeIpCheckTarget(' 8.8.8.8 '), '8.8.8.8');
  assert.equal(normalizeIpCheckTarget('Example.COM'), 'example.com');
  assert.equal(normalizeIpCheckTarget('bücher.de'), 'xn--bcher-kva.de');
});

test('rejects URLs, local names and non-public IP addresses', () => {
  for (const value of ['https://example.com', 'localhost', 'router.local', '127.0.0.1', '10.0.0.1', '::1']) {
    assert.throws(() => normalizeIpCheckTarget(value));
  }
  assert.equal(isPublicIpAddress('8.8.8.8'), true);
});

test('ships matching Chinese and English error keys', () => {
  assert.ok(IP_CHECK_TRANSLATIONS.zh.errors.timeout);
  assert.ok(IP_CHECK_TRANSLATIONS.en.errors.timeout);
});
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `npx tsx --test backend/tests/ipCheckShared.test.ts`

Expected: FAIL because `shared/ipCheck.ts` does not exist.

- [ ] **Step 3: Implement the shared contract**

Create types for `IpCheckRequest`, `IpCheckResult`, `IpCheckSuccessResponse`,
`IpCheckLanguage`, translations, `normalizeIpCheckTarget()`, and
`isPublicIpAddress()`. Use `node:net` and `node:url`, reject non-public IPv4/IPv6
ranges, and normalize IDNs through `domainToASCII()`.

```ts
export interface IpCheckResult {
  ip: string;
  country: string;
  country_code: string;
  region: string;
  region_name: string;
  city: string;
  postal_code: string;
  latitude: number;
  longitude: number;
  timezone: string;
  isp: string;
  organization: string;
  asn: string;
}

export interface IpCheckRequest {
  query?: string;
}

export interface IpCheckSuccessResponse {
  checked_at: string;
  result: IpCheckResult;
}
```

- [ ] **Step 4: Run the focused tests**

Run: `npx tsx --test backend/tests/ipCheckShared.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/ipCheck.ts backend/tests/ipCheckShared.test.ts
git commit -m "feat: add IP check contract and validation"
```

### Task 2: ip-api Pro provider adapter

**Files:**
- Create: `backend/src/services/ipGeolocationService.ts`
- Create: `backend/tests/ipGeolocationService.test.ts`

- [ ] **Step 1: Write failing provider tests**

Cover:

- success-field normalization;
- provider `status: "fail"` mapping to `IP_CHECK_LOOKUP_FAILED`;
- non-2xx and invalid JSON mapping to `IP_CHECK_UPSTREAM_ERROR`;
- abort timeout mapping to `IP_CHECK_UPSTREAM_TIMEOUT`;
- missing Key mapping to `IP_CHECK_NOT_CONFIGURED`;
- no secret or query value in thrown/logged messages.

Inject `fetchImpl` and environment values so tests never call the network.

```ts
const service = new IpGeolocationService({
  apiKey: 'test-secret',
  fetchImpl: async () => new Response(JSON.stringify({
    status: 'success',
    query: '8.8.8.8',
    country: 'United States',
    countryCode: 'US',
    region: 'VA',
    regionName: 'Virginia',
    city: 'Ashburn',
    zip: '20149',
    lat: 39.03,
    lon: -77.5,
    timezone: 'America/New_York',
    isp: 'Google LLC',
    org: 'Google Public DNS',
    as: 'AS15169 Google LLC',
  }), { status: 200 }),
});
```

- [ ] **Step 2: Run the provider test and verify failure**

Run: `npx tsx --test backend/tests/ipGeolocationService.test.ts`

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement the provider**

Define `IpCheckService`, typed `IpCheckServiceError`, and `IpGeolocationService`.
Build the upstream URL with `URL`, request the exact field list, use
`AbortController`, validate finite coordinates, and never include the URL,
API Key, query, or provider body in public errors.

```ts
export interface IpCheckService {
  lookup(query: string): Promise<IpCheckResult>;
}

export class IpCheckServiceError extends Error {
  constructor(
    public readonly code: IpCheckErrorCode,
    public readonly status: number,
  ) {
    super(code);
  }
}
```

- [ ] **Step 4: Run provider tests**

Run: `npx tsx --test backend/tests/ipGeolocationService.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/ipGeolocationService.ts backend/tests/ipGeolocationService.test.ts
git commit -m "feat: add ip-api Pro geolocation provider"
```

### Task 3: GateRank IP-check API

**Files:**
- Modify: `backend/src/routes/toolsPublicRoutes.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/tests/toolsRoutes.test.ts`

- [ ] **Step 1: Add failing API tests**

Test:

- omitted query resolves `CF-Connecting-IP`;
- manual query is normalized and passed to the injected service;
- success returns `private, no-store` and `Pragma: no-cache`;
- invalid/private input returns `400 IP_CHECK_INVALID_QUERY`;
- provider errors preserve the approved HTTP/error mapping;
- the route is POST-only;
- rate limit returns `429 IP_CHECK_RATE_LIMITED`.

Use a stub:

```ts
ipCheckService: {
  lookup: async (query) => {
    assert.equal(query, '8.8.8.8');
    return createIpCheckResult(query);
  },
},
```

- [ ] **Step 2: Run the route tests and verify failure**

Run: `npx tsx --test backend/tests/toolsRoutes.test.ts`

Expected: FAIL because `/api/v1/tools/ip-check` is not registered.

- [ ] **Step 3: Implement the route and dependency wiring**

Extend `ToolsPublicDeps` with `ipCheckService`. Add a dedicated rate limiter using
`IP_CHECK_RATE_WINDOW_MS` and `IP_CHECK_RATE_MAX`. Resolve the current visitor IP
with `resolveVisitorIp(req)`, validate with `normalizeIpCheckTarget()`, call the
service, and respond with `sendError()` for stable error codes.

Instantiate `IpGeolocationService` in `createApp()` using server-only environment
values and inject it into `createToolsPublicRoutes()`.

- [ ] **Step 4: Run the focused tests**

Run: `npx tsx --test backend/tests/toolsRoutes.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/toolsPublicRoutes.ts backend/src/app.ts backend/tests/toolsRoutes.test.ts
git commit -m "feat: expose GateRank IP check API"
```

### Task 4: SSR, SEO, navigation, and discovery

**Files:**
- Modify: `shared/publicNavigation.ts`
- Modify: `shared/publicSeo.ts`
- Modify: `backend/src/services/publicPageRenderer.ts`
- Modify: `backend/src/routes/publicPageRoutes.ts`
- Modify: `backend/src/routes/newsPublicRoutes.ts`
- Modify: `backend/src/services/machineReadableRenderer.ts`
- Modify: `vite.config.ts`
- Modify: `backend/tests/publicPageRoutes.test.ts`
- Modify: `backend/tests/newsPublicRoutes.test.ts`
- Modify: `backend/tests/machineReadableRoutes.test.ts`
- Modify: `backend/tests/nginxConfig.test.ts`

- [ ] **Step 1: Add failing SSR and discovery assertions**

Assert that `/tools/ip-check`:

- is indexable and no longer contains “即将上线”;
- renders an H1, search input/button, waiting result shell, privacy text, nav, footer,
  canonical, OG tags, WebApplication/BreadcrumbList/FAQPage JSON-LD;
- appears in static and dynamic sitemap;
- appears in machine-readable core page links;
- remains proxied by `nginx.conf`.

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
npx tsx --test backend/tests/publicPageRoutes.test.ts
npx tsx --test backend/tests/newsPublicRoutes.test.ts
npx tsx --test backend/tests/machineReadableRoutes.test.ts
npx tsx --test backend/tests/nginxConfig.test.ts
```

Expected: IP-check assertions fail against the placeholder page and missing sitemap entry.

- [ ] **Step 3: Implement public-page metadata and SSR shell**

Add `PUBLIC_SEO_PATHS.ipCheck`, an OG mapping, and
`renderIpCheckPublicPage()`. Use `renderPublicDocument()` with the shared frontend
bundle and no personalized initial data.

Remove the IP-check badge from `PUBLIC_NAVIGATION_ITEMS`. Update Vite and backend
sitemaps with lastmod `2026-07-24T00:00:00+08:00`. Add the page to the
machine-readable core page list.

- [ ] **Step 4: Run the focused tests**

Run the four commands from Step 2.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/publicNavigation.ts shared/publicSeo.ts \
  backend/src/services/publicPageRenderer.ts backend/src/routes/publicPageRoutes.ts \
  backend/src/routes/newsPublicRoutes.ts backend/src/services/machineReadableRenderer.ts \
  vite.config.ts backend/tests/publicPageRoutes.test.ts \
  backend/tests/newsPublicRoutes.test.ts backend/tests/machineReadableRoutes.test.ts \
  backend/tests/nginxConfig.test.ts
git commit -m "feat: publish IP check SSR and discovery metadata"
```

### Task 5: Interactive IP-check page

**Files:**
- Create: `src/pages/ipCheck/IPCheckPage.tsx`
- Create: `src/pages/ipCheck/IpCheckMap.tsx`
- Create: `src/pages/ipCheck/ipCheckState.ts`
- Create: `backend/tests/ipCheckState.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/index.css`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Add failing state tests**

Test that:

- initial load queries without a target;
- `IP_CHECK_CLIENT_IP_REQUIRED` triggers one ipify fallback;
- a manual domain remains the visible search value after a resolved-IP response;
- retry preserves the last requested target;
- language changes error and label text without re-querying.

- [ ] **Step 2: Run state tests and verify failure**

Run: `npx tsx --test backend/tests/ipCheckState.test.ts`

Expected: FAIL because `ipCheckState.ts` does not exist.

- [ ] **Step 3: Install map dependencies**

Run:

```bash
npm install leaflet
npm install --save-dev @types/leaflet
```

Expected: `package.json` and `package-lock.json` include Leaflet runtime and types.

- [ ] **Step 4: Implement the state helper and page**

Build:

- bilingual hero, search, validation, loading skeleton and error/retry card;
- responsive map/results layout;
- main fields and detailed fields with accessible copy buttons;
- language switcher;
- ElephantRoute banner with `rel="nofollow sponsored noopener noreferrer"`;
- accurate privacy disclosure about GateRank and ip-api Pro processing.

Fetch:

```ts
fetch(`${getApiBase()}/api/v1/tools/ip-check`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(query ? { query } : {}),
});
```

- [ ] **Step 5: Implement the Leaflet map**

Dynamic-import Leaflet and `leaflet/dist/leaflet.css`, use CARTO Voyager tiles,
render a marker and localized popup, show a map-only error, and clean up the map
instance on result change and unmount.

- [ ] **Step 6: Replace the placeholder route**

Import `IPCheckPage` in `src/App.tsx`. Keep the existing parser path but render the
real page when `toolPlaceholder === "ip-check"`.

- [ ] **Step 7: Run focused tests and type checks**

Run:

```bash
npx tsx --test backend/tests/ipCheckState.test.ts
npm run lint
npm run server:typecheck
```

Expected: PASS, or any unrelated pre-existing errors are recorded separately.

- [ ] **Step 8: Commit**

```bash
git add src/pages/ipCheck src/App.tsx src/index.css package.json package-lock.json \
  backend/tests/ipCheckState.test.ts
git commit -m "feat: add interactive GateRank IP check page"
```

### Task 6: Full local regression and production build

**Files:**
- Modify only files required by test-discovered defects in the IP-check scope.

- [ ] **Step 1: Run all focused tests**

Run:

```bash
npx tsx --test \
  backend/tests/ipCheckShared.test.ts \
  backend/tests/ipGeolocationService.test.ts \
  backend/tests/ipCheckState.test.ts \
  backend/tests/toolsRoutes.test.ts \
  backend/tests/publicPageRoutes.test.ts \
  backend/tests/newsPublicRoutes.test.ts \
  backend/tests/machineReadableRoutes.test.ts \
  backend/tests/nginxConfig.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full project verification**

Run:

```bash
npm run lint
npm run server:typecheck
npm run test:backend
npm run build
```

Expected: PASS. If an unrelated existing failure remains, preserve its exact output
and prove the focused IP-check suites pass.

- [ ] **Step 3: Verify built SSR locally**

Start the API with mock provider configuration or an injected test service and
verify:

```bash
curl -fsS http://127.0.0.1:8787/tools/ip-check
curl -i -X POST http://127.0.0.1:8787/api/v1/tools/ip-check \
  -H 'Content-Type: application/json' \
  -H 'CF-Connecting-IP: 8.8.8.8' \
  --data '{}'
```

Expected: SSR HTML contains the published IP-check shell; API response is private
and uses the shared contract.

- [ ] **Step 4: Commit focused corrections when verification required them**

Stage only the IP-check files already listed in Tasks 1 through 5 that were changed
to repair a verification failure, review `git diff --cached`, and commit with:

```bash
git commit -m "fix: harden GateRank IP check integration"
```

If verification required no code correction, mark this step complete without
creating an empty commit.

### Task 7: Production secret and GateRank deployment

**Files:**
- Production 1Panel Compose environment for `gaterank-api`

- [ ] **Step 1: Obtain and restrict the ip-api Pro Key**

Create the subscription Key and restrict it to the server egress IP. Do not paste
the Key into Git, shell history, logs, or user-visible output.

- [ ] **Step 2: Add the production environment variable**

Add `IP_API_PRO_KEY` to the `gaterank-api` environment through the managed 1Panel
Compose configuration. Also set timeout/rate variables only when overriding the
documented defaults.

- [ ] **Step 3: Push the verified GateRank commit**

Fetch/rebase safely without staging unrelated local changes, then push the approved
commit to `origin/main`.

- [ ] **Step 4: Deploy both GateRank images**

Wait for the GitHub image build to finish, then recreate `gaterank-web` and
`gaterank-api` through the existing production Compose. Do not restart unrelated
containers.

- [ ] **Step 5: Verify production**

Verify:

- `/tools/ip-check` SSR, desktop and 390px mobile layout;
- automatic current-IP lookup;
- `8.8.8.8`, `2001:4860:4860::8888`, and `example.com`;
- map, copy, languages, privacy copy, response headers and rate limit;
- `/`, `/rankings/all`, `/tools/streaming-check`, `/download`, `/api/v1`.

Expected: all checks pass before touching `ipcha.org`.

### Task 8: Retire ipcha.org with a rollback boundary

**Files:**
- Remote backup of `/opt/1panel/apps/ip-check/docker-compose.yml`
- Remote backup of `/opt/1panel/www/conf.d/ipcha.org.conf`
- Remote backup of `/opt/1panel/www/sites/ipcha.org/proxy/root.conf`
- Modify: `/opt/1panel/www/conf.d/ipcha.org.conf`

- [ ] **Step 1: Capture exact old-state evidence**

Record container ID/image digest, Git commit, Compose path, process command, health
state, ports and Nginx include path. Never print environment values.

- [ ] **Step 2: Create timestamped configuration backups**

Copy only the three explicit files above into a timestamped
`/opt/1panel/backups/ip-check-retirement-*` directory and record checksums.

- [ ] **Step 3: Stop the exact old container**

Run `docker stop ip-check` and verify:

- the container is stopped;
- no process listens on host port 3000;
- GateRank containers remain healthy.

- [ ] **Step 4: Replace the old vhost with 410**

Keep HTTP and HTTPS listeners, certificate paths and ACME handling, but replace the
application proxy with:

```nginx
location / {
    return 410;
}
```

Remove the old proxy include from the active request path. Validate OpenResty
configuration before a graceful reload.

- [ ] **Step 5: Verify retirement**

Run:

```bash
curl -sSIL http://ipcha.org/
curl -sSIL https://ipcha.org/
```

Expected: both end at `410 Gone`, with no `Location` pointing to GateRank.

Recheck GateRank IP check and adjacent routes. Keep old source, stopped container
metadata/image, certificate and backups for rollback.
