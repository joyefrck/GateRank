# Homepage Ranking Billing and Impressions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Charge homepage ranking website clicks through the existing outbound billing route and record separate impressions for the main ranking and all four homepage summary boards.

**Architecture:** Keep billing and analytics on their established paths: the website anchor navigates through `/api/v1/outbound/airports/:id`, while the click handler writes the marketing event. Add component-local impression hooks with module-specific dedupe keys so repeated airports count once per visible placement without changing backend schemas or placement enums.

**Tech Stack:** React, TypeScript, Express, Node test runner, Vite, Docker Compose, GitHub Actions/GHCR

---

### Task 1: Add failing homepage source-contract tests

**Files:**
- Modify: `backend/tests/frontendCrawlableLinks.test.ts:166-205`
- Test: `backend/tests/frontendCrawlableLinks.test.ts`

- [ ] **Step 1: Capture the main ranking and summary item source blocks**

Add these slices beside the existing `rankingTableRowSource`:

```ts
const summaryBoardItemSource = source.slice(
  source.indexOf('function SummaryBoardItem'),
  source.indexOf('function SummaryRank'),
);
```

- [ ] **Step 2: Add billing and impression assertions**

Add assertions requiring the billing href, retained click analytics, main ranking impression key, summary impression key, and the absence of the direct ranking website href:

```ts
assert.match(rankingTableRowSource, /const websiteHref = buildHomepageWebsiteHref\(item\.airport_id\)/);
assert.match(rankingTableRowSource, /href=\{websiteHref\}/);
assert.match(rankingTableRowSource, /createTrackedOutboundClickHandler\(\{[\s\S]*pageKind: 'home',[\s\S]*placement: 'home_card',[\s\S]*targetUrl: item\.website/);
assert.match(rankingTableRowSource, /dedupeKey: `home\|ranking\|\$\{item\.airport_id\}`/);
assert.doesNotMatch(rankingTableRowSource, /href=\{item\.website\}/);
assert.match(summaryBoardItemSource, /useMarketingImpression\(\{/);
assert.match(summaryBoardItemSource, /dedupeKey: `home\|summary\|\$\{sectionKey\}\|\$\{item\.airport_id\}`/);
assert.match(summaryBoardItemSource, /<li ref=\{ref\}>/);
```

- [ ] **Step 3: Run the focused test and verify the red state**

Run:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts
```

Expected: the homepage test fails because `RankingTableRow` still uses `href={item.website}` and `SummaryBoardItem` does not exist.

### Task 2: Route ranking clicks through billing and add per-placement impressions

**Files:**
- Modify: `src/pages/home/HomePageV3.tsx:459-790`
- Test: `backend/tests/frontendCrawlableLinks.test.ts`

- [ ] **Step 1: Add the homepage billing href helper**

Add a small local helper near the other URL helpers:

```ts
function buildHomepageWebsiteHref(airportId: number): string {
  return `/api/v1/outbound/airports/${airportId}?target=website&placement=home_card`;
}
```

- [ ] **Step 2: Add main ranking impression and billing behavior**

At the top of `RankingTableRow`, create a row ref and billing href, then register the impression:

```ts
const ref = useRef<HTMLTableRowElement>(null);
const websiteHref = buildHomepageWebsiteHref(item.airport_id);
useMarketingImpression({
  airportId: item.airport_id,
  pageKind: 'home',
  placement: 'home_card',
  dedupeKey: `home|ranking|${item.airport_id}`,
  ref,
});
```

Attach `ref={ref}` to `motion.tr`. Replace the direct website anchor with:

```tsx
<a
  href={websiteHref}
  target="_blank"
  rel="nofollow noreferrer noopener"
  onClick={createTrackedOutboundClickHandler({
    airportId: item.airport_id,
    pageKind: 'home',
    placement: 'home_card',
    targetKind: 'website',
    targetUrl: item.website,
  })}
  className="flex w-full items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1 text-center text-[12px] font-bold leading-relaxed text-gray-700 shadow-sm hover:bg-gray-50"
>
  官网 <ExternalLink className="h-3 w-3 text-gray-400" />
</a>
```

- [ ] **Step 3: Extract the summary item into a hook-safe component**

Replace the inline summary `<li>` with:

```tsx
<SummaryBoardItem
  key={item.airport_id}
  item={item}
  index={index}
  sectionKey={config.key}
  risk={config.risk}
