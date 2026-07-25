# GateRank Log Maintenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy an hourly, repository-managed GateRank log rotation service without touching database or business data.

**Architecture:** A root-only Bash CLI installs isolated logrotate, systemd, and Compose override templates. Hourly runs rotate only OpenResty logs and validate disk usage plus Docker-native log settings; installation is backed up and health-check failures roll back.

**Tech Stack:** Bash, logrotate, systemd, Docker Compose, shell fixture tests.

---

### Task 1: Add failing operations tests

**Files:**
- Create: `scripts/test_gaterank_log_maintenance.sh`

- [x] Cover dry-run immutability, idempotency, legacy conflict handling, lock contention, disk threshold, Docker drift, rollback, and uninstall ownership.
- [x] Run `bash scripts/test_gaterank_log_maintenance.sh` and confirm it initially fails because the implementation is missing.

### Task 2: Implement the maintenance interface

**Files:**
- Create: `scripts/gaterank-log-maintenance.sh`
- Create: `ops/log-maintenance/`

- [x] Implement `install [--dry-run]`, `check`, `run`, and `uninstall` with exit codes `0`, `1`, and `2`.
- [x] Add 100MB/14-file OpenResty rotation, hourly systemd execution, and 100MB/3-file Docker-native Web/API rotation.
- [x] Add managed-file ownership checks, timestamped backups, atomic replacement, health verification, and rollback.

### Task 3: Document and verify locally

**Files:**
- Modify: `README.md`
- Modify: `package.json`
- Create: `docs/superpowers/specs/2026-07-24-gaterank-log-maintenance-design.md`

- [x] Add installation, inspection, troubleshooting, uninstall, and test commands.
- [x] Run `npm run test:ops`, `bash -n scripts/gaterank-log-maintenance.sh`, and `git diff --check`; expect all to exit `0`.

### Task 4: Deploy and verify production

- [x] Run `install --dry-run` on the production server; expect no filesystem or container changes.
- [x] Run the formal installer and confirm only `gaterank-web` and `gaterank-api` are recreated.
- [x] Verify timer state, logrotate execution, Docker logging parameters, `docker logs --tail`, all seven containers, origin routes, and public HTTPS.
- [ ] Recheck journal results, log sizes, and root-disk usage after 24 hours.
