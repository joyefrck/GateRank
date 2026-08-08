# Portal Operations Preserve Airport Name Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent applicant portal operations updates from writing the approved airport's `name` field.

**Architecture:** Keep the application-record update unchanged, because the applicant cannot rename the original application. Narrow the approved-airport synchronization patch so `airportRepository.update()` receives only editable operations fields and never receives `name`.

**Tech Stack:** TypeScript, Express, Node test runner via `tsx --test`.

---

### Task 1: Lock the approved airport name in a regression test

**Files:**
- Modify: `backend/tests/portalRoutes.test.ts:4175-4360`

- [x] **Step 1: Write the failing regression assertion**

Set the approved airport fixture name to a value different from the application name:

```ts
const approvedAirport: any = {
  id: 42,
  name: 'Cloud Airport Pro',
  // existing fields remain unchanged
};
```

Replace the assertion that expects the application name in the airport update patch with assertions that the patch omits `name` and the approved airport retains its current name:

```ts
assert.equal(Object.hasOwn(updatedAirports[0], 'name'), false);
assert.equal(approvedAirport.name, 'Cloud Airport Pro');
```

- [x] **Step 2: Run the targeted test and verify it fails**

Run:

```bash
npx tsx --test --test-name-pattern='PATCH /portal/application/operations updates paid operations and syncs approved airport' backend/tests/portalRoutes.test.ts
```

Expected: one failing test because `updatedAirports[0]` still contains `name` and overwrites `approvedAirport.name`.

### Task 2: Remove the name from approved-airport synchronization

**Files:**
- Modify: `backend/src/routes/portalRoutes.ts:1642-1657`

- [x] **Step 1: Implement the minimal synchronization change**

Remove `name` from the approved-airport patch:

```ts
const patch: UpdateAirportInput = {
  website: input.website,
  websites: input.websites,
  plan_price_month: input.plan_price_month,
  has_trial: input.has_trial,
  streaming_support: input.streaming_support,
  payment_methods: input.payment_methods,
  payment_crypto_other: input.payment_crypto_other,
  applicant_telegram: input.applicant_telegram,
  founded_on: input.founded_on,
  airport_intro: input.airport_intro,
  test_account: input.test_account,
  test_password: input.test_password,
  profile,
};
```

- [x] **Step 2: Run the targeted regression test**

Run the same targeted `tsx --test` command from Task 1.

Expected: one test passes, zero tests fail.

- [x] **Step 3: Run the complete portal route test file**

Run:

```bash
npx tsx --test backend/tests/portalRoutes.test.ts
```

Expected: all portal route tests pass.

- [x] **Step 4: Run backend type checking**

Run:

```bash
npm run server:typecheck
```

Expected: exit code 0 with no TypeScript errors.

- [x] **Step 5: Review and commit the focused change**

Run `git diff --check`, review `git diff`, and commit only the route, regression test, and implementation plan:

```bash
git add backend/src/routes/portalRoutes.ts backend/tests/portalRoutes.test.ts docs/superpowers/plans/2026-08-08-portal-operations-preserve-airport-name.md
git commit -m "fix: preserve airport name during portal sync"
```
