# Remove Report Network Coverage Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the public report's network coverage summary block while retaining the N score card, five-axis radar, API data, and admin diagnostics.

**Architecture:** Delete only the duplicated presentation block from the React report component and SSR renderer. Keep `ReportView.network_coverage` unchanged so scoring, SEO data, and non-public consumers retain the full network coverage result.

**Tech Stack:** React, TypeScript, Node test runner, GateRank SSR renderer, Vite.

---

### Task 1: Lock the React and SSR behavior with regression tests

**Files:**
- Modify: `backend/tests/frontendReportPage.test.ts`
- Modify: `backend/tests/publicPageRoutes.test.ts`

- [ ] **Step 1: Change the React source regression to reject the summary block**

Replace assertions requiring `data.network_coverage`, `Healthy / Detected`, `UNKNOWN`, and `unsupported` with negative assertions while keeping the N score assertion:

```ts
assert.match(breakdownSource, /label: '网络覆盖 \(N\)'/);
assert.doesNotMatch(breakdownSource, /网络覆盖快照|Healthy \/ Detected|UNKNOWN|unsupported/);
```

- [ ] **Step 2: Change the SSR v2 regression to reject the summary block**

Keep the five-axis and N-card assertions, then require the removed content to be absent:

```ts
assert.match(v2Html, /本报告五维评分分布/);
assert.match(v2Html, /网络覆盖 \(N\)/);
assert.doesNotMatch(v2Html, /网络覆盖快照|Healthy \/ Detected|UNKNOWN|unsupported/);
```

- [ ] **Step 3: Run the focused tests and verify they fail before implementation**

Run:

```bash
npx tsx --test backend/tests/frontendReportPage.test.ts backend/tests/publicPageRoutes.test.ts
```

Expected: the new negative assertions fail because React and SSR still render the summary.

### Task 2: Remove the duplicated React and SSR presentation

**Files:**
- Modify: `src/App.tsx`
- Modify: `backend/src/services/publicPageRenderer.ts`

- [ ] **Step 1: Remove the React summary and its private helper**

Delete the conditional `data.network_coverage` block from `ReportScoreBreakdown` and delete `ReportCoverageDatum`. Leave the score array's conditional N entry unchanged.

- [ ] **Step 2: Remove the SSR summary call and renderer**

Delete the `renderNetworkCoverageSummary(view)` insertion from the report markup and delete the `renderNetworkCoverageSummary` function. Leave `renderReportScoreBreakdown` and the five-axis radar unchanged.

- [ ] **Step 3: Remove now-unused SSR styles**

Delete only selectors dedicated to `.network-coverage-summary`; retain shared `.metric-grid` and `.info-card` rules used elsewhere.

- [ ] **Step 4: Run focused tests and verify they pass**

Run:

```bash
npx tsx --test backend/tests/frontendReportPage.test.ts backend/tests/publicPageRoutes.test.ts
```

Expected: all focused tests pass.

### Task 3: Verify type safety and production output

**Files:**
- Verify: `src/App.tsx`
- Verify: `backend/src/services/publicPageRenderer.ts`

- [ ] **Step 1: Run both TypeScript checks**

```bash
npm run server:typecheck
npm run lint
```

Expected: both commands exit 0.

- [ ] **Step 2: Run the production build**

```bash
npm run build
```

Expected: Vite completes successfully.

- [ ] **Step 3: Check patch integrity**

```bash
git diff --check
```

Expected: command exits 0.
