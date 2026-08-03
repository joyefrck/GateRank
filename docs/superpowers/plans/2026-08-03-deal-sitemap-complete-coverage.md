# Deal Sitemap Complete Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Include every public airport with a deal campaign in `/sitemap.xml`, even when the airport is absent from the first 100 ranking report entries.

**Architecture:** Build one slug-keyed map from report entries, then merge campaign sitemap updates into the same map. Campaign-only slugs create new `/deals/:slug` entries, overlapping slugs remain unique, and `lastmod` is the newer timestamp from either source.

**Tech Stack:** TypeScript, Express, Node test runner, XML sitemap generation

---

### Task 1: Add a failing campaign-only sitemap regression

**Files:**
- Modify: `backend/tests/newsPublicRoutes.test.ts:1082-1138`
- Test: `backend/tests/newsPublicRoutes.test.ts`

- [ ] **Step 1: Change the second campaign update into a public campaign-only airport**

Use this fixture:

```ts
airportAdCampaignRepository: {
  listDealSitemapUpdates: async () => [
    { airport_slug: 'nebula', updated_at: '2026-04-05T12:30:00+08:00' },
    { airport_slug: 'campaign-only', updated_at: '2026-04-06T12:30:00+08:00' },
  ],
},
```

- [ ] **Step 2: Require the extra URL, its timestamp, and deduplication**

Update and add assertions:

```ts
assert.equal(urlBlocks.length, 69);
assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/deals\/campaign-only<\/loc>\n    <lastmod>2026-04-06T12:30:00\+08:00<\/lastmod>/);
assert.equal(xml.match(/\/deals\/nebula<\/loc>/g)?.length, 1);
```

- [ ] **Step 3: Run the focused test and confirm failure**

Run:

```bash
npx tsx --test backend/tests/newsPublicRoutes.test.ts
```

Expected: FAIL because `campaign-only` is not present and the URL count remains 68.

### Task 2: Merge campaign slugs into deal sitemap entries

**Files:**
- Modify: `backend/src/routes/newsPublicRoutes.ts:276-300`
- Test: `backend/tests/newsPublicRoutes.test.ts`

- [ ] **Step 1: Replace report-only construction with a two-source merge**

Use the following implementation after `updateBySlug` is populated:

```ts
const entries = new Map<string, { path: string; lastmod: string }>();
reportEntries.forEach((report) => {
  const match = report.path.match(/^\/airports\/([^/?#]+)$/);
  if (!match) return;
  const slug = match[1];
  entries.set(slug, { path: buildAirportDealDetailPath(slug), lastmod: report.lastmod });
});
updateBySlug.forEach((campaignLastmod, slug) => {
  const existing = entries.get(slug);
  const lastmod = existing && existing.lastmod > campaignLastmod
    ? existing.lastmod
    : campaignLastmod;
  entries.set(slug, { path: buildAirportDealDetailPath(slug), lastmod });
});
return [...entries.values()];
```

- [ ] **Step 2: Run focused tests and server type checking**

Run:

```bash
npx tsx --test backend/tests/newsPublicRoutes.test.ts backend/tests/publicPageRoutes.test.ts
npm run server:typecheck
```

Expected: all focused tests pass and backend TypeScript exits 0.

- [ ] **Step 3: Commit the implementation**

```bash
git add backend/src/routes/newsPublicRoutes.ts backend/tests/newsPublicRoutes.test.ts
git commit -m "fix: include all deal pages in sitemap"
```

### Task 3: Verify the full backend and generated sitemap contract

**Files:**
- Verify: `backend/src/routes/newsPublicRoutes.ts`
- Verify: `backend/tests/newsPublicRoutes.test.ts`

- [ ] **Step 1: Run the complete backend test suite**

Run:

```bash
npm run test:backend
```

Expected: all backend tests pass.

- [ ] **Step 2: Run remaining build checks**

Run:

```bash
npm run lint
npm run build
git diff --check
git status --short --branch
```

Expected: frontend type checking and build exit 0, no generated files change, and the working tree is clean.
