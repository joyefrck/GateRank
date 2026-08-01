# Homepage SSR Heading Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the three homepage SSR H2 texts exactly match the current React-rendered headings.

**Architecture:** Keep the React homepage as the source of truth and change only the static heading arguments in the existing SSR renderer. Protect both render paths with source-contract and rendered-route assertions, without adding shared constants or changing section structure.

**Tech Stack:** TypeScript, React, Express, Node test runner, `tsx`

---

### Task 1: Add heading parity regression coverage

**Files:**
- Modify: `backend/tests/publicPageRoutes.test.ts:71-87`
- Modify: `backend/tests/frontendCrawlableLinks.test.ts:143-153`

- [ ] **Step 1: Change the SSR expectations to the target headings**

Replace the three old positive assertions with positive and negative checks:

```ts
assert.match(html, /商业合作专区/);
assert.doesNotMatch(html, /今日赞助推荐/);
assert.match(html, /🏆 GateRank 排行榜/);
assert.doesNotMatch(html, /综合实力排行/);
assert.match(html, /公告与动态/);
assert.doesNotMatch(html, /最新 News/);
```

- [ ] **Step 2: Protect the React source-of-truth headings**

Add these assertions to the existing React homepage source contract test:

```ts
assert.match(source, />商业合作专区<\/h2>/);
assert.match(source, />🏆 GateRank 排行榜<\/h2>/);
assert.match(source, />公告与动态<\/h2>/);
```

- [ ] **Step 3: Run the focused tests and verify the SSR contract fails**

Run:

```bash
npx tsx --test backend/tests/publicPageRoutes.test.ts backend/tests/frontendCrawlableLinks.test.ts
```

Expected: `frontendCrawlableLinks.test.ts` passes its new source assertions, while the homepage case in `publicPageRoutes.test.ts` fails because SSR still emits `今日赞助推荐`.

### Task 2: Align the SSR headings

**Files:**
- Modify: `backend/src/services/publicPageRenderer.ts:2044-2137`

- [ ] **Step 1: Replace only the three SSR H2 title arguments**

Use the existing `renderHomeV3SectionHead` calls with these target titles:

```ts
'商业合作专区'
'🏆 GateRank 排行榜'
'公告与动态'
```

Keep eyebrow text, subtitles, actions, IDs, captions and surrounding markup unchanged.

- [ ] **Step 2: Run the focused tests and verify they pass**

Run:

```bash
npx tsx --test backend/tests/publicPageRoutes.test.ts backend/tests/frontendCrawlableLinks.test.ts
```

Expected: exit code `0` with both test files passing.

### Task 3: Verify the completed change

**Files:**
- Verify: `backend/src/services/publicPageRenderer.ts`
- Verify: `backend/tests/publicPageRoutes.test.ts`
- Verify: `backend/tests/frontendCrawlableLinks.test.ts`

- [ ] **Step 1: Run backend and frontend type checks**

```bash
npm run server:typecheck
npm run lint
```

Expected: both commands exit `0`.

- [ ] **Step 2: Build the production frontend**

```bash
npm run build
```

Expected: Vite exits `0` and regenerates the tracked `dist` artifacts. Include changed generated assets in the implementation commit only when their content differs.

- [ ] **Step 3: Check title occurrences and patch formatting**

```bash
rg -n "今日赞助推荐|综合实力排行|最新 News|商业合作专区|GateRank 排行榜|公告与动态" backend/src/services/publicPageRenderer.ts src/pages/home/HomePageV3.tsx
git diff --check
```

Expected: old H2 strings are absent from the SSR renderer, both render paths contain the three target headings, and `git diff --check` exits `0`.

- [ ] **Step 4: Commit the implementation**

```bash
git add backend/src/services/publicPageRenderer.ts backend/tests/publicPageRoutes.test.ts backend/tests/frontendCrawlableLinks.test.ts dist
git commit -m "fix: align homepage SSR headings"
```
