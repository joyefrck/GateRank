# Report Region Limit and Macau Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show up to 14 regions on airport report pages and classify Macau network coverage nodes as the `MO` extended region.

**Architecture:** Keep the API contract and existing capability-card layout unchanged. Update the React and SSR presentation limits together, and extend the centralized network coverage classifier so new runs persist Macau as a scored extended region.

**Tech Stack:** React, TypeScript, Node test runner through `tsx`, Vite.

---

### Task 1: Add failing report-region limit regressions

**Files:**
- Modify: `backend/tests/frontendReportPage.test.ts`
- Modify: `backend/tests/publicPageRoutes.test.ts`

- [ ] **Step 1: Add the React source contract test**

Append a test that isolates `ReportRegionGroup` and asserts both the slice limit and remaining-count arithmetic use 14:

```ts
test('React report node coverage shows at most fourteen regions', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/App.tsx'), 'utf8');
  const start = source.indexOf('function ReportRegionGroup');
  const end = source.indexOf('function formatReportRegionLabel', start);
  const regionGroupSource = source.slice(start, end);

  assert.match(regionGroupSource, /regions\.slice\(0, 14\)/);
  assert.match(regionGroupSource, /regions\.length > 14/);
  assert.match(regionGroupSource, /regions\.length - 14/);
});
```

- [ ] **Step 2: Add the SSR behavior test**

Create 15 unique report regions from the existing `reportView`, render it, and assert that region 14 is present, region 15 is absent, and the remaining count is one:

```ts
test('SSR report node coverage shows fourteen regions and summarizes the remainder', () => {
  const regions = Array.from({ length: 15 }, (_, index) => ({
    key: `region_${index + 1}`,
    label: `测试地区${index + 1}`,
    node_count: index + 1,
    line_types: [],
    has_residential: false,
    has_native_ip: false,
  }));
  const html = renderReportPublicPage('https://gate-rank.com', {
    ...reportView,
    capabilities: { ...reportView.capabilities, regions },
  });

  assert.match(html, /测试地区14 · 14 节点/);
  assert.doesNotMatch(html, /测试地区15 · 15 节点/);
  assert.match(html, /另有 1 个地区/);
});
```

- [ ] **Step 3: Run the focused tests and verify they fail**

Run: `npx tsx --test backend/tests/frontendReportPage.test.ts backend/tests/publicPageRoutes.test.ts`

Expected: failures showing that the current implementation still uses 5.

### Task 2: Add failing Macau classifier regressions

**Files:**
- Modify: `backend/tests/networkCoverageScoring.test.ts`

- [ ] **Step 1: Extend the classifier test**

Add these expectations to the existing classifier test:

```ts
  for (const name of ['澳门专线 01', '澳門 IPLC 02', 'Macau Premium', 'Macao-01', 'MO-01', '🇲🇴 澳门']) {
    assert.deepEqual(classifyNetworkCoverageRegion(name), {
      region_code: 'MO', region_name: '澳门', region_group: 'extended',
    });
  }
  assert.equal(classifyNetworkCoverageRegion('澳大利亚 Sydney 01').region_code, 'AU');
  assert.equal(classifyNetworkCoverageRegion('澳洲 01').region_code, 'AU');
```

- [ ] **Step 2: Run the focused classifier test and verify it fails**

Run: `npx tsx --test backend/tests/networkCoverageScoring.test.ts`

Expected: Macau inputs resolve to `UNKNOWN`, while the existing Australia cases remain `AU`.

### Task 3: Implement the minimal presentation and classifier changes

**Files:**
- Modify: `src/App.tsx`
- Modify: `backend/src/services/publicPageRenderer.ts`
- Modify: `backend/src/services/networkCoverageScoring.ts`

- [ ] **Step 1: Change the React report limit**

In `ReportRegionGroup`, replace all three occurrences of 5 used by the region list with 14:

```tsx
{regions.length > 0 ? regions.slice(0, 14).map((region) => (
```

```tsx
{regions.length > 14 ? <div className="mt-3 text-xs font-bold text-slate-400">另有 {regions.length - 14} 个地区</div> : null}
```

- [ ] **Step 2: Change the SSR report limit**

In `renderRegionGroup`, use 14 for the sliced list, threshold, and remaining count:

```ts
const regions = view.capabilities.regions.slice(0, 14);
```

```ts
${view.capabilities.regions.length > 14 ? `<div class="capability-footnote">另有 ${view.capabilities.regions.length - 14} 个地区</div>` : ''}
```

- [ ] **Step 3: Add Macau to the centralized region definitions**

Insert Macau next to Taiwan among extended regions:

```ts
{ code: 'MO', name: '澳门', group: 'extended', aliases: ['mo', 'macau', 'macao', '澳门', '澳門', '🇲🇴'] },
```

- [ ] **Step 4: Run all focused regressions and verify they pass**

Run: `npx tsx --test backend/tests/frontendReportPage.test.ts backend/tests/publicPageRoutes.test.ts backend/tests/networkCoverageScoring.test.ts`

Expected: all tests pass with zero failures.

- [ ] **Step 5: Commit the intended source and tests**

```bash
git add src/App.tsx backend/src/services/publicPageRenderer.ts backend/src/services/networkCoverageScoring.ts backend/tests/frontendReportPage.test.ts backend/tests/publicPageRoutes.test.ts backend/tests/networkCoverageScoring.test.ts docs/superpowers/plans/2026-08-17-report-region-limit-and-macau-coverage.md
git commit -m "fix: expand report regions and recognize Macau"
```

### Task 4: Verify the complete change

**Files:**
- Verify only; do not stage generated build output.

- [ ] **Step 1: Run the complete backend suite**

Run: `npm run test:backend`

Expected: zero failed tests.

- [ ] **Step 2: Run type checks and lint**

Run: `npm run server:typecheck`

Expected: exit code 0.

Run: `npm run lint`

Expected: exit code 0.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Vite exits with code 0. Generated `dist` and Vite metadata remain unstaged.

- [ ] **Step 4: Check patch hygiene**

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 5: Verify desktop and mobile in a real browser**

Serve the local application using the repository's existing development command, open an airport report containing at least 14 configured regions, and verify:

- desktop keeps the existing five-column capability layout;
- mobile keeps a single readable column without horizontal overflow;
- the first 14 regions appear in the original order;
- only counts beyond 14 appear in the footnote.

- [ ] **Step 6: Confirm only intended files are committed**

Run: `git status --short --branch`

Expected: the feature source/tests/docs are committed; pre-existing `dist`, Vite metadata, and `scripts/__pycache__` residue may remain modified or untracked but are not staged.
