# Deal Detail Risk CTA Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the duplicated report and website buttons from the deal detail risk-information section without changing the deal-card actions.

**Architecture:** Delete the CTA markup directly from `DealDetailPage` and remove only the imports and derived value that become unused. Protect the boundary with a source-contract test that scopes negative assertions to the risk section while preserving its three information items.

**Tech Stack:** React, TypeScript, Tailwind CSS, Node test runner, Vite

---

### Task 1: Add a failing risk-section regression test

**Files:**
- Modify: `backend/tests/frontendCrawlableLinks.test.ts:154-191`
- Test: `backend/tests/frontendCrawlableLinks.test.ts`

- [ ] **Step 1: Scope and assert the risk-information section**

Add this block to the existing airport deal detail test:

```ts
const riskSectionStart = detailSource.indexOf('购买前先核对服务能力与风险');
const usageSectionStart = detailSource.indexOf('优惠码怎么使用', riskSectionStart);
assert.notEqual(riskSectionStart, -1);
assert.notEqual(usageSectionStart, -1);
const riskSectionSource = detailSource.slice(riskSectionStart, usageSectionStart);
assert.match(riskSectionSource, /InfoItem label="机场状态"/);
assert.match(riskSectionSource, /InfoItem label="支付方式"/);
assert.match(riskSectionSource, /InfoItem label="机场简介"/);
assert.doesNotMatch(riskSectionSource, /查看测评报告/);
assert.doesNotMatch(riskSectionSource, /访问官网/);
assert.doesNotMatch(detailSource, /normalizeExternalHref/);
assert.doesNotMatch(detailSource, /ExternalLink/);
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts
```

Expected: FAIL because the risk section still contains `查看测评报告` and `访问官网`.

### Task 2: Delete the duplicated CTA markup and unused dependencies

**Files:**
- Modify: `src/pages/deals/DealDetailPage.tsx:1-18`
- Modify: `src/pages/deals/DealDetailPage.tsx:90-160`
- Test: `backend/tests/frontendCrawlableLinks.test.ts`

- [ ] **Step 1: Remove the unused icon and URL normalizer**

Change the imports to:

```tsx
import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';

import {
  buildAbsoluteUrl,
  buildAirportDealDetailHref,
  buildDealsHref,
  navigate,
  PageFrame,
  usePageSeo,
} from '../../site/publicSite';
```

- [ ] **Step 2: Remove the derived website URL**

Delete this line:

```tsx
const websiteHref = normalizeExternalHref(data.airport.website);
```

- [ ] **Step 3: Leave the risk section ending immediately after its information list**

The complete section must be:

```tsx
<section className="mt-8 rounded-[18px] border border-slate-200 bg-white p-6">
  <h2 className="text-2xl font-black text-slate-950">购买前先核对服务能力与风险</h2>
  <dl className="mt-5 grid gap-4 md:grid-cols-3">
    <InfoItem label="机场状态" value={formatStatus(data.airport.status)} />
    <InfoItem label="支付方式" value={paymentMethods} />
    <InfoItem label="机场简介" value={data.airport.airport_intro || '暂未收录机场简介。'} />
  </dl>
</section>
```

- [ ] **Step 4: Run tests and type checking**

Run:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts
npm run lint
```

Expected: all 22 focused tests pass and `tsc --noEmit` exits 0.

- [ ] **Step 5: Commit the source change**

```bash
git add backend/tests/frontendCrawlableLinks.test.ts src/pages/deals/DealDetailPage.tsx
git commit -m "fix: remove duplicate deal risk actions"
```

### Task 3: Verify UI and production assets

**Files:**
- Modify: `dist/assets/index.js`

- [ ] **Step 1: Verify desktop and mobile in Chrome**

Open `http://127.0.0.1:3000/deals/xiaomi` and confirm:

```text
The risk section contains only 机场状态, 支付方式, and 机场简介.
查看测评报告 and 访问官网 do not appear in that section.
At 375px, the section ends after the three information cards with no empty CTA row.
```

- [ ] **Step 2: Build and commit generated assets**

Run:

```bash
npm run build
git add dist/assets/index.js
git commit -m "build: refresh deal risk action assets"
```

Expected: Vite exits 0 and only the generated entry bundle changes.

- [ ] **Step 3: Run final verification**

Run:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts backend/tests/viteConfig.test.ts
npm run lint
npm run build
git diff --check
git status --short --branch
```

Expected: 24 tests pass, type checking and build exit 0, and the working tree is clean.
