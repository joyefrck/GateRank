# Production Subscription Capture Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore production Clash YAML subscription capture and return a safe, actionable admin error when capture fails.

**Architecture:** Add the missing Alpine PyYAML package to the API runtime image. Keep child-process output summarization inside `SubscriptionNodeCaptureService`, redact URI-shaped secrets, and translate capture-process failures into the existing `HttpError` response contract so the unchanged admin frontend displays the message.

**Tech Stack:** Docker/Alpine, Node.js 20, TypeScript, Express, Python 3/PyYAML, Node test runner, GitHub Actions, Docker Compose

---

## File map

- Modify `Dockerfile.api`: install the runtime YAML parser required by `scripts/monitor_performance.py`.
- Modify `backend/src/services/subscriptionNodeCaptureService.ts`: convert sanitized process failures into an explicit `HttpError`.
- Create `backend/tests/subscriptionNodeCaptureService.test.ts`: lock the safe 502 error mapping and secret redaction behavior.
- Create `backend/tests/productionApiImage.test.ts`: lock the API image's `py3-yaml` package declaration.

### Task 1: Add failing regression tests

**Files:**
- Create: `backend/tests/subscriptionNodeCaptureService.test.ts`
- Create: `backend/tests/productionApiImage.test.ts`
- Test: `backend/tests/subscriptionNodeCaptureService.test.ts`
- Test: `backend/tests/productionApiImage.test.ts`

- [ ] **Step 1: Write the capture error contract test**

Create `backend/tests/subscriptionNodeCaptureService.test.ts` with:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpError } from '../src/middleware/errorHandler';
import { toSubscriptionNodeCaptureHttpError } from '../src/services/subscriptionNodeCaptureService';

