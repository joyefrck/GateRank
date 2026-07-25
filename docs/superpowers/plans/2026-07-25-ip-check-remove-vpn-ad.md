# IP Check VPN Ad Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the ElephantRoute VPN advertisement from the GateRank IP check page without changing its lookup, map, or result behavior.

**Architecture:** Enforce the absence of advertising through a source-level regression test, then remove the banner component, its render call, advertising-only translations, and unused icon imports. Rebuild the checked-in frontend bundle and deploy matching web and API images so the SSR asset version remains aligned.

**Tech Stack:** React, TypeScript, Node test runner, Vite, Docker Compose, GitHub Actions

---

### Task 1: Add the advertisement absence regression

**Files:**
- Modify: `backend/tests/ipCheckState.test.ts`

- [ ] **Step 1: Write the failing test**

Add imports for `readFileSync` and `resolve`, load `src/pages/ipCheck/IPCheckPage.tsx` and `shared/ipCheck.ts`, and assert that neither contains the removed promotion:

```ts
test('IP check page does not include the ElephantRoute promotion', () => {
  const pageSource = readFileSync(resolve(process.cwd(), 'src/pages/ipCheck/IPCheckPage.tsx'), 'utf8');
  const sharedSource = readFileSync(resolve(process.cwd(), 'shared/ipCheck.ts'), 'utf8');

  assert.doesNotMatch(pageSource, /VpnBanner|elphantroute\.com|vpnTitle|vpnDescription|vpnCta/);
  assert.doesNotMatch(sharedSource, /ElephantRoute|vpnTitle|vpnDescription|vpnCta/);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
node --import tsx --test backend/tests/ipCheckState.test.ts
```

Expected: FAIL because the page still contains `VpnBanner` and the translations still contain advertising fields.

- [ ] **Step 3: Commit the regression test**

```bash
git add backend/tests/ipCheckState.test.ts
git commit -m "test: prevent IP check VPN promotion"
```

### Task 2: Remove the advertisement

**Files:**
- Modify: `src/pages/ipCheck/IPCheckPage.tsx`
- Modify: `shared/ipCheck.ts`

- [ ] **Step 1: Remove the banner render and component**

Delete this render call:

```tsx
<VpnBanner translations={translations} />
```

Delete the complete `VpnBanner` function, and remove the now-unused `ExternalLink`, `Shield`, and `Zap` imports.

- [ ] **Step 2: Remove advertising-only translations**

Delete `vpnTitle`, `vpnDescription`, and `vpnCta` from both `IP_CHECK_TRANSLATIONS.zh` and `IP_CHECK_TRANSLATIONS.en`.

- [ ] **Step 3: Run the focused test to verify it passes**

Run:

```bash
node --import tsx --test backend/tests/ipCheckState.test.ts
```

Expected: all tests PASS.

- [ ] **Step 4: Run repository verification**

Run:

```bash
npm run test:backend
npm run lint
npm run build
git diff --check
```

Expected: backend tests, frontend type check, and build PASS with no whitespace errors.

- [ ] **Step 5: Commit source and generated assets**

```bash
git add src/pages/ipCheck/IPCheckPage.tsx shared/ipCheck.ts dist backend/tests/ipCheckState.test.ts
git commit -m "fix: remove IP check VPN advertisement"
```

### Task 3: Publish and verify production

**Files:**
- No source files

- [ ] **Step 1: Push main and wait for the image workflow**

Run:

```bash
git push origin main
gh run list --workflow "Build and Push Docker Images" --limit 1
gh run watch <run-id> --exit-status
```

Expected: the image workflow concludes successfully.

- [ ] **Step 2: Deploy matching images**

On `8.217.193.194`, run from `/opt/1panel/docker/compose/gaterank`:

```bash
docker compose pull gaterank-web gaterank-api
docker compose up -d --no-deps gaterank-api gaterank-web
docker compose ps
```

Expected: both services are running from the newly published `main` images.

- [ ] **Step 3: Verify the real production page**

Open `https://gate-rank.com/tools/ip-check` and verify:

```text
No text: ElephantRoute VPN / 立即体验 / 全球节点
No link: https://www.elphantroute.com/
Present: IP lookup result, map tiles, marker, result copy buttons, ipwho.is source text
```

Also verify the page and API return HTTP 200 and `https://ipcha.org/` remains HTTP 410.