/>
```

Create `SummaryBoardItem` before `SummaryRank`:

```tsx
function SummaryBoardItem({
  item,
  index,
  sectionKey,
  risk = false,
}: {
  item: HomeCardItem;
  index: number;
  sectionKey: Exclude<HomeSectionKey, 'today_pick'>;
  risk?: boolean;
}) {
  const ref = useRef<HTMLLIElement>(null);
  useMarketingImpression({
    airportId: item.airport_id,
    pageKind: 'home',
    placement: 'home_card',
    dedupeKey: `home|summary|${sectionKey}|${item.airport_id}`,
    ref,
  });

  return (
    <li ref={ref}>
      <RouteLink href={item.report_url} className={`group/item flex items-center justify-between gap-2.5 rounded-xl border border-transparent p-2 transition-all ${risk ? 'bg-rose-50/30 hover:border-rose-200 hover:bg-rose-50/70' : 'bg-gray-50/60 hover:border-gray-200 hover:bg-white hover:shadow-sm'}`}>
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
          <SummaryRank index={index} risk={risk} />
          <AirportMark name={item.name} compact />
          <span className="min-w-0">
            <strong className="block truncate text-[13.5px] font-black text-gray-800">{item.name}</strong>
            <span className={`block truncate text-[10.5px] font-medium ${risk ? 'text-rose-500/90' : 'text-gray-400'}`}>{item.details?.[0]?.value || item.conclusion}</span>
          </span>
        </span>
        {risk ? (
          <span className="shrink-0 rounded-lg bg-rose-600 px-2 py-0.5 text-[10.5px] font-extrabold text-white">风险</span>
        ) : (
          <span className="flex shrink-0 items-center gap-1 rounded-lg border border-amber-200/60 bg-amber-50 px-2 py-0.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /><span className="font-mono text-[12px] font-extrabold text-amber-800">{scoreLabel(item.score, item.score_hidden)}</span></span>
        )}
      </RouteLink>
    </li>
  );
}
```

- [ ] **Step 4: Run the focused test and verify green**

Run:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts
```

Expected: all tests in the file pass.

### Task 3: Verify billing, analytics, and build integrity

**Files:**
- Verify: `src/pages/home/HomePageV3.tsx`
- Verify: `backend/src/routes/outboundRoutes.ts`
- Verify: `backend/src/repositories/applicantBillingRepository.ts`

- [ ] **Step 1: Run focused analytics and billing tests**

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts backend/tests/marketingPageKinds.test.ts backend/tests/publicRoutes.test.ts backend/tests/marketingEventRepository.test.ts backend/tests/outboundRoutes.test.ts backend/tests/applicantBillingRepository.test.ts
```

Expected: zero failed tests.

- [ ] **Step 2: Run static checks and production build**

```bash
npm run lint
npm run server:typecheck
npm run build
git diff --check
```

Expected: all commands exit 0. If an existing baseline failure appears, compare it with `HEAD` before attributing it to this change.

- [ ] **Step 3: Run the complete backend suite**

```bash
npm run test:backend
```

Expected: zero failed tests.

- [ ] **Step 4: Commit the implementation**

```bash
git add src/pages/home/HomePageV3.tsx backend/tests/frontendCrawlableLinks.test.ts docs/superpowers/plans/2026-08-01-home-ranking-billing-and-impressions.md
git commit -m "fix: bill homepage ranking clicks and track impressions"
```

### Task 4: Publish and deploy production

**Files:**
- Verify: `.github/workflows/docker-publish.yml`
- Remote Compose: `/opt/1panel/docker/compose/gaterank`

- [ ] **Step 1: Push the verified `main` commit**

```bash
git push origin main
```

Expected: remote `main` advances to the implementation commit.

- [ ] **Step 2: Wait for Docker image publication**

Use `gh run list` and `gh run watch` for the `Publish Docker Images` workflow.

Expected: the workflow for the implementation commit completes successfully and publishes both `gaterank-web:main` and `gaterank-api:main`.

- [ ] **Step 3: Pull and replace the aligned production services**

On the authorized production host:

```bash
cd /opt/1panel/docker/compose/gaterank
docker compose pull gaterank-web gaterank-api
docker compose up -d --no-deps gaterank-api gaterank-web
```

Expected: both services are recreated from the new images and report running/healthy status.

- [ ] **Step 4: Perform read-only production acceptance**

Verify container image IDs and status, `/healthz`, `/api/v1/pages/home`, and the public homepage. Inspect the rendered ranking website anchor and deployed JS for:

```text
/api/v1/outbound/airports/<id>?target=website&placement=home_card
home|ranking|
home|summary|
```

Expected: the homepage returns 200, the API returns 200, ranking website links use the billing route, and both impression keys exist. Do not click a real website link during acceptance.
