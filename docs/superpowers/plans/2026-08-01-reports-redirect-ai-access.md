# Reports Redirect and AI Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/reports` and `/reports/` return a single HTTPS 301 to `https://gate-rank.com/monthly-reports` for normal and search/retrieval AI user agents without changing the existing `/reports/:id` compatibility route or granting access to training crawlers.

**Architecture:** Define the canonical redirect in two exact Nginx locations so it is version controlled and cannot inherit the container-side HTTP scheme. Keep the existing reports prefix proxy for numeric legacy report URLs, and extend the existing Cloudflare Skip rule with only the two retired collection aliases.

**Tech Stack:** Nginx, TypeScript Node test runner, Cloudflare WAF custom rules, Chrome browser automation.

---

### Task 1: Lock the exact redirect contract with a failing Nginx test

**Files:**
- Modify: `backend/tests/nginxConfig.test.ts`

- [ ] **Step 1: Add the redirect regression test**

Insert this test after `nginx keeps public SEO routes proxied to backend prerender routes`:

```ts
test('nginx redirects retired report collection aliases to the canonical monthly reports URL', async () => {
  const config = await readFile(path.join(process.cwd(), 'nginx.conf'), 'utf8');

  for (const route of ['/reports', '/reports/']) {
    const block = getLocationBlock(config, `= ${route}`);
    assert.match(block, /return\s+301\s+https:\/\/gate-rank\.com\/monthly-reports;/);
    assert.doesNotMatch(block, /proxy_pass/);
  }

  const legacyDetailBlock = getLocationBlock(config, '/reports/');
  assert.match(legacyDetailBlock, /proxy_pass\s+http:\/\/gaterank-api:8787;/);
});
```

This distinguishes the exact collection aliases from the existing prefix location. The prefix assertion protects `/reports/:id` from being removed.

- [ ] **Step 2: Run the focused test and confirm the red state**

Run:

```bash
npx tsx --test backend/tests/nginxConfig.test.ts
```

Expected: the new test fails with `missing nginx location = /reports`; all existing assertions continue to run.

- [ ] **Step 3: Commit the failing regression test**

Run:

```bash
git add backend/tests/nginxConfig.test.ts
git commit -m "test: cover reports collection redirects"
```

Expected: one commit containing only the Nginx regression test.

### Task 2: Implement the two exact HTTPS redirects

**Files:**
- Modify: `nginx.conf`

- [ ] **Step 1: Add exact collection-alias locations**

Immediately before the existing `location /reports/` block, add:

```nginx
location = /reports {
  return 301 https://gate-rank.com/monthly-reports;
}

location = /reports/ {
  return 301 https://gate-rank.com/monthly-reports;
}
```

Do not change the existing prefix block:

```nginx
location /reports/ {
  proxy_pass http://gaterank-api:8787;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-Host $host;
}
```

- [ ] **Step 2: Run the focused test and confirm green**

Run:

```bash
npx tsx --test backend/tests/nginxConfig.test.ts
```

Expected: every Nginx configuration test passes, including the two exact HTTPS redirects and the reports prefix proxy assertion.

- [ ] **Step 3: Review the isolated code diff**

Run:

```bash
git diff -- nginx.conf backend/tests/nginxConfig.test.ts
git diff --check
```

Expected: only the new test and two exact Nginx location blocks appear; no whitespace errors.

- [ ] **Step 4: Commit the Nginx implementation**

Run:

```bash
git add nginx.conf
git commit -m "fix: redirect retired reports collection aliases"
```

Expected: one implementation commit containing only `nginx.conf`.

### Task 3: Extend the Cloudflare search/retrieval AI exception precisely

**Files:**
- External configuration: Cloudflare custom rule `Allow AI crawlers on public content`

- [ ] **Step 1: Reopen and verify the existing rule before editing**

In the already authenticated Chrome Cloudflare tab, open Security Rules and select `Allow AI crawlers on public content`. Confirm before editing:

- Rule status is active.
- Rule remains first in custom-rule order.
- Action is Skip for the intended managed and Super Bot Fight Mode rules.
- Methods remain limited to `GET` and `HEAD`.

- [ ] **Step 2: Add only the two retired collection aliases**

Replace the expression with the following complete value; the only new path entries are `"/reports"` and `"/reports/"`:

