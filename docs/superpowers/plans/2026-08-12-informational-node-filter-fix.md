# Informational Node Filter Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent real nodes whose names contain “套餐” from being removed from report coverage and automatic performance sampling while continuing to exclude subscription information rows.

**Architecture:** Keep the existing shared `isInformationalNodeName` boundary and narrow only its phrase matching. Exercise each affected consumer through public report and dispatch service tests, plus the network coverage classifier test.

**Tech Stack:** TypeScript, Node.js test runner, tsx, Vite

---

### Task 1: Add regression coverage

**Files:**
- Modify: `backend/tests/publicViewService.test.ts`
- Modify: `backend/tests/performanceProbeDispatchService.test.ts`
- Modify: `backend/tests/networkCoverageScoring.test.ts`

- [ ] **Step 1: Add the report regression fixture**

Add `{ name: '韩国-标准套餐01', region: 'KR', ... }` to the report snapshot and assert the resulting capabilities include `['south_korea', '韩国', 1, []]` while the existing UK informational row remains excluded.

- [ ] **Step 2: Add the performance selection regression**

Create a dispatch fixture without stored preferences that contains a Korean package node and a subscription information row. Assert only the real regional nodes are selected.

- [ ] **Step 3: Add classifier regression assertions**

Assert `classifyNetworkCoverageRegion('韩国-标准套餐01')` returns `KR` and `classifyNetworkCoverageRegion('套餐到期：长期有效 UK')` remains `UNKNOWN`.

- [ ] **Step 4: Run tests to verify the regression fails**

Run: `npx tsx --test backend/tests/publicViewService.test.ts backend/tests/performanceProbeDispatchService.test.ts backend/tests/networkCoverageScoring.test.ts`

Expected: assertions involving the Korean package node fail under the broad “套餐” matcher.

### Task 2: Narrow the shared filter

**Files:**
- Modify: `backend/src/utils/informationalNode.ts`

- [ ] **Step 1: Replace the broad package keyword**

Change the pattern from independent `套餐` matching to explicit `套餐到期` matching while retaining every other informational keyword.

- [ ] **Step 2: Run focused tests**

Run: `npx tsx --test backend/tests/publicViewService.test.ts backend/tests/performanceProbeDispatchService.test.ts backend/tests/networkCoverageScoring.test.ts`

Expected: all focused tests pass.

### Task 3: Verify and publish

**Files:**
- Verify only the intended source, tests, specification, and plan are staged.

- [ ] **Step 1: Run release checks**

Run `npm run test:backend`, `npm run server:typecheck`, `npm run lint`, `npm run build`, and `git diff --check`; all must exit 0.

- [ ] **Step 2: Commit and push current main**

Stage only the intended files, commit the fix, push `main`, and confirm local and remote SHA match.

- [ ] **Step 3: Deploy and verify production**

Wait for the production image workflow, update the API/web containers using the repository deployment procedure, then verify the public report API returns Korea with five nodes and the public report renders 韩国.
