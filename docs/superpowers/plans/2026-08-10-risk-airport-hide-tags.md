# Risk Airport Hide Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide all bottom tag badges for airports whose status is `risk` or `down` while preserving tags for normal airports.

**Architecture:** Keep the airport data and tag arrays unchanged. Add one local visibility predicate in `src/App.tsx`; full ranking cards pass their status, while risk-monitor cards also pass `monitor_reason` because a risk-watch item can retain the base `normal` status.

**Tech Stack:** React, TypeScript, Node test runner, Vite

---

### Task 1: Cover and implement risk-sensitive tag visibility

**Files:**
- Modify: `backend/tests/frontendCrawlableLinks.test.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the failing source regression test**

Add a test that reads `src/App.tsx`, extracts `FullRankingPage` and `RiskMonitorPage`, and requires both card sections to guard `TagBadgeGroup` with the shared predicate:

```ts
test('React ranking cards hide tags for risk and down airports', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/App.tsx'), 'utf8');
  const fullRankingStart = source.indexOf('function FullRankingPage');
  const riskMonitorStart = source.indexOf('function RiskMonitorPage');
  const riskMonitorEnd = source.indexOf('function ReportPage', riskMonitorStart);

  assert.notEqual(fullRankingStart, -1);
  assert.notEqual(riskMonitorStart, -1);
  assert.notEqual(riskMonitorEnd, -1);

  const helperSource = source.slice(source.indexOf('function shouldDisplayAirportTags'), fullRankingStart);
  const fullRankingSource = source.slice(fullRankingStart, riskMonitorStart);
  const riskMonitorSource = source.slice(riskMonitorStart, riskMonitorEnd);

  assert.match(helperSource, /return status !== 'risk' && status !== 'down' && monitorReason !== 'risk_watch' && monitorReason !== 'down';/);
  assert.match(fullRankingSource, /shouldDisplayAirportTags\(item\.status\)[\s\S]*?<TagBadgeGroup tags=\{item\.tags\}/);
  assert.match(riskMonitorSource, /shouldDisplayAirportTags\(item\.status, item\.monitor_reason\)[\s\S]*?<TagBadgeGroup tags=\{item\.tags\}/);
});
```

- [ ] **Step 2: Run the focused test and confirm the new assertion fails**

Run:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts
```

Expected: the new test fails because `shouldDisplayAirportTags` is not present yet.

- [ ] **Step 3: Add the minimal shared status predicate and conditional rendering**

Add this local helper before `FullRankingPage`:

```ts
function shouldDisplayAirportTags(
  status: AirportStatus,
  monitorReason?: RiskMonitorItemResponse['monitor_reason'],
): boolean {
  return status !== 'risk' && status !== 'down' && monitorReason !== 'risk_watch' && monitorReason !== 'down';
}
```

Wrap each of the two existing tag groups with the same condition:

```tsx
{shouldDisplayAirportTags(item.status) && (
  <TagBadgeGroup tags={item.tags} size="sm" className="mt-5" />
)}
```

The risk-monitor card passes its monitor reason as the second argument:

```tsx
{shouldDisplayAirportTags(item.status, item.monitor_reason) && (
  <TagBadgeGroup tags={item.tags} size="sm" className="mt-5" />
)}
```

- [ ] **Step 4: Run the focused regression test**

Run:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts
```

Expected: all tests in the file pass with zero failures.

- [ ] **Step 5: Run static and production-build verification**

Run:

```bash
npm run lint
npm run server:typecheck
npm run build
```

Expected: all three commands exit with status 0.

- [ ] **Step 6: Verify the rendered cards in a real browser**

Open the local ranking and risk-monitor pages. On desktop and a mobile viewport, confirm `risk` and `down` cards retain their status badges but have no bottom tag row or empty spacer; confirm a normal ranking card still shows its existing tags.

- [ ] **Step 7: Commit only the implementation and test**

```bash
git add src/App.tsx backend/tests/frontendCrawlableLinks.test.ts
git commit -m "fix: hide tags for risk airports"
```
