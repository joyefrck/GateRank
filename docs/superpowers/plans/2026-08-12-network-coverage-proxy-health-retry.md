# Network Coverage Proxy Health Retry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate single-target transient TLS false negatives from network coverage health checks without weakening the requirement for a real proxied HTTPS request.

**Architecture:** Extend the shared proxy HTTP availability probe used by network coverage and performance selection. Use an adaptive primary-retry-fallback sequence in one sing-box session, return on the first successful HTTPS response, and emit a sanitized failure category only after every attempt fails.

**Tech Stack:** Python 3, urllib, sing-box, unittest, TypeScript backend integration

---

### Task 1: Add failing regression tests

**Files:**
- Modify: `scripts/test_monitor_performance.py`
- Modify: `scripts/test_monitor_network_coverage.py`

- [ ] **Step 1: Test the primary fast path**

Mock the single-request helper as successful and assert the proxy availability probe returns healthy after one call.

- [ ] **Step 2: Test retry and fallback recovery**

Make the primary request raise `ssl.SSLEOFError` twice and the first fallback succeed. Assert the node is healthy and the helper received the primary URL twice followed by the fallback URL once.

- [ ] **Step 3: Test terminal failure categorization**

Make every target attempt raise `ssl.SSLEOFError`. Assert the node is unhealthy with `proxy_ssl_eof` and every configured attempt was made.

- [ ] **Step 4: Test collector error preservation**

Assert `sanitize_node_error('proxy_ssl_eof')` remains `proxy_ssl_eof` and connection-reset errors normalize to `proxy_connection_reset`.

- [ ] **Step 5: Run tests and confirm failure**

Run `python3 -m unittest scripts.test_monitor_performance scripts.test_monitor_network_coverage`; expect the new retry/fallback assertions to fail before implementation.

### Task 2: Implement adaptive availability checks

**Files:**
- Modify: `scripts/monitor_performance.py`
- Modify: `scripts/monitor_network_coverage.py`

- [ ] **Step 1: Define safe fallback targets and retry constants**

Add Cloudflare and Example HTTPS endpoints, two attempts per target, and a 250ms retry interval.

- [ ] **Step 2: Add safe error classification**

Map TLS EOF, timeout, connection reset, HTTP response failure, sing-box startup failure, and unknown proxy failures to stable non-secret codes.

- [ ] **Step 3: Replace the one-shot request**

Within the existing sing-box lifecycle, try the configured primary target first and return immediately on success. On failure, retry it and then try each distinct fallback target. Return unhealthy only after all attempts fail.

- [ ] **Step 4: Preserve precise collector codes**

Allow the safe proxy error codes through the network coverage sanitizer without exposing raw exception text.

- [ ] **Step 5: Run focused tests**

Run `python3 -m unittest scripts.test_monitor_performance scripts.test_monitor_network_coverage`; expect all tests to pass.

### Task 3: Verify and publish

**Files:**
- Verify and stage only the two scripts, two test files, design, and plan.

- [ ] **Step 1: Run complete release checks**

Run `python3 -m unittest discover -s scripts -p 'test_*.py'`, `npm run test:backend`, `npm run server:typecheck`, `npm run lint`, `npm run build`, and `git diff --check`; every command must exit 0.

- [ ] **Step 2: Commit and push current main**

Commit only intended files, push `main`, and verify local HEAD equals `origin/main`.

- [ ] **Step 3: Deploy production images**

Wait for the Docker publish workflow, pull the new API and web images, recreate both services, and confirm startup logs contain no fatal errors.

- [ ] **Step 4: Run production acceptance without writing data**

Execute the shared proxy availability function against the previously failing large-elephant nodes without posting a coverage run. Confirm every previously false-negative node is healthy and no secret material appears in output.
