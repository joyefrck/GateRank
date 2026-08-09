# Performance Run Node Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render every performance run's own tested nodes inside its regional evidence panel and remove the misleading global latest-run node section.

**Architecture:** Keep the existing dashboard API response unchanged because each `probe_runs` entry already contains `tested_nodes`. Extend the frontend type, render the existing node field layout from `run.tested_nodes` inside each `<details>`, and remove the detached rendering sourced from `dashboard.performance.tested_nodes`.

**Tech Stack:** React 19, TypeScript, Node test runner, Vite, Tailwind CSS

---

### Task 1: Lock the desired rendering behavior with a regression test

**Files:**
- Modify: `backend/tests/adminPerformanceProbeUi.test.ts`

- [ ] **Step 1: Add failing source assertions**

Assert that the source maps `run.tested_nodes` inside the per-run panel, contains the `本次运行节点明细` heading, and no longer maps `dashboard.performance.tested_nodes`.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npx tsx --test backend/tests/adminPerformanceProbeUi.test.ts`

Expected: FAIL because the current UI still renders the global node list and does not render per-run nodes.

### Task 2: Render nodes in the matching performance run

**Files:**
- Modify: `src/admin/AdminApp.tsx`

- [ ] **Step 1: Extend the `probe_runs` item type**

Add the existing tested-node shape as `tested_nodes` on each run item. Reuse the same optional fields already defined on the top-level performance payload.

- [ ] **Step 2: Add the per-run node subsection**

Inside each expanded run panel, conditionally render `本次运行节点明细` and map `run.tested_nodes`. Reuse `ReadField`, the current responsive two-column grid, existing neutral surfaces, and the same diagnostic fields.

- [ ] **Step 3: Delete the detached global node section**

Remove the block that maps `dashboard.performance.tested_nodes` below the regional evidence list.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npx tsx --test backend/tests/adminPerformanceProbeUi.test.ts`

Expected: 1 test passes, 0 failures.

### Task 3: Verify and publish

**Files:**
- Generated: `dist/assets/AdminApp.js`

- [ ] **Step 1: Run frontend and backend validation**

Run: `npm run lint`

Run: `npm run server:typecheck`

Run: `npm run test:backend`

Expected: every command exits 0 with no failed tests.

- [ ] **Step 2: Build production assets**

Run: `npm run build`

Expected: Vite build exits 0 and regenerates `dist/assets/AdminApp.js`.

- [ ] **Step 3: Inspect scope and commit**

Confirm only the design/plan, focused test, `AdminApp.tsx`, and generated admin asset are included; preserve the unrelated Python bytecode change.

- [ ] **Step 4: Push `main`, wait for the image workflow, and deploy paired services**

Push the implementation commit, verify the `Publish Docker Images` workflow succeeds for that SHA, then pull and recreate `gaterank-api` and `gaterank-web` together.

- [ ] **Step 5: Perform production browser acceptance**

Open 大象网络 performance evidence and verify Shanghai, Guangzhou, and legacy-control each display their own `本次运行节点明细`, while the detached bottom `节点明细` section is absent.
