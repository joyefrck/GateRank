# Tool Download Content Date Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make public software dates reflect the original publication date or the latest administrator content edit, never a download-count update.

**Architecture:** Add a nullable `content_updated_at` timestamp to the tool download record, stamp it only in the admin edit service, and make the shared renderer prefer it over `published_at`. Existing rows remain null and fall back to their original publication date.

**Tech Stack:** TypeScript, Express, MySQL 8, React, Node test runner, Vite

---

### Task 1: Lock the semantic date contract with failing tests

**Files:**
- Modify: `backend/tests/toolDownloadsShared.test.ts`
- Modify: `backend/tests/toolDownloadRepository.test.ts`
- Modify: `backend/tests/toolsDownloadService.test.ts`

- [ ] **Step 1: Replace the shared metadata assertions**

Add a test proving `content_updated_at` wins and generic `updated_at` is ignored:

```ts
assert.equal(
  buildToolDownloadTrustMeta({
    version: 'v2.3.4',
    published_at: '2026-07-08 09:30:00',
    content_updated_at: '2026-07-09 10:00:00',
    updated_at: '2026-07-25 10:00:00',
  }),
  '版本：v2.3.4 · 发布：2026-07-09',
);
```

Add a historical fallback case where `content_updated_at` is null and
`updated_at` is newer:

```ts
assert.equal(
  buildToolDownloadTrustMeta({
    version: '2.5.1',
    published_at: '2026-07-08 18:29:01',
    content_updated_at: null,
    updated_at: '2026-07-25 00:12:29',
  }),
  '版本：2.5.1 · 发布：2026-07-08',
);
```

- [ ] **Step 2: Extend repository assertions**

Assert that schema initialization contains
`content_updated_at DATETIME NULL`, row mapping returns the timestamp, and the
select query formats the column.

- [ ] **Step 3: Add an admin-edit service test**

Create a repository double that captures the update input. Call
`updateDownload(1, { version: '2.5.2' })` and assert:

```ts
assert.match(String(capturedUpdate?.content_updated_at), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
assert.equal(capturedUpdate?.version, '2.5.2');
```

- [ ] **Step 4: Run the focused tests and confirm failure**

Run:

```bash
npx tsx --test backend/tests/toolDownloadsShared.test.ts backend/tests/toolDownloadRepository.test.ts backend/tests/toolsDownloadService.test.ts
```

Expected: FAIL because `content_updated_at` is not part of the shared model,
schema, repository mapping, or edit service.

### Task 2: Implement the dedicated content timestamp

**Files:**
- Modify: `shared/toolDownloads.ts`
- Modify: `backend/src/repositories/toolDownloadRepository.ts`
- Modify: `backend/src/services/toolsDownloadService.ts`
- Modify: affected test fixtures under `backend/tests/`

- [ ] **Step 1: Extend the shared model and renderer**

Add:

```ts
content_updated_at: string | null;
```

Change the trust metadata source to:

```ts
const dateLabel = formatToolDownloadDate(item.content_updated_at || item.published_at);
```

- [ ] **Step 2: Add the compatible database column**

Define and ensure:

```sql
content_updated_at DATETIME NULL
```

Select it with:

```sql
DATE_FORMAT(content_updated_at, '%Y-%m-%d %H:%i:%s') AS content_updated_at
```

Map absent values to `null`.

- [ ] **Step 3: Stamp only admin content edits**

In `ToolsDownloadService.updateDownload()` add:

```ts
input.content_updated_at = formatSqlDateTimeInTimezone(new Date());
```

Do not add this field to `updateDownloadStatus()` or `recordDownload()`.

- [ ] **Step 4: Update typed fixtures**

Add `content_updated_at: null` to tool download fixtures that construct a full
`ToolDownloadItem`.

- [ ] **Step 5: Run the focused tests**

Run:

```bash
npx tsx --test backend/tests/toolDownloadsShared.test.ts backend/tests/toolDownloadRepository.test.ts backend/tests/toolsDownloadService.test.ts backend/tests/toolDownloadsUi.test.ts backend/tests/publicPageRoutes.test.ts
```

Expected: all focused tests pass.

### Task 3: Verify generated assets and complete regression

**Files:**
- Modify: `dist/assets/index.js`
- Modify: `dist/assets/AdminApp.js` if emitted differently by Vite
- Modify: `dist/assets/index.css` only if emitted differently by Vite

- [ ] **Step 1: Run the complete backend suite**

Run:

```bash
npm run test:backend
```

Expected: zero failing tests.

- [ ] **Step 2: Run TypeScript linting**

Run:

```bash
npm run lint
```

Expected: exit code 0.

- [ ] **Step 3: Build production assets**

Run:

```bash
npm run build
```

Expected: Vite exits 0 and refreshes tracked production assets.

- [ ] **Step 4: Check the final diff**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors and only files required by this fix are
modified.

- [ ] **Step 5: Commit the implementation**

Run:

```bash
git add shared/toolDownloads.ts backend/src/repositories/toolDownloadRepository.ts backend/src/services/toolsDownloadService.ts backend/tests dist/assets docs/superpowers/plans/2026-07-26-tool-download-content-date.md
git commit -m "fix: separate tool content update dates"
```
