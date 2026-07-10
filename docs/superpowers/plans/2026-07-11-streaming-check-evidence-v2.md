# Streaming Check Evidence V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make official country coverage the primary streaming result and treat browser resource reachability as supplemental evidence.

**Architecture:** Keep policy and merge behavior in `shared/streamingCheck.ts`, use one image-resource probe per service in the React page, and mirror the revised language in SSR. The backend API contract remains unchanged apart from the corrected country assessment values produced by the shared module.

**Tech Stack:** TypeScript, React 19, Express, Node test runner, Vite, Tailwind CSS

---

### Task 1: Lock the evidence priority with tests

**Files:**
- Modify: `backend/tests/streamingCheckShared.test.ts`

- [ ] Add assertions that supported and unsupported official country results remain authoritative when a resource probe fails or times out.
- [ ] Add Japan assertions for ChatGPT, Claude, Netflix, Disney+, TikTok, and HBO Max.
- [ ] Run `npx tsx --test backend/tests/streamingCheckShared.test.ts` and confirm the old merge behavior fails.

### Task 2: Update the shared evidence model

**Files:**
- Modify: `shared/streamingCheck.ts`

- [ ] Replace ambiguous merged states with `region_supported`, `region_unsupported`, `reachable_only`, and `browser_limited`.
- [ ] Add separate `official_url` and static `probe_url` values to every service definition.
- [ ] Classify Japan as unsupported for HBO Max from the complete official availability table.
- [ ] Make known official region support take precedence over reachability; only connectivity-only services depend on the browser probe.
- [ ] Run the focused shared test and confirm it passes.

### Task 3: Update the React detector

**Files:**
- Modify: `src/pages/streamingCheck/StreamingCheckPage.tsx`

- [ ] Replace homepage `fetch(..., { mode: 'no-cors' })` with a timed `Image` resource probe.
- [ ] Render the new labels: official support, official unsupported, base resource reachable, and browser-limited manual verification.
- [ ] Add a safe `打开验证` external link for each service.
- [ ] Update explanatory copy and FAQ so resource failures are not described as service failures.
- [ ] Preserve click-only execution, six probes, progress, rerun, Netflix manual links, and reduced-motion behavior.

### Task 4: Keep SSR and SEO language aligned

**Files:**
- Modify: `backend/src/services/publicPageRenderer.ts`

- [ ] Update description, FAQ, initial page explanation, and structured-data text to match the v2 evidence model.
- [ ] Keep the SSR page IP-free and all six services in the initial pending state.

### Task 5: Verify the complete change

**Files:**
- Verify: `shared/streamingCheck.ts`
- Verify: `src/pages/streamingCheck/StreamingCheckPage.tsx`
- Verify: `backend/src/services/publicPageRenderer.ts`

- [ ] Run `npm run test:backend` and record the pass/fail count.
- [ ] Run `npm run server:typecheck`; if it fails, separate pre-existing baseline errors from new errors.
- [ ] Run `npm run lint` and require exit code 0.
- [ ] Run `npm run build` and require exit code 0.
- [ ] Start the local services and verify the detector in a real browser at desktop and mobile widths.
- [ ] Inspect `git diff --check` and the final scoped diff before reporting completion.
