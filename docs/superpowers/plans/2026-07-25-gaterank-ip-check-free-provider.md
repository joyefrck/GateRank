# GateRank IP Check Free Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the blocked ip-api Pro integration with the commercially usable free `ipwho.is` endpoint while preserving GateRank's existing IP-check response and UI.

**Architecture:** Keep `/api/v1/tools/ip-check` as the only browser-facing lookup endpoint. Replace the provider-specific backend mapping and add a bounded in-memory TTL cache so repeated lookups do not consume the shared 1,000-request daily allowance; keep the public response uncached and update all provider/privacy copy.

**Tech Stack:** TypeScript 5.8, Express 4, Node test runner, React 19, Docker, 1Panel OpenResty

---

### Task 1: Replace the provider adapter and add bounded caching

**Files:**
- Modify: `backend/src/services/ipGeolocationService.ts`
- Modify: `backend/tests/ipGeolocationService.test.ts`

- [ ] **Step 1: Replace provider fixtures with failing ipwho.is tests**

Update the successful fixture to the nested ipwho.is response and add cache and
quota tests:

```ts
const payload = {
  ip: '8.8.8.8',
  success: true,
  country: 'United States',
  country_code: 'US',
  region: 'Virginia',
  region_code: 'VA',
  city: 'Ashburn',
  latitude: 39.03,
  longitude: -77.5,
  postal: '20149',
  connection: {
    asn: 15169,
    org: 'Google LLC',
    isp: 'Google LLC',
  },
  timezone: { id: 'America/New_York' },
};
```

Assert that two `lookup('8.8.8.8')` calls invoke `fetchImpl` once, that a 429
response becomes `IP_CHECK_RATE_LIMITED`, and that `success: false` becomes
`IP_CHECK_LOOKUP_FAILED`. Remove the missing-Key expectation.

- [ ] **Step 2: Run the provider tests and verify failure**

Run:

```bash
npx tsx --test backend/tests/ipGeolocationService.test.ts
```

Expected: FAIL because the current adapter still requires `IP_API_PRO_KEY` and
expects flat ip-api Pro fields.

- [ ] **Step 3: Implement the free provider mapping and TTL cache**

Use the following provider options and cache entry:

```ts
interface IpGeolocationServiceOptions {
  baseUrl?: string;
  timeoutMs?: number;
  cacheTtlMs?: number;
  cacheMaxEntries?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

interface CacheEntry {
  expiresAt: number;
  result: IpCheckResult;
}
```

Set defaults to:

```ts
baseUrl = 'https://ipwho.is';
timeoutMs = 5000;
cacheTtlMs = 86_400_000;
cacheMaxEntries = 2000;
```

Build `new URL('/' + encodeURIComponent(query), baseUrl)`. Before calling the
upstream, return a non-expired cached result. After mapping a successful result,
evict the oldest `Map` key while `size >= cacheMaxEntries`, then store the result.
Do not cache errors.

Map nested `connection` and `timezone` fields. Normalize numeric ASN values as
`AS15169`; leave missing optional strings empty. Require a non-empty `ip` and
finite coordinates.

- [ ] **Step 4: Run provider and route tests**

Run:

```bash
npx tsx --test backend/tests/ipGeolocationService.test.ts backend/tests/toolsRoutes.test.ts
```

Expected: PASS with no network calls.

- [ ] **Step 5: Commit the adapter**

```bash
git add backend/src/services/ipGeolocationService.ts backend/tests/ipGeolocationService.test.ts
git commit -m "feat: use free IP geolocation provider"
```

### Task 2: Update source attribution and privacy copy

**Files:**
- Modify: `shared/ipCheck.ts`
- Modify: `backend/src/services/publicPageRenderer.ts`
- Modify: `backend/tests/publicPageRoutes.test.ts`

- [ ] **Step 1: Add failing copy assertions**

Assert that the SSR IP-check page contains `ipwho.is` and does not contain
`ip-api Pro`. Update the shared translation assertions to require:

```text
IP 数据由 ipwho.is 提供
结果会在 API 进程内存中临时缓存最多 24 小时
```

and equivalent English copy.

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
npx tsx --test backend/tests/publicPageRoutes.test.ts backend/tests/ipCheckShared.test.ts
```

Expected: FAIL because the published copy still names ip-api Pro.

- [ ] **Step 3: Update Chinese, English, and SSR copy**

Set the data-source copy to credit `ipwho.is`, OpenStreetMap, and CARTO. State
that GateRank does not persist query history, but temporarily caches successful
results in API process memory for up to 24 hours to conserve the free quota, and
that ipwho.is processes the lookup target under its own policies.

- [ ] **Step 4: Run focused copy tests**

Run:

```bash
npx tsx --test backend/tests/publicPageRoutes.test.ts backend/tests/ipCheckShared.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the copy**

```bash
git add shared/ipCheck.ts backend/src/services/publicPageRenderer.ts backend/tests/publicPageRoutes.test.ts
git commit -m "fix: disclose free IP data provider"
```

### Task 3: Verify, publish, deploy, and retire the old site

**Files:**
- Generated/modified: `dist/**`
- Remote: `/opt/1panel/docker/compose/gaterank`
- Remote: `/opt/1panel/www/conf.d/ipcha.org.conf`
- Remote: `/opt/1panel/www/sites/ipcha.org/proxy/root.conf`

- [ ] **Step 1: Run fresh local verification**

Run:

```bash
npm run test:backend
npm run lint
npm run build
npm run server:typecheck
git diff --check
```

Expected: backend tests, lint, and build pass. If `server:typecheck` fails, compare
the exact diagnostics with commit `3bce4ffb` and report only pre-existing debt.

- [ ] **Step 2: Perform a live upstream smoke test**

Run through the service or a one-off HTTPS request for `8.8.8.8`; verify HTTP 200,
`success: true`, finite coordinates, city, timezone, ISP, organization, and ASN.
Do not print visitor IP data or persist the response.

- [ ] **Step 3: Push `main` and wait for image publication**

```bash
git push origin main
```

Confirm the GitHub Actions image workflow completes successfully before touching
running containers.

- [ ] **Step 4: Deploy only GateRank services**

On the production host:

```bash
cd /opt/1panel/docker/compose/gaterank
docker compose pull gaterank-web gaterank-api
docker compose up -d --no-deps gaterank-api gaterank-web
docker compose ps
```

Verify container health and confirm the running image IDs match the newly pulled
images. No API Key environment change is required.

- [ ] **Step 5: Verify GateRank production behavior**

Verify:

```text
GET  https://gate-rank.com/tools/ip-check
POST https://gate-rank.com/api/v1/tools/ip-check
```

Check current-IP lookup, `8.8.8.8`, one public IPv6 address, and one domain.
Confirm the map, copy controls, language switch, attribution, privacy text,
`Cache-Control: private, no-store`, and regression routes.

- [ ] **Step 6: Back up and retire the old site**

Only after Step 5 succeeds, back up the old compose and OpenResty files with a
timestamped suffix, stop the exact `ip-check` container, and confirm port 3000 is
no longer listening.

Replace the `ipcha.org` HTTP and HTTPS application handlers with:

```nginx
return 410;
```

Validate the OpenResty configuration and perform a graceful reload.

- [ ] **Step 7: Verify final production state**

Verify both `http://ipcha.org/` and `https://ipcha.org/` return 410 without a
`Location` header. Recheck GateRank IP lookup, homepage, streaming check, and
public API health. Keep old source, image, certificates, and timestamped
configuration backups for rollback.

