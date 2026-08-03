# GateRank UI Skill and Deal Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create an auto-discovered GateRank UI design skill and restyle the deal card footer as the selected minimal action rail.

**Architecture:** Store durable GateRank visual guidance in a personal skill with one concise workflow file and one detailed homepage-style reference. Keep the product change inside the shared `DealCard` so list and detail pages stay aligned, preserve all existing navigation and tracking behavior, and verify source, responsive browser layouts, and generated assets.

**Tech Stack:** Codex skills, Markdown, YAML, React, TypeScript, Tailwind CSS, lucide-react, Node test runner, Vite

---

### Task 1: Create the GateRank UI Design Skill

**Files:**
- Create: `/Users/joyefrack/.agents/skills/gaterank-ui-design/SKILL.md`
- Create: `/Users/joyefrack/.agents/skills/gaterank-ui-design/agents/openai.yaml`
- Create: `/Users/joyefrack/.agents/skills/gaterank-ui-design/references/gaterank-home-style.md`

- [ ] **Step 1: Initialize the skill with official tooling**

Run:

```bash
python3 /Users/joyefrack/.codex/skills/.system/skill-creator/scripts/init_skill.py \
  gaterank-ui-design \
  --path /Users/joyefrack/.agents/skills \
  --resources references \
  --interface display_name="GateRank UI Design" \
  --interface short_description="Match GateRank pages to the homepage visual system" \
  --interface 'default_prompt=Use $gaterank-ui-design to design or revise this GateRank page in the established homepage style.'
```

Expected: the command creates `gaterank-ui-design/`, including `SKILL.md`, `agents/openai.yaml`, and `references/`.

- [ ] **Step 2: Replace the generated SKILL.md with the project workflow**

Write `/Users/joyefrack/.agents/skills/gaterank-ui-design/SKILL.md` with:

```markdown
---
name: gaterank-ui-design
description: Apply GateRank's established homepage visual system to frontend work. Use for any GateRank task that creates or modifies public pages, admin pages, components, layouts, cards, navigation, buttons, responsive behavior, visual hierarchy, screenshot-based UI, or design reviews.
---

# GateRank UI Design

Treat `src/pages/home/HomePageV3.tsx` as the primary React visual reference and the homepage styles in `backend/src/services/publicPageRenderer.ts` as the SSR reference.

## Workflow

1. Confirm the workspace is GateRank.
2. Inspect the target component and the closest homepage pattern before proposing styles.
3. State a one-sentence visual thesis, the content hierarchy, and the intended interaction feedback.
4. Reuse existing components and tokens before adding new primitives.
5. Keep one dominant action per region. Render secondary actions as restrained outlined controls or text links.
6. Preserve routing, analytics, sponsored-link attributes, SSR/React parity, and accessibility.
7. Verify desktop and mobile layouts in a real browser, then run focused tests, type checking, and the production build.

## Visual Rules

- Use white or pale gray surfaces, slate or stone text, and indigo or blue only for semantic emphasis.
- Use near-black filled controls for the primary action.
- Use 8-12px control radii and 18-24px primary-card radii.
- Prefer one-pixel light borders, restrained shadows, and short translate or scale feedback.
- Keep headings high-weight and compact; keep supporting copy quieter and shorter.
- Maintain at least 40px touch targets and visible keyboard focus.

## Avoid

- Equal-weight groups of three or more buttons.
- Large groups of identical white outlined controls.
- Random gradients, unrelated accent colors, heavy shadows, pill clutter, or unnecessary nested cards.
- Visual-only changes that break links, tracking, semantic HTML, or server-rendered parity.

Read [references/gaterank-home-style.md](references/gaterank-home-style.md) before substantial visual work or when exact tokens and source patterns are needed.
```

- [ ] **Step 3: Add the homepage style reference**

Write `/Users/joyefrack/.agents/skills/gaterank-ui-design/references/gaterank-home-style.md` with:

```markdown
# GateRank Homepage Style Reference

## Source of truth

- React homepage: `src/pages/home/HomePageV3.tsx`
- Public shell and navigation: `src/site/publicSite.tsx`
- Shared list hero: `src/components/ListPageHero.tsx`
- SSR homepage and public styles: `backend/src/services/publicPageRenderer.ts`
- Shared tag language: `src/components/TagBadge.tsx`

Always inspect the current source before copying a class string because these files may evolve.

## Visual thesis

GateRank uses calm white and pale-gray surfaces, dense black typography, a single near-black primary action, indigo semantic accents, fine borders, restrained shadows, and small purposeful motion.

## Tokens and patterns

- Main text: `text-gray-900`, `text-slate-950`, or `text-neutral-900`.
- Supporting text: `text-gray-400` through `text-gray-600`.
- Primary action: `border-stone-900 bg-stone-900 text-white`, usually `rounded-xl` with a light shadow.
- Secondary action: white subtle border or an unboxed gray text action.
- Semantic accent: indigo or blue; reserve emerald and rose for positive and risk states.
- Standard control radius: `rounded-lg` or `rounded-xl`.
- Primary card radius: `rounded-[18px]` through `rounded-[24px]`.
- Borders: `border-gray-100`, `border-gray-200`, or slate equivalents.
- Motion: 2-3px vertical lift, 1.02 scale, arrow translation, and clear active compression.

## Action hierarchy

1. Give one action the black filled treatment.
2. Use an outlined or text-only style for secondary actions.
3. Use direction arrows for internal drill-down and `ExternalLink` for outbound navigation.
4. Do not present three identical controls when their importance differs.
5. On narrow screens, allow the primary action to occupy its own row while secondary actions share the next row.

## Page composition

- Public pages use `PageFrame` and existing navigation.
- Reuse `ListPageHero` for list/index pages rather than inventing another hero.
- Prefer clear sections, dividers, and whitespace over adding more nested cards.
- Keep routine product UI compact and operational; do not introduce marketing copy into admin surfaces.

## Verification checklist

- Desktop hierarchy matches the homepage.
- Mobile touch targets remain at least 40px and content does not overflow.
- Focus-visible treatment is present.
- Internal links remain crawlable anchors.
- Sponsored outbound links retain their attributes and click tracking.
- SSR and React communicate the same structure and meaning.
- Focused tests, TypeScript, and Vite build pass.
```

