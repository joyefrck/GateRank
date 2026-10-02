# Subscription Node DNS Implementation Plan

> **For agentic workers:** Execute in this session task-by-task; existing main and user changes must be preserved.

**Goal:** Preserve subscription node DNS and verify actual mainland coverage for 光速云.

**Architecture:** Store optional `dns_resolvers` and `dns_ipv6` in node JSON. Resolve nodes with bounded dnspython requests, try every returned IP, and use the selected address only in the temporary sing-box configuration with the original TLS identity. Refresh snapshots after rollout.

**Tech Stack:** Python, dnspython, TypeScript, MySQL JSON, sing-box, systemd, Docker.

### Task 1: Preserve metadata and reproduce the regression

**Files:** scripts/test_monitor_performance.py, backend/tests/subscriptionNodeSnapshotRepository.test.ts, backend/tests/performanceProbeJobService.test.ts.

- [x] Add parser/snapshot regression with a synthetic Clash subscription:

```yaml
dns:
  ipv6: false
  proxy-server-nameserver: [192.0.2.53]
proxies:
  - {name: HK, type: vless, server: hk.example.test, port: 443, uuid: test-id, tls: true}
```

Assert `node.dns_resolvers == ["192.0.2.53"]`, `dns_ipv6 is False`, and `nodes_from_snapshot({"nodes": [node_to_snapshot(node)]})` retains both fields. Verify repository insert/read and the leased snapshot retain the same fields.

- [x] Run `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest scripts.test_monitor_performance` and `npx tsx --test backend/tests/subscriptionNodeSnapshotRepository.test.ts backend/tests/performanceProbeJobService.test.ts`; confirm new tests fail before implementation.

### Task 2: Implement resolution and runtime pinning

**Files:** scripts/subscription_node_dns.py, scripts/monitor_performance.py, scripts/test_subscription_node_dns.py, backend/src/types/domain.ts, backend/src/routes/adminRoutes.ts, backend/src/repositories/subscriptionNodeSnapshotRepository.ts.

- [x] Implement resolver normalization and bounded A/AAAA queries with dnspython. Retain resolver metadata during Clash parsing and snapshot conversion.
- [x] Validate optional metadata at the backend route; preserve it in repository normalization and existing task payloads.
- [x] Test a failing first address followed by a working second address using mocked sockets. Test that explicit DNS failures do not fall back to system DNS.
- [x] Resolve/connect addresses with a shared helper. Pin the successful address in a copied outbound while preserving the original server_name, URI and node key. Apply the helper to coverage, P runs and connection latency measurements.
- [x] Run `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts -p 'test_*.py'`; expect no failures.

### Task 3: Package and verify

**Files:** Dockerfile.api, requirements-monitor.txt, ops/performance-probe/install.sh.

- [x] Add dnspython runtime dependencies to the API image and probe venv; install the resolver helper with probe scripts.
- [ ] Run `npm run lint`, `npm run server:typecheck`, `npm run test:backend`, `npm run build -- --outDir /tmp/gaterank-dns-release-build`, and `DEVELOPER_DIR=/Library/Developer/CommandLineTools git diff --check`; require successful final output.
- [ ] Review the scoped diff and commit only the task files on main. Push and wait for `docker-publish.yml` for that exact SHA.

### Task 4: Deploy and accept

- [ ] Verify existing Hong Kong and mainland hosts; back up active Compose files and probe scripts before mutation.
- [ ] Update paired Web/API SHA images and both probes, verify checksums, imports, timers and health.
- [ ] Refresh airport 41 through the authenticated capture action. Confirm stored DNS metadata; run a real coverage job and poll both regional results.
- [ ] Verify latest admin counts, error distribution, score/report publication state and browser display. Record actual success/failed counts, commit, CI and backup locations.
