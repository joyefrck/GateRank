# Direct Subscription Node URI Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin node-capture action accept supported single-node URIs in addition to HTTP(S) subscription endpoints.

**Architecture:** Add an input-type branch at `fetch_parsed_subscription`, the existing boundary between saved subscription values and parsed nodes. Supported direct-node schemes are parsed locally as plain subscription text, while HTTP(S) inputs retain the existing two-User-Agent fetch path and downstream snapshot format.

**Tech Stack:** Python 3 `unittest`, TypeScript, React, Vite

---

### Task 1: Add direct-node parsing with a VLESS Reality regression test

**Files:**
- Modify: `scripts/test_monitor_performance.py:777-817`
- Modify: `scripts/capture_subscription_nodes.py:123-146`

- [ ] **Step 1: Write the failing direct VLESS regression test**

Add this test immediately before `test_fetch_parsed_subscription_prefers_clashmeta_and_keeps_anytls`:

```python
def test_fetch_parsed_subscription_accepts_direct_vless_without_fetch(self) -> None:
    from scripts.capture_subscription_nodes import fetch_parsed_subscription

    config = self.make_config()
    direct_uri = (
        "vless://11111111-1111-1111-1111-111111111111@47.80.3.248:12043"
        "?encryption=none&security=reality&flow=xtls-rprx-vision&type=tcp"
        "&sni=dash.cloudflare.com&pbk=O7nRDHG9Gq9vJHxpHzojS92OP8liC6aCgIFeFY4GkTQ"
        "&fp=chrome#direct-reality"
    )

    with patch(
        "scripts.capture_subscription_nodes.fetch_subscription",
        side_effect=AssertionError("direct node URI must not be fetched"),
    ) as fetch_mock:
        subscription_format, nodes, unsupported_nodes = fetch_parsed_subscription(config, direct_uri)

    fetch_mock.assert_not_called()
    self.assertEqual(subscription_format, "plain")
    self.assertEqual(unsupported_nodes, [])
    self.assertEqual(len(nodes), 1)
    node = nodes[0]
    self.assertEqual(node.node_type, "vless")
    self.assertEqual(node.outbound["server"], "47.80.3.248")
    self.assertEqual(node.outbound["server_port"], 12043)
    self.assertEqual(node.outbound["flow"], "xtls-rprx-vision")
    self.assertEqual(node.outbound["tls"]["server_name"], "dash.cloudflare.com")
    self.assertEqual(node.outbound["tls"]["utls"]["fingerprint"], "chrome")
    self.assertEqual(
        node.outbound["tls"]["reality"]["public_key"],
        "O7nRDHG9Gq9vJHxpHzojS92OP8liC6aCgIFeFY4GkTQ",
    )
```

- [ ] **Step 2: Run the focused test and verify the pre-fix failure**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest \
  scripts.test_monitor_performance.MonitorPerformanceTests.test_fetch_parsed_subscription_accepts_direct_vless_without_fetch -v
```

Expected: `FAIL`; `fetch_subscription` is called with the `vless://` URI and raises the test assertion, after which capture reports `subscription_fetch_or_parse_failed`.

- [ ] **Step 3: Implement supported direct-node scheme detection and local parsing**

Add the constant near the imports in `scripts/capture_subscription_nodes.py`:

```python
DIRECT_NODE_URI_SCHEMES = (
    "vless://",
    "vmess://",
    "trojan://",
    "ss://",
    "anytls://",
)
```

Add this branch at the start of `fetch_parsed_subscription`:

```python
    if subscription_url.lower().startswith(DIRECT_NODE_URI_SCHEMES):
        normalized_subscription, subscription_format = normalize_subscription_text(subscription_url)
        parsed_nodes, unsupported_nodes = parse_nodes(normalized_subscription, subscription_format)
        if parsed_nodes:
            return subscription_format, parsed_nodes, unsupported_nodes
        raise RuntimeError("subscription_fetch_or_parse_failed")
```

Leave the existing User-Agent loop unchanged below this branch.

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest \
  scripts.test_monitor_performance.MonitorPerformanceTests.test_fetch_parsed_subscription_accepts_direct_vless_without_fetch -v
```

Expected: `OK`; the fetch mock is not called and the parsed node retains VLESS Reality settings.

- [ ] **Step 5: Run all subscription-capture regression tests**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest scripts.test_monitor_performance.MonitorPerformanceTests -v
```

Expected: all `MonitorPerformanceTests` pass, including existing HTTP fetch and fallback cases.

### Task 2: Make both admin editing surfaces describe the accepted input

**Files:**
- Modify: `src/admin/AdminApp.tsx:8419-8425`
- Modify: `src/admin/AdminApp.tsx:9139-9145`
- Regenerate: `dist/assets/AdminApp.js`

- [ ] **Step 1: Update both subscription field hints and placeholders**

Replace both occurrences of the current field copy with:

```tsx
<FormField label="订阅或单节点链接" hint="支持 HTTP(S) 订阅地址，或 VLESS、VMess、Trojan、SS、AnyTLS 单节点链接。">
```

Replace both placeholders with:

```tsx
placeholder="https://example.com/subscribe 或 vless://..."
```

- [ ] **Step 2: Type-check the frontend**

Run:

```bash
npm run lint
```

Expected: TypeScript exits with code 0 and reports no errors.

- [ ] **Step 3: Build the frontend**

Run:

```bash
npm run build
```

Expected: Vite exits with code 0 and produces the production bundle.

### Task 3: Verify the complete change and commit it

**Files:**
- Verify: `scripts/capture_subscription_nodes.py`
- Verify: `scripts/test_monitor_performance.py`
- Verify: `src/admin/AdminApp.tsx`
- Verify: `dist/assets/AdminApp.js`

- [ ] **Step 1: Run whitespace and complete relevant test checks**

Run:

```bash
git diff --check
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest scripts.test_monitor_performance -v
npm run lint
npm run build
```

Expected: every command exits with code 0; Python reports no failing tests, TypeScript reports no errors, and Vite completes the production build.

- [ ] **Step 2: Inspect the final diff and confirm scope**

Run:

```bash
git diff -- scripts/capture_subscription_nodes.py scripts/test_monitor_performance.py src/admin/AdminApp.tsx
git status --short
```

Expected: only the direct-node capture logic, its regression test, the two admin field-copy updates, the regenerated tracked admin asset, and this plan document are new since the design commit.

- [ ] **Step 3: Commit the implementation**

Run:

```bash
git add scripts/capture_subscription_nodes.py scripts/test_monitor_performance.py src/admin/AdminApp.tsx dist/assets/AdminApp.js docs/superpowers/plans/2026-07-17-direct-subscription-node-uri.md
git commit -m "fix: support direct subscription node URIs"
```

Expected: Git creates one implementation commit containing only the planned files.