- [ ] **Step 4: Validate the new skill**

Run:

```bash
python3 /Users/joyefrack/.codex/skills/.system/skill-creator/scripts/quick_validate.py /Users/joyefrack/.agents/skills/gaterank-ui-design
```

Expected: `Skill is valid!`

### Task 2: Implement the Minimal Deal Action Rail

**Files:**
- Modify: `backend/tests/frontendCrawlableLinks.test.ts`
- Modify: `src/pages/deals/DealCard.tsx`

- [ ] **Step 1: Add failing source assertions for action hierarchy**

Extend `React airport deal detail route preserves one slug page and SSR takeover` in `backend/tests/frontendCrawlableLinks.test.ts`:

```ts
assert.match(cardSource, /ArrowRight, Check, Copy, ExternalLink, Sparkles/);
assert.match(cardSource, /grid-cols-2[^"]*sm:grid-cols-\[minmax\(130px,1\.15fr\)_minmax\(90px,\.8fr\)_minmax\(76px,\.65fr\)\]/);
assert.match(cardSource, /group col-span-2[^"\n]*border-stone-900 bg-stone-900[^"\n]*sm:col-span-1/);
assert.match(cardSource, /group-hover:translate-x-0\.5/);
assert.match(cardSource, /border-l border-slate-200/);
assert.doesNotMatch(cardSource, /grid-cols-\[repeat\(auto-fit/);
```

- [ ] **Step 2: Run the focused test to verify red state**

Run:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts
```

Expected: FAIL because `DealCard` still renders three equal boxed actions and does not import `ArrowRight`.

- [ ] **Step 3: Implement the selected option C**

In `src/pages/deals/DealCard.tsx`:

```tsx
import { ArrowRight, Check, Copy, ExternalLink, Sparkles } from 'lucide-react';
```

Replace the existing footer action grid with:

```tsx
<div className="mt-4 grid grid-cols-2 gap-y-1.5 border-t border-slate-200 pt-4 sm:grid-cols-[minmax(130px,1.15fr)_minmax(90px,.8fr)_minmax(76px,.65fr)] sm:gap-y-0">
  <a
    href={detailHref}
    onClick={(event) => { event.preventDefault(); navigate(detailHref); }}
    className="group col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-stone-900 bg-stone-900 px-3 text-[13px] font-black text-white shadow-[0_8px_18px_rgba(23,23,23,0.14)] transition duration-200 hover:-translate-y-0.5 hover:bg-stone-800 hover:shadow-[0_12px_24px_rgba(23,23,23,0.18)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 motion-reduce:transform-none sm:col-span-1"
  >
    优惠详情
    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
  </a>
  <a
    href={deal.report_url}
    onClick={(event) => { event.preventDefault(); navigate(deal.report_url); }}
    className="inline-flex h-10 items-center justify-center px-2 text-[13px] font-black text-slate-600 transition hover:text-slate-950 focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 sm:border-l sm:border-slate-200"
  >
    查看测评
  </a>
  {websiteHref === '#' ? null : (
    <a
      href={websiteHref}
      target="_blank"
      onClick={outboundClick}
      rel="sponsored nofollow noreferrer noopener"
      className="inline-flex h-10 items-center justify-center gap-1 border-l border-slate-200 px-2 text-[13px] font-black text-slate-600 transition hover:text-slate-950 focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
    >
      官网
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  )}
</div>
```

- [ ] **Step 4: Run focused tests and TypeScript**

Run:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts
npm run lint
```

Expected: all focused tests pass and `tsc --noEmit` exits 0.

- [ ] **Step 5: Commit source changes**

```bash
git add backend/tests/frontendCrawlableLinks.test.ts src/pages/deals/DealCard.tsx
git commit -m "feat: restyle deal card action hierarchy"
```

### Task 3: Verify Responsive UI and Production Assets

**Files:**
- Modify: `dist/assets/index.js`
- Modify: `dist/assets/index.css`

- [ ] **Step 1: Verify desktop and mobile layouts in the running local app**

Open `http://127.0.0.1:3000/deals/xiaomi` in the connected browser.

Desktop acceptance:

```text
One black 优惠详情 action and two unboxed text actions share one row.
```

Mobile acceptance at 375px width:

```text
优惠详情 occupies the first row; 查看测评 and 官网 share the second row without overflow.
```

- [ ] **Step 2: Build production assets**

Run:

```bash
npm run build
```

Expected: Vite exits 0 and refreshes stable assets.

- [ ] **Step 3: Run final focused verification**

Run:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts backend/tests/viteConfig.test.ts
npm run lint
git diff --check
```

Expected: all tests pass, TypeScript exits 0, and `git diff --check` emits no output.

- [ ] **Step 4: Commit generated assets**

```bash
git add dist/assets/index.js dist/assets/index.css
git commit -m "build: refresh deal action rail assets"
```