```text
(http.request.method in {"GET" "HEAD"} and (
  lower(http.user_agent) contains "chatgpt-user" or
  lower(http.user_agent) contains "oai-searchbot" or
  lower(http.user_agent) contains "perplexitybot" or
  lower(http.user_agent) contains "perplexity-user" or
  lower(http.user_agent) contains "claude-searchbot" or
  lower(http.user_agent) contains "claude-user"
) and (
  http.request.uri.path in {
    "/" "/risk-monitor" "/methodology" "/deals" "/deals.md"
    "/monthly-reports" "/monthly-reports.md" "/news"
    "/llms.txt" "/llms-full.txt" "/for-ai" "/data"
    "/robots.txt" "/sitemap.xml" "/sitemap-ai.xml"
    "/reports" "/reports/"
    "/tools" "/tools/download" "/tools/streaming-check"
    "/tools/ip-check" "/tools/dns-leak-test"
  } or
  starts_with(http.request.uri.path, "/rankings/") or
  starts_with(http.request.uri.path, "/airports/") or
  starts_with(http.request.uri.path, "/monthly-reports/") or
  starts_with(http.request.uri.path, "/news/") or
  starts_with(http.request.uri.path, "/data/")
))
```

Do not add `/reports/` as a `starts_with` condition: that would unnecessarily exempt every legacy `/reports/:id` path. Do not add `GPTBot`, `ClaudeBot`, or `Bytespider`.

- [ ] **Step 3: Save and verify the displayed rule**

Save the rule, return to the rule list, and confirm it is still active and first. Reopen it once and verify the displayed expression contains both exact reports paths and no reports prefix condition.

- [ ] **Step 4: Verify the deployment-independent edge result**

Before publishing the Nginx image, probe both paths with these search/retrieval agents:

```text
ChatGPT-User/1.0
OAI-SearchBot/1.0
PerplexityBot/1.0
Perplexity-User/1.0
Claude-SearchBot/1.0
Claude-User/1.0
```

Expected before application deployment: none of these requests returns Cloudflare 403. The current origin may still return the old `301 http://gate-rank.com/reports/` for `/reports` and 404 for `/reports/`; those origin results prove the edge exception is active but are not final acceptance.

Probe `GPTBot/1.0`, `ClaudeBot/1.0`, and `Bytespider/1.0` separately. Expected: the edit did not add a new exception for any training agent.

### Task 4: Run repository regression and prepare deployment evidence

**Files:**
- Verification only

- [ ] **Step 1: Run focused and full automated verification**

Run:

```bash
npx tsx --test backend/tests/nginxConfig.test.ts
npm run test:backend
npm run server:typecheck
npm run build
```

Expected: all commands exit 0. The existing Vite large-chunk warning is non-blocking unless a new build error accompanies it.

- [ ] **Step 2: Review repository state**

Run:

```bash
git status --short --branch
git diff --check
git log -4 --oneline --decorate
```

Expected: the design commit, test commit, and Nginx implementation commit are visible; the working tree contains no unrelated changes.

- [ ] **Step 3: Record the production publication boundary**

Do not push, deploy, pull production images, or restart containers without explicit authorization. Until the Nginx change is published, report the state as:

```text
Cloudflare AI access: updated and live
Nginx redirect: implemented and locally verified
Production /reports redirect: pending publication
```

### Task 5: Perform post-deployment live acceptance after authorization

**Files:**
- Production verification only

- [ ] **Step 1: Verify the normal-UA redirect contract**

After the paired GateRank web/API release is published, request `/reports` and `/reports/` without following redirects.

Expected for both:

```text
Status: 301
Location: https://gate-rank.com/monthly-reports
```

Follow each redirect once and confirm the final response is `200` at `https://gate-rank.com/monthly-reports` with no HTTP downgrade or extra `/reports/` hop.

- [ ] **Step 2: Verify all six search/retrieval agents**

Repeat the two no-follow requests for:

```text
ChatGPT-User/1.0
OAI-SearchBot/1.0
PerplexityBot/1.0
Perplexity-User/1.0
Claude-SearchBot/1.0
Claude-User/1.0
```

Expected: all 12 requests return the same HTTPS 301 target and none returns 403.

- [ ] **Step 3: Verify training-agent and legacy-detail boundaries**

Request both collection aliases with `GPTBot/1.0`, `ClaudeBot/1.0`, and `Bytespider/1.0`. Expected: the Cloudflare edit has not granted them the search/retrieval exception.

Request a known existing `/reports/:id` URL with a normal user agent and do not follow redirects. Expected: it continues to return the existing airport-specific 301 rather than the monthly-report collection target.

- [ ] **Step 4: Record final acceptance evidence**

Capture the exact status and `Location` for the normal-UA matrix, the six search/retrieval agents, the three training agents, and one known legacy detail URL. Final completion requires the live normal and search/retrieval paths to match the canonical HTTPS contract.
