# Probe retry limit and scheduler recovery implementation plan

**Goal:** Bound probe jobs to three total attempts and prevent the 09:00 ad reminder from crashing the API.

**Architecture:** Expire exhausted queued jobs and exhausted leases only after their lease ends, within the existing lease transaction. Keep active leases and completed evidence intact. Share the scheduler task catalog between both repositories, migrate the existing run enum on startup, and contain asynchronous scheduler failures.

**Tech Stack:** TypeScript, MySQL 8, node:test.

## Scope and decisions

- Three total attempts (initial execution plus two retries), for both performance and coverage jobs. Existing 15-minute performance and one-hour coverage leases remain unchanged; this is an attempt limit, not a wall-clock deadline.
- Exhausted jobs use the existing `expired` terminal status, retaining attempts and job identity. No fabricated probe result or score is written.
- An active last attempt may still upload normally. An exhausted expired lease must not be leased a fourth time. Existing queued jobs above the limit are expired when the worker next polls.
- The ad reminder remains scheduled at 09:00 Asia/Shanghai. The task table, run table and initial schema accept the same task keys. A failed run-record insert must release runtime state and schedule the next slot; uncaught timer errors must be logged instead of terminating the process.
- Work locally on current main. Do not deploy, rerun production tasks, modify production records or send reminders as part of verification.

## Tasks

- [x] Add regression coverage for scheduler enum parity, ad-reminder execution, run-record failure and timer failures.
- [x] Add an isolated local MySQL integration test for attempt boundaries, active leases, exhausted legacy jobs, concurrency, terminal result rejection, and upgrading an old scheduler enum while preserving existing records.
- [x] Run regressions before implementation and confirm the reported defects fail.
- [x] Update `performanceProbeJobRepository.ts`: expire attempts >= 3 before requeue, requeue only attempts < 3, and filter lease selection by the same limit.
- [x] Create a shared scheduler task catalog; use it in both repositories and update `backend/sql/schema.sql`.
- [x] Move run-record creation inside the scheduler try/finally and attach a rejection handler to timer callbacks; keep manual callers informed of infrastructure errors.
- [x] Run focused tests, local MySQL integration, backend typecheck, and the complete backend suite. Inspect the scoped diff and report limits separately from production recovery.

## Verification

Use a disposable local database (`127.0.0.1` only) for actual MySQL enum migration and queue transitions. Execute `node_modules/.bin/tsx --test backend/tests/performanceProbeJobRepository.test.ts backend/tests/schedulerRunRepository.test.ts backend/tests/schedulerTaskRepository.test.ts backend/tests/adminSchedulerService.test.ts`, then `npm run server:typecheck` and `npm run test:backend`. Do not import/start the application against production during tests.

## Results

- Before the fix, scheduler tests reproduced missing enum support, stuck runtime state and unhandled timer rejections; actual MySQL reproduced attempts 4/109 and the ad reminder enum error.
- Focused tests: 24 passed. Isolated MySQL integration: 7 passed. Backend typecheck: passed. Full backend suite: 1095 passed, 0 failed, 6 skipped (the opt-in MySQL test was run separately).
- No production connection or mutation in this implementation phase. No commit, push or deployment.
