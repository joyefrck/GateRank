# Mainland Network Coverage Implementation Plan

**Goal:** Run N on enabled mainland probes and publish union-of-healthy-node coverage after all regional evidence arrives.

**Architecture:** Reuse the authenticated probe queue with an explicit coverage test profile and worker capability negotiation. Store a transactionally created batch with pinned snapshot and expected job IDs. Serialize submissions per airport/batch, validate complete node identities against the snapshot, and publish one existing N run only for a complete successful batch. Keep sanitized regional evidence in diagnostics. P selection and scoring remain independent. Manual requests wait for publication; scheduler dispatches and worker completion recomputes. A failed/incomplete batch preserves prior N; older batches cannot overwrite newer completed batches.

**Tech Stack:** TypeScript/Express/MySQL, Python/sing-box, existing Docker and systemd probes.

- [x] Add batch repository, atomic queue creation and union aggregation service; regression tests for partial arrival, duplicate/forged/incomplete submission, failure and stale batches.
- [x] Add worker coverage profile, all-node proxy HTTP checks, bounded concurrency and capability handshake; retain P behavior and secret-safe payloads.
- [x] Wire manual/scheduled collection and completion-based recomputation; test routing and old-worker compatibility.
- [x] Show mainland collection policy and sanitized per-region evidence in the N admin tab.
- [ ] Run Python/backend tests and typechecks, commit scoped changes, publish paired API/web and worker scripts with backups.
- [ ] Collect airport 61 on both probes, verify official N and public report, preserve historical runs.
