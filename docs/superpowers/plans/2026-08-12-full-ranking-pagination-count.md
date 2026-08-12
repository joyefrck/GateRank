# Full Ranking Pagination Count Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore all-airport pagination on `/rankings/all` by making V2 count metadata cover the same listed airports as the result rows.

**Architecture:** Keep the existing full-ranking item query, score join, ordering, SSR page size, and React page size unchanged. Remove only the V2 score-participation predicate from the count query, and lock the all-airport V2 behavior with a repository regression test.

**Tech Stack:** TypeScript, Node.js test runner, MySQL repository SQL, React SSR/API views

---

### Task 1: Add the V2 pagination regression test

**Files:**
- Modify: `backend/tests/scoreRepository.test.ts:117-141`

- [ ] **Step 1: Replace the incorrect V2 count test**

Replace the test that expects missing same-day V2 scores to be excluded with a test that returns `61` from the count query and verifies that the count SQL has no score-participation `EXISTS` predicate, while the item query still restricts joined scores to the requested date and V2 rule.

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npx tsx --test backend/tests/scoreRepository.test.ts
```

Expected: failure because the count SQL still contains `EXISTS` and passes date/rule parameters.

### Task 2: Make count and item populations consistent

**Files:**
- Modify: `backend/src/repositories/scoreRepository.ts:438-460`
- Test: `backend/tests/scoreRepository.test.ts`

- [ ] **Step 1: Remove the V2 count-only predicate**

Delete `v2ParticipationSql` and query the count with `rankingFilters.params` only. Preserve `isV2` and `versionExpression` for the score subquery, so only same-day V2 scores are displayed.

- [ ] **Step 2: Run the focused test and verify it passes**

Run:

```bash
npx tsx --test backend/tests/scoreRepository.test.ts
```

Expected: all score repository tests pass.

### Task 3: Verify public ranking behavior

**Files:**
- Test: `backend/tests/publicViewService.test.ts`
- Test: `backend/tests/publicPageRoutes.test.ts`
- Test: `backend/tests/publicRoutes.test.ts`

- [ ] **Step 1: Run public ranking regression tests**

Run:

```bash
npx tsx --test backend/tests/publicViewService.test.ts backend/tests/publicPageRoutes.test.ts backend/tests/publicRoutes.test.ts
```

Expected: all selected tests pass, including the split 100-item SSR and 20-item hydration behavior.

- [ ] **Step 2: Run backend tests and build**

Run:

```bash
npm run test:backend
npm run build
```

Expected: both commands exit successfully.

- [ ] **Step 3: Commit only intended files**

Stage `backend/src/repositories/scoreRepository.ts`, `backend/tests/scoreRepository.test.ts`, and this plan. Do not stage generated Vite or Python cache files.

### Task 4: Publish and verify production

**Files:**
- No source changes

- [ ] **Step 1: Push the current `main` commit**

Push only after focused tests, backend tests, and build pass.

- [ ] **Step 2: Deploy the updated API image through the existing GateRank production workflow**

Wait for the image publication to complete, refresh the API service, and preserve the existing database and web service.

- [ ] **Step 3: Verify live API pagination**

Query pages 1 through 4 with `page_size=20`. Expected metadata is `total=61`, `total_pages=4`; expected item counts are `20`, `20`, `20`, and `1`.

- [ ] **Step 4: Verify the public UI**

Open `/rankings/all` and confirm the pagination shows four pages and the next-page control navigates to ranks 21-40.
