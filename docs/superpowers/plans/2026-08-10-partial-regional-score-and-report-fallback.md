# GateRank Partial Regional Score And Report Fallback Implementation Plan

> **For agentic workers:** Implement each checkbox in order and preserve the approved scope.

**Goal:** Allow scoreable partial Shanghai/Guangzhou runs when at least one download target is valid, and make airport reports fall back to that airport's own latest score date.

**Architecture:** Separate run completion status from scoring eligibility. The aggregation service validates core metrics plus persisted target evidence before accepting a partial official run. The report service resolves dates through an airport-scoped score repository query instead of a global latest-date query.

**Tech Stack:** TypeScript 5.8, Node.js test runner, Express 4, MySQL 8.

**Design reference:** `docs/superpowers/specs/2026-08-10-partial-regional-score-and-report-fallback-design.md`

---

### Task 1: Lock the regressions with tests

**Files:**
- Modify `backend/tests/aggregationService.test.ts`
- Modify `backend/tests/publicViewService.test.ts`
- Modify `backend/tests/scoreRepository.test.ts`

- [ ] Add a test proving a `partial` official region with one valid target participates while its failed peer stays pending.
- [ ] Add a test proving a `partial` run with zero valid targets remains pending.
- [ ] Change the report fallback test so global latest is the requested date but airport latest is the prior date.
- [ ] Add repository coverage for airport-scoped latest-date SQL.
- [ ] Run focused tests and capture the expected failures before implementation.

### Task 2: Implement partial-run eligibility

**Files:**
- Modify `backend/src/services/aggregationService.ts`
- Modify `backend/src/app.ts`

- [ ] Inject `PerformanceRunTargetRepository` into `AggregationService`.
- [ ] Keep all existing official/config/calibration/core-metric checks.
- [ ] Accept `success` immediately; accept `partial` only when a persisted valid target has a finite non-negative download speed.
- [ ] Preserve run status and target evidence without converting the run to success.

### Task 3: Implement airport-scoped report fallback

**Files:**
- Modify `backend/src/repositories/scoreRepository.ts`
- Modify `backend/src/services/publicViewService.ts`

- [ ] Add `getLatestAvailableDateByAirport(airportId, onOrBefore)`.
- [ ] Resolve report dates with the airport-scoped method.
- [ ] Do not fall back to the global date when the airport has no historical score.

### Task 4: Verify and publish

- [ ] Run focused aggregation, repository, and public-view tests.
- [ ] Run backend typecheck and the relevant full test/build commands.
- [ ] Review the diff for unrelated changes and commit on current `main`.
- [ ] Push `main` and wait for the image publish workflow.

### Task 5: Deploy and repair the affected production record

- [ ] Record current production image/container state for rollback.
- [ ] Pull and deploy paired API/Web images.
- [ ] Verify health and confirm the pre-existing report can use airport-scoped historical fallback.
- [ ] Trigger 可达加速器 airport 74 performance collection for 2026-08-10 and wait for completion.
- [ ] Verify a regional probe is included, performance/public score exists, ranking data is generated, and `/reports/1-mkd997?date=2026-08-10` returns 200.
