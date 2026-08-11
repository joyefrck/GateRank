# GateRank Methodology Public Principles Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the public methodology page's reproducible scoring implementation details with a polished, qualitative explanation of GateRank's evaluation principles.

**Architecture:** Keep public methodology copy in `src/pages/methodology/content.ts`, render the same information architecture in React and SSR, and source metadata and FAQ JSON-LD from sanitized SEO content. Add negative regression assertions so formulas, weights, thresholds, penalties, decay parameters, cold-start parameters, and worked examples cannot reappear in public output.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Motion, Lucide icons, Node test runner, server-side HTML templates.

---

### Task 1: Lock the confidentiality boundary with tests

**Files:**
- Modify: `backend/tests/frontendReportPage.test.ts`
- Modify: `backend/tests/publicPageRoutes.test.ts`
- Modify: `backend/tests/machineReadableRoutes.test.ts`

- [ ] **Step 1: Replace the frontend formula test**

Read the methodology content and React source, assert the five qualitative dimensions and confidentiality copy, and reject `0.30S`, `UptimeScore`, `RiskPenalty`, `days_diff`, exact penalty wording, and worked-example identifiers.

- [ ] **Step 2: Replace SSR formula assertions**

Render `/methodology`, assert `五维评估框架`, `数据如何形成结果`, `如何理解 GateRank 结果`, and `透明度边界`, then reject exact weights, formulas, thresholds, penalties, decay expressions, cold-start formulas, and demo-airport output.

- [ ] **Step 3: Add machine-readable leak assertions**

Inspect methodology metadata and JSON-LD. Retain `机场测评方法`, `评估维度`, `数据来源`, `风险监测`, and `机场推荐依据`; reject `30/30/20/10/10`, formulas, thresholds, penalties, decay, cold-start parameters, and internal variable names.

- [ ] **Step 4: Run focused tests and confirm failure**

Run `node --test --import tsx backend/tests/frontendReportPage.test.ts backend/tests/publicPageRoutes.test.ts backend/tests/machineReadableRoutes.test.ts`.

Expected: the new confidentiality assertions fail against the current formula-oriented page.

### Task 2: Replace the React content model

**Files:**
- Modify: `src/pages/methodology/content.ts`

- [ ] **Step 1: Delete browser-side scoring implementation data**

Remove `SCORE_WEIGHTS`, `THRESHOLDS`, `STABILITY_RULES`, `TIME_DECAY_LAMBDA`, scoring helpers, `riskPenaltyFlow`, `decayTimeline`, and `exampleCase`.

- [ ] **Step 2: Define sanitized presentation collections**

Export `methodologyFacts`, five qualitative `dimensionCards`, `dataPipeline`, `resultGuidance`, `transparencyBoundary`, `trustPrinciples`, and a sanitized `methodologyFaq`. These collections must contain no numeric model parameters.

- [ ] **Step 3: Sanitize structured data**

Keep TechArticle, breadcrumbs, and FAQ schema. Restrict TechArticle topics to `机场测评方法`, `五维评估框架`, `数据来源`, `风险监测`, `历史报告`, and `机场推荐依据`.

### Task 3: Rebuild the React methodology page

**Files:**
- Modify: `src/pages/methodology/MethodologyPage.tsx`

- [ ] **Step 1: Replace the gradient hero**

Build a restrained white and pale-gray hero titled `我们如何评估一个机场`, with three qualitative facts and the notice `本页公开评估原则；模型参数、阈值与计算细节属于内部方法，不对外披露。`.

- [ ] **Step 2: Render the five-dimension framework**

Use a responsive five-card grid with code badges, concise descriptions, fine borders, and restrained indigo emphasis. Render no weights, formulas, percentages, or internal fields.

- [ ] **Step 3: Render process and result guidance**

Create a four-step desktop process that becomes a vertical mobile flow, followed by three editorial result-guidance blocks.

- [ ] **Step 4: Render transparency and trust**

Create the two-column `我们公开 / 我们保留` boundary and compact trust principles. Explain the anti-copying and anti-manipulation reason for private parameters.

- [ ] **Step 5: Render FAQ and CTA**

Use accessible native `details` elements, one near-black CTA to `/rankings/all`, and a secondary text link to `/monthly-reports`.

### Task 4: Match SSR and metadata

**Files:**
- Modify: `backend/src/services/publicPageRenderer.ts`
- Modify: `shared/publicSeo.ts`