test('subscription capture failures become safe actionable http errors', () => {
  const error = new Error('capture failed') as Error & { stdout: string };
  error.stdout = JSON.stringify({
    airport_count: 1,
    success_count: 0,
    failure_count: 1,
    failures: [{
      airport_id: 40,
      airport_name: '极速云机场',
      error: 'fetch failed for https://sub.example.com/s/private-token',
    }],
  });

  const result = toSubscriptionNodeCaptureHttpError(error);

  assert.ok(result instanceof HttpError);
  assert.equal(result.status, 502);
  assert.equal(result.code, 'SUBSCRIPTION_NODE_CAPTURE_FAILED');
  assert.match(result.message, /^获取订阅节点失败：/);
  assert.match(result.message, /极速云机场 #40/);
  assert.doesNotMatch(result.message, /sub\.example\.com|private-token/);
});
```

- [ ] **Step 2: Write the production image dependency test**

Create `backend/tests/productionApiImage.test.ts` with:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('production API image installs PyYAML for Clash subscription parsing', async () => {
  const dockerfile = await readFile(new URL('../../Dockerfile.api', import.meta.url), 'utf8');

  assert.match(dockerfile, /apk add --no-cache[\s\\]*curl[\s\\]*python3[\s\\]*py3-yaml[\s\\]*sing-box/);
});
```

- [ ] **Step 3: Run both tests and verify they fail for the intended reasons**

Run:

```bash
npx tsx --test backend/tests/subscriptionNodeCaptureService.test.ts backend/tests/productionApiImage.test.ts
```

Expected: FAIL because `toSubscriptionNodeCaptureHttpError` is not exported and `Dockerfile.api` does not contain `py3-yaml`.

### Task 2: Implement the runtime dependency and safe HTTP error

**Files:**
- Modify: `Dockerfile.api:37-38`
- Modify: `backend/src/services/subscriptionNodeCaptureService.ts:1-72`
- Test: `backend/tests/subscriptionNodeCaptureService.test.ts`
- Test: `backend/tests/productionApiImage.test.ts`

- [ ] **Step 1: Install PyYAML in the API image**

Change the runtime package line in `Dockerfile.api` to:

```dockerfile
RUN sed -i 's#dl-cdn.alpinelinux.org#mirrors.aliyun.com#g' /etc/apk/repositories \
  && apk add --no-cache curl python3 py3-yaml sing-box
```

- [ ] **Step 2: Add the safe error mapper**

Import `HttpError` in `backend/src/services/subscriptionNodeCaptureService.ts`:

```ts
import { HttpError } from '../middleware/errorHandler';
```

Replace the child-process catch body with:

```ts
    } catch (error) {
      throw toSubscriptionNodeCaptureHttpError(error);
    }
```

Add these functions after the class:

```ts
export function toSubscriptionNodeCaptureHttpError(error: unknown): HttpError {
  const summary = redactSubscriptionUris(summarizeManualJobScriptFailure(error));
  return new HttpError(
    502,
    'SUBSCRIPTION_NODE_CAPTURE_FAILED',
    `获取订阅节点失败：${summary}`,
  );
}

function redactSubscriptionUris(value: string): string {
  return value.replace(
    /\b(?:https?|ss|vmess|vless|trojan|anytls):\/\/[^\s,，;；]+/gi,
    '[订阅地址已隐藏]',
  );
}
```

The existing configuration checks stay before the `try` block, so missing or malformed admin credentials are not mislabeled as upstream capture failures.

- [ ] **Step 3: Run the focused tests**

Run:

```bash
npx tsx --test backend/tests/subscriptionNodeCaptureService.test.ts backend/tests/productionApiImage.test.ts
```

Expected: 2 tests pass, 0 fail.

- [ ] **Step 4: Commit the implementation**

```bash
git add Dockerfile.api backend/src/services/subscriptionNodeCaptureService.ts backend/tests/subscriptionNodeCaptureService.test.ts backend/tests/productionApiImage.test.ts
git commit -m "fix: restore production subscription capture"
```

### Task 3: Run repository and image verification

**Files:**
- Verify: `Dockerfile.api`
- Verify: `backend/src/services/subscriptionNodeCaptureService.ts`
- Verify: `scripts/monitor_performance.py`

- [ ] **Step 1: Run the existing Python subscription tests**

Run:

```bash
python3 -m unittest scripts.test_monitor_performance
```

Expected: all tests pass with `OK`.

- [ ] **Step 2: Run all backend tests**

Run:

```bash
npm run test:backend
```

Expected: 0 failed tests.

- [ ] **Step 3: Run both TypeScript checks**

Run:

```bash
npm run server:typecheck
npm run lint
```

Expected: both commands exit 0.

- [ ] **Step 4: Build the production frontend/server bundle**

Run:

```bash
npm run build
```

Expected: Vite exits 0 and writes the production bundle.

- [ ] **Step 5: Build and inspect the production API image**

Run:

```bash
docker build -f Dockerfile.api -t gaterank-api:subscription-capture-fix .
docker run --rm gaterank-api:subscription-capture-fix python3 -c 'import yaml; print(yaml.__version__)'
```

Expected: image build exits 0 and the container prints a PyYAML version.

- [ ] **Step 6: Confirm the commit contains only the intended implementation**

Run:

```bash
git status --short
git show --stat --oneline HEAD
git diff HEAD^ -- Dockerfile.api backend/src/services/subscriptionNodeCaptureService.ts backend/tests/subscriptionNodeCaptureService.test.ts backend/tests/productionApiImage.test.ts
```

Expected: clean worktree; only the dependency, safe error mapper, and two focused tests are present.

### Task 4: Publish and deploy the verified API image

**Files:**
- Workflow: `.github/workflows/docker-publish.yml`
- Production compose directory: `/opt/1panel/docker/compose/gaterank`

- [ ] **Step 1: Push the verified main branch**

Run:

```bash
git push origin main
```

Expected: `origin/main` advances to the implementation commit and triggers `Publish Docker Images`.

- [ ] **Step 2: Wait for GitHub Actions image publication**

Run:

```bash
gh run list --workflow "Publish Docker Images" --branch main --limit 1
gh run watch "$(gh run list --workflow "Publish Docker Images" --branch main --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
```

Expected: the workflow completes successfully.

- [ ] **Step 3: Record the current production API image and pull the new image**

Run on `8.217.193.194`:

```bash
docker inspect -f 'before_image_id={{.Image}} started={{.State.StartedAt}}' gaterank-api
cd /opt/1panel/docker/compose/gaterank
docker compose pull gaterank-api
```

Expected: the pull completes and reports the new `gaterank-api:main` image.

- [ ] **Step 4: Recreate only the API container**

Run on production:

```bash
cd /opt/1panel/docker/compose/gaterank
docker compose up -d --no-deps --force-recreate gaterank-api
docker ps --filter name=gaterank-api --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
```

Expected: `gaterank-api` is running; unrelated containers retain their existing start times.

- [ ] **Step 5: Verify PyYAML and API health in the running container**

Run on production:

```bash
docker exec gaterank-api python3 -c 'import yaml; print(yaml.__version__)'
curl -fsS --connect-timeout 5 http://127.0.0.1:18787/api/v1/pages/home >/dev/null
```

Expected: PyYAML version is printed and the API health probe exits 0.

- [ ] **Step 6: Trigger and verify airport #40 capture without printing secrets**

Run a small Node script inside `gaterank-api` that:

```js
const port = process.env.PORT || '8787';
const response = await fetch(`http://127.0.0.1:${port}/api/v1/admin/airports/40/subscription-node-snapshots/capture`, {
  method: 'POST',
  headers: { 'x-api-key': process.env.ADMIN_API_KEY },
});
const data = await response.json();
console.log(JSON.stringify({
  status: response.status,
  snapshot_id: data.snapshot_id,
  subscription_format: data.subscription_format,
  parsed_nodes_count: data.parsed_nodes_count,
  supported_nodes_count: data.supported_nodes_count,
  code: data.code,
  message: data.message,
}));
if (!response.ok || !(data.snapshot_id > 0) || !(data.supported_nodes_count > 0)) process.exit(1);
```

Expected: HTTP 201, `subscription_format=clash_yaml`, a positive snapshot ID, and at least one supported node. The script must not print the subscription URL or node payloads.

- [ ] **Step 7: Verify logs and public service after capture**

Run on production:

```bash
docker logs --since 10m gaterank-api 2>&1 | tail -n 120
curl -fsSI --connect-timeout 5 https://gate-rank.com/ | head -n 8
```

Expected: no new `subscription_fetch_or_parse_failed`, API startup, or unhandled capture errors; the public site responds successfully.

