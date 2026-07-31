# SSR Link Color Cascade Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore white text on dark Tailwind link buttons rendered inside the production SSR shell.

**Architecture:** Keep the SSR default anchor inheritance rule, but register it in the existing CSS `base` cascade layer. Add a rendered-HTML regression test that proves the rule is layered and the former unlayered global rule is absent.

**Tech Stack:** TypeScript, Node test runner, Express SSR renderer, Tailwind CSS v4, Vite

---

### Task 1: Layer the SSR anchor default below Tailwind utilities

**Files:**
- Modify: `backend/tests/publicPageRoutes.test.ts`
- Modify: `backend/src/services/publicPageRenderer.ts`

- [x] **Step 1: Write the failing rendered-HTML regression assertions**

Add these assertions to the common public SEO route checks after the stylesheet assertion:

```ts
assert.match(html, /@layer base\s*\{\s*a\s*\{\s*color:\s*inherit;\s*\}\s*\}/);
assert.doesNotMatch(html, /(?:<style>|\})\s*a\s*\{\s*color:\s*inherit;\s*\}/);
```

- [x] **Step 2: Run the focused test and confirm the new assertion fails**

Run:

```bash
npx tsx --test --test-name-pattern="public SEO routes return crawlable HTML" backend/tests/publicPageRoutes.test.ts
```

Expected: FAIL because the rendered HTML still contains unlayered `a { color: inherit; }` and no `@layer base` wrapper.

- [x] **Step 3: Implement the minimal CSS cascade fix**

Replace the unlayered rule in `backend/src/services/publicPageRenderer.ts`:

```css
@layer base { a { color: inherit; } }
```

- [x] **Step 4: Run focused and related verification**

Run:

```bash
npx tsx --test --test-name-pattern="public SEO routes return crawlable HTML" backend/tests/publicPageRoutes.test.ts
npm run test:backend -- --test-name-pattern="public SEO routes return crawlable HTML|React homepage exposes desktop table"
npm run lint
npm run server:typecheck
VITE_SITE_URL=https://gate-rank.com VITE_API_BASE='' npm run build
git diff --check
```

Expected: focused test and related tests PASS; both type checks PASS; production build succeeds; `git diff --check` reports no errors.

- [x] **Step 5: Commit the tested fix**

```bash
git add backend/tests/publicPageRoutes.test.ts backend/src/services/publicPageRenderer.ts docs/superpowers/plans/2026-07-31-ssr-link-color-cascade.md
git commit -m "fix: restore SSR link utility colors"
```
