# System-Authoritative Node Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent applicants from declaring node coverage and make system subscription snapshots the sole authority for public region presence and collection inputs.

**Architecture:** Preserve administrator-owned `profile.regions` at both portal persistence boundaries, remove the applicant coverage controls, and require a positive region count from the latest system node snapshot before public capability output includes a region. Keep the existing Network Coverage and performance collectors on their current stored-snapshot and administrator-selection paths, with regressions proving those boundaries.

**Tech Stack:** TypeScript, Express, React, Node test runner, Python unittest, Vite.

---

## File Structure

- Modify `backend/src/routes/portalRoutes.ts`: preserve protected regions when applicant operations update application and approved airport records.
- Modify `src/App.tsx`: remove the applicant Node Coverage tab/editor and omit regions from the operations request profile.
- Modify `backend/src/services/publicViewService.ts`: require positive system snapshot node counts for public region presence.
- Modify `backend/tests/portalRoutes.test.ts`: cover fabricated applicant regions at both persistence boundaries.
- Modify `backend/tests/publicViewService.test.ts`: cover profile-only regions and system-snapshot filtering.
- Create `backend/tests/portalNodeCoverageUi.test.ts`: assert the applicant editor exposes no coverage entry or region payload.
- Reuse `scripts/test_monitor_network_coverage.py`, `scripts/test_monitor_performance.py`, and backend performance dispatch tests for collection-boundary verification.

### Task 1: Protect portal region ownership

**Files:**
- Modify: `backend/tests/portalRoutes.test.ts`
- Modify: `backend/src/routes/portalRoutes.ts`

- [ ] **Step 1: Write the failing regression**

Extend the approved-airport operations test with distinct application, approved-airport, and fabricated request regions. Assert that permitted profile fields update while application regions remain application-owned and approved-airport regions remain administrator-owned.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npx tsx --test backend/tests/portalRoutes.test.ts`

Expected: the new region-preservation assertions fail because the complete applicant profile currently replaces both records.

- [ ] **Step 3: Implement protected-region merging**

After parsing the applicant profile, replace its `regions` with normalized existing application regions before repository persistence. During approved-airport synchronization, merge permitted applicant profile fields with normalized `airport.profile.regions` so the portal patch cannot overwrite administrator values.

- [ ] **Step 4: Run the focused test**

Run: `npx tsx --test backend/tests/portalRoutes.test.ts`

Expected: all portal route tests pass.

### Task 2: Remove applicant coverage controls and payload

**Files:**
- Create: `backend/tests/portalNodeCoverageUi.test.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the failing UI source regression**

Read the applicant portal section from `src/App.tsx` and assert that `PORTAL_PROFILE_TABS` has no `nodes` entry, there is no `applicationProfileTab === 'nodes'` editor, and the operations body is built from an applicant-safe profile without `regions`.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npx tsx --test backend/tests/portalNodeCoverageUi.test.ts`

Expected: failure on the current Node Coverage tab/editor and full-profile request.

- [ ] **Step 3: Implement the applicant-safe UI**

Remove `nodes` from `PortalProfileTab` and `PORTAL_PROFILE_TABS`, remove the region editor and its local mutation helpers, and construct the submitted profile by omitting `regions` from the normalized form profile. Keep normalization constants needed to read existing API profile data.

- [ ] **Step 4: Run the focused test**

Run: `npx tsx --test backend/tests/portalNodeCoverageUi.test.ts`

Expected: pass.

### Task 3: Publish only system-detected regions

**Files:**
- Modify: `backend/tests/publicViewService.test.ts`
- Modify: `backend/src/services/publicViewService.ts`

- [ ] **Step 1: Update regressions to the authoritative rule**

Change the no-snapshot profile test to expect no public regions. Add profile-only false attributes to the snapshot coverage fixture and assert that only Hong Kong, Singapore, and the United States from the snapshot appear.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npx tsx --test backend/tests/publicViewService.test.ts`

Expected: the no-snapshot case still emits profile-only Hong Kong/Japan before implementation.

- [ ] **Step 3: Enforce positive node counts**

In `buildRegionCapabilities`, return `null` whenever the system-derived node count is zero before applying administrator metadata. Preserve enrichment for detected regions.

- [ ] **Step 4: Run the focused test**

Run: `npx tsx --test backend/tests/publicViewService.test.ts`