- [ ] **Step 1: Replace the SSR methodology body**

Render the same hero, dimensions, process, guidance, transparency, trust, FAQ, and CTA as React without any model implementation detail.

- [ ] **Step 2: Add methodology-specific restrained CSS**

Add dedicated methodology classes using white and pale gray, `#4f46e5` accents, 8-24px radii, fine borders, minimal shadows, responsive single-column fallbacks, visible focus rings, and reduced-motion handling.

- [ ] **Step 3: Sanitize SEO and FAQ copy**

Remove exact weights, formulas, thresholds, penalties, decay, and cold-start details from title, description, keywords, FAQ answers, and methodology JSON-LD.

- [ ] **Step 4: Check adjacent methodology promises**

Replace methodology links or public copy that promises formulas or exact penalty rules. Do not alter the scoring engine or admin documentation.

### Task 5: Verify behavior and visual quality

**Files:**
- Test: `backend/tests/frontendReportPage.test.ts`
- Test: `backend/tests/publicPageRoutes.test.ts`
- Test: `backend/tests/machineReadableRoutes.test.ts`

- [ ] **Step 1: Run focused tests**

Run `node --test --import tsx backend/tests/frontendReportPage.test.ts backend/tests/publicPageRoutes.test.ts backend/tests/machineReadableRoutes.test.ts`.

Expected: all methodology and public-output tests pass.

- [ ] **Step 2: Scan for leaked details**

Run `rg -n '0\\.30S|0\\.4 ×|UptimeScore|RiskPenalty|days_diff|recent_complaints_count|30/30/20/10/10|冷启动系数 =|阈值分段|Nebula Air' src/pages/methodology shared/publicSeo.ts backend/src/services/publicPageRenderer.ts`.

Expected: no matches in methodology content, SEO, SSR, or structured data.

- [ ] **Step 3: Run project verification**

Run `npm run server:typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

Expected: every command exits with status 0; unrelated existing debt is reported separately with evidence.

- [ ] **Step 4: Verify desktop and mobile**

Inspect `http://127.0.0.1:3000/methodology` at desktop width and near 390 × 844. Confirm hierarchy, reading order, no overflow, accessible FAQ, CTA feedback, and no formula text in the DOM.

- [ ] **Step 5: Review scope**

Confirm the task touched only methodology, SEO, SSR, related tests, and intentionally regenerated methodology assets while preserving unrelated dirty-worktree changes.

### Task 6: Restore the historical Sky Hero

**Files:**
- Modify: `src/pages/methodology/MethodologyPage.tsx`
- Modify: `backend/src/services/publicPageRenderer.ts`
- Modify: `backend/tests/frontendCrawlableLinks.test.ts`
- Modify: `backend/tests/publicPageRoutes.test.ts`

- [ ] **Step 1: Lock the historical palette with regression assertions**

Assert that React and SSR contain the historical Sky Hero gradient `#082F49`, `#075985`, `#0284C7`, and `#BAE6FD`, along with white heading text, translucent white facts, and the historical blue shadow. Keep the existing negative formula assertions.

- [ ] **Step 2: Run the focused tests and verify failure**

Run `node --test --import tsx backend/tests/frontendCrawlableLinks.test.ts backend/tests/publicPageRoutes.test.ts --test-name-pattern='methodology|Methodology'`.

Expected: the palette assertions fail because the current hero is white and pale gray.

- [ ] **Step 3: Update the React hero**

Change only the hero container, eyebrow, heading, description, disclosure panel, and fact-row classes. Use the historical Sky gradient and overlay from `ListPageHero`, retain the current copy and hierarchy, and leave every following section unchanged.

- [ ] **Step 4: Update the SSR hero**

Apply the same historical color stops, radial highlights, white typography, translucent panels, and responsive behavior to the methodology-specific SSR CSS. Keep the current sanitized HTML body.

- [ ] **Step 5: Verify the focused tests and real page**

Rerun the focused tests, then inspect `http://127.0.0.1:3000/methodology` in the browser. Confirm the historical blue treatment, readable disclosure copy, unchanged lower sections, and no formula text.

- [ ] **Step 6: Run final verification**

Run `npm run server:typecheck`, `npm run lint`, `npm run build`, the full backend test suite with the dot reporter, and `git diff --check`. Every command must exit with status zero.