Expected: pass.

### Task 4: Verify system-owned collection paths

**Files:**
- Verify: `scripts/monitor_network_coverage.py`
- Verify: `scripts/monitor_performance.py`
- Verify: `scripts/test_monitor_network_coverage.py`
- Verify: `scripts/test_monitor_performance.py`
- Verify: `backend/tests/performanceProbeDispatchService.test.ts`

- [ ] **Step 1: Run Network Coverage collector tests**

Run: `python3 -m unittest scripts.test_monitor_network_coverage`

Expected: all tests pass, including stored-snapshot resolution.

- [ ] **Step 2: Run performance collector tests**

Run: `python3 -m unittest scripts.test_monitor_performance`

Expected: all tests pass, including stored-snapshot and administrator-selected-node behavior.

- [ ] **Step 3: Run backend dispatch tests**

Run: `npx tsx --test backend/tests/performanceProbeDispatchService.test.ts`

Expected: all tests pass and jobs use subscription snapshot node IDs/keys.

### Task 5: Full verification and intentional commit

**Files:**
- Verify all intended source and test files.

- [ ] **Step 1: Run backend test suite**

Run: `npm run test:backend`

Expected: zero failing tests.

- [ ] **Step 2: Run type checking and production build**

Run: `npm run server:typecheck && npm run lint && npm run build`

Expected: every command exits 0.

- [ ] **Step 3: Inspect browser rendering**

Open the applicant portal at desktop and mobile widths and verify that Node Coverage is absent while the remaining tabs, form controls, and submit interaction remain usable.

- [ ] **Step 4: Inspect scope and whitespace**

Run: `git diff --check` and inspect `git status --short` plus the full intended diff. Do not stage generated `node_modules/.vite` or `scripts/__pycache__` files.

- [ ] **Step 5: Commit only intended files**

Stage the implementation plan, portal/backend/public-view sources, and focused tests explicitly. Commit with `fix: make node coverage system authoritative`.

### Task 6: Production deployment and acceptance

**Files:**
- Use: `scripts/deploy_prod.sh`

- [ ] **Step 1: Deploy the verified current main revision**

Run the repository's established production deployment script and capture the deployed SHA and service health output.

- [ ] **Step 2: Verify production API and pages**

Confirm the applicant portal has no Node Coverage tab. Query Now Acceleration's public report and verify that its capability regions match the latest system subscription snapshot rather than profile-only metadata.

- [ ] **Step 3: Verify production collectors remain authoritative**

Inspect the latest subscription snapshot, Network Coverage run, and performance selection/run evidence for Now Acceleration. Confirm collection sources are stored system snapshots and administrator configuration.

### Task 7: Reject informational-name region aliases

**Files:**
- Modify: `scripts/test_monitor_performance.py`
- Modify: `scripts/monitor_performance.py`
- Modify: `backend/tests/networkCoverageScoring.test.ts`
- Modify: `backend/src/services/networkCoverageScoring.ts`
- Modify: `backend/tests/publicViewService.test.ts`
- Modify: `backend/src/services/publicViewService.ts`

- [ ] **Step 1: Add failing production regressions**

Assert that `剩余流量：4763.25 GB` parses with no Python display region, classifies as `UNKNOWN` for Network Coverage, and cannot publish the United Kingdom even when a stale snapshot region says `UK`.

- [ ] **Step 2: Verify the regressions fail**

Run: `python3 -m unittest scripts.test_monitor_performance` and `npx tsx --test backend/tests/networkCoverageScoring.test.ts backend/tests/publicViewService.test.ts`

Expected: the new assertions fail because `GB` currently matches the United Kingdom short alias.

- [ ] **Step 3: Add the informational-name guard**

Reuse the established informational markers from performance dispatch. Apply the guard before region alias matching in Python and Network Coverage scoring, and before public capability normalization so an older persisted false region is not rendered.

- [ ] **Step 4: Run focused and full verification**

Run the focused regressions, backend suite, server type checking, lint, production build, and whitespace checks. All commands must exit 0.

- [ ] **Step 5: Republish and repair today's derived data**

Push the verified revision, wait for both container images, redeploy API and web, capture a new Now Acceleration subscription snapshot, rerun Network Coverage and aggregation for `2026-08-12`, and verify the public report contains Hong Kong only.
