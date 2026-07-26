# Tool Package Replacement and Upload Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Safely delete replaced software packages after save, refresh inferred package metadata, and keep the uploaded filename visibly confirmed in the admin drop zone.

**Architecture:** The repository counts remaining file references, the upload utility owns validated deletion, and the download service coordinates cleanup only after a successful database update. Admin responses are enriched with the original upload filename, while the form keeps a persistent success state and replaces version/size from each new upload.

**Tech Stack:** TypeScript, Express, MySQL 8, React, Node test runner, Vite

---

### Task 1: Lock safe file replacement with failing backend tests

**Files:**
- Create: `backend/tests/toolUpload.test.ts`
- Modify: `backend/tests/toolDownloadRepository.test.ts`
- Modify: `backend/tests/toolsDownloadService.test.ts`

- [ ] **Step 1: Test managed package deletion**

Create a temporary `tools/files` directory containing:

```ts
const filename = '1783493370824-old-package.dmg';
await writeFile(path.join(fileDir, filename), 'old');
await writeFile(path.join(fileDir, `${filename}.meta.json`), '{}');
```

Call `deleteToolUploadFile('/uploads/tools/files/1783493370824-old-package.dmg')`
and assert both files no longer exist. Also assert a non-managed URL returns
`false` without deleting anything.

- [ ] **Step 2: Test repository reference counting**

Call:

```ts
const count = await repository.countByLocalFileUrl('/uploads/tools/files/old.dmg');
```

Assert the query filters on `local_file_url = ?` and returns the mocked count.

- [ ] **Step 3: Test service replacement ordering**

Build a temporary old package and metadata file. Use a repository double that:

1. returns an item pointing to the old file before update;
2. records the new URL during update;
3. returns the new item afterward;
4. reports zero remaining references.

After `updateDownload()`, assert the update succeeded and both old filesystem
entries were deleted. Add separate cases proving an update failure and a
positive remaining-reference count preserve the old files.

- [ ] **Step 4: Test admin filename enrichment**

Write upload metadata with `original_name: 'Clash.Verge_2.5.2_x64.dmg'`.
Assert `listAdminDownloads()` returns:

```ts
item.local_file_name === 'Clash.Verge_2.5.2_x64.dmg'
```

- [ ] **Step 5: Run backend tests and confirm failure**

Run:

```bash
npx tsx --test backend/tests/toolUpload.test.ts backend/tests/toolDownloadRepository.test.ts backend/tests/toolsDownloadService.test.ts
```

Expected: FAIL because deletion, reference counting, and admin filename
enrichment do not exist.

### Task 2: Implement safe backend cleanup and filename enrichment

**Files:**
- Modify: `shared/toolDownloads.ts`
- Modify: `backend/src/utils/toolUpload.ts`
- Modify: `backend/src/repositories/toolDownloadRepository.ts`
- Modify: `backend/src/services/toolsDownloadService.ts`

- [ ] **Step 1: Add the optional admin filename**

Extend `ToolDownloadItem` with:

```ts
local_file_name?: string;
```

Public repository rows do not populate it.

- [ ] **Step 2: Implement validated deletion**

Export:

```ts
deleteToolUploadFile(publicUrl: string): Promise<boolean>
```

Accept only one basename beneath `/uploads/tools/files/`, resolve it under the
configured upload root, and remove both the package and
`${filename}.meta.json` using `rm(..., { force: true })`.

- [ ] **Step 3: Add the reference-count query**

Implement:

```ts
async countByLocalFileUrl(localFileUrl: string): Promise<number>
```

with:

```sql
SELECT COUNT(*) AS total
FROM tool_download_items
WHERE local_file_url = ?
```

- [ ] **Step 4: Coordinate cleanup after save**

In `updateDownload()` compare `current.local_file_url` with the submitted URL.
Only after `repository.update()` succeeds and the updated item is loaded:

1. call `countByLocalFileUrl(oldUrl)`;
2. delete when the count is zero;
3. log cleanup errors and still return the successfully saved item.

- [ ] **Step 5: Enrich admin responses**

For admin list/create/update responses, derive the stored basename and call
`readToolUploadOriginalName()`. Return the item with `local_file_name`; leave
public page items unchanged.

- [ ] **Step 6: Run backend tests**

Run:

```bash
npx tsx --test backend/tests/toolUpload.test.ts backend/tests/toolDownloadRepository.test.ts backend/tests/toolsDownloadService.test.ts
```

Expected: all tests pass.

### Task 3: Lock and implement persistent upload feedback

**Files:**
- Modify: `backend/tests/toolsAdminDownloadsUi.test.ts`
- Modify: `src/admin/AdminApp.tsx`

- [ ] **Step 1: Add failing UI source assertions**

Assert the admin source contains:

```tsx
local_file_name: string;
data-testid="tool-file-upload-success"
安装包上传成功
```

Assert upload inference selects:

```ts
local_file_name: data.original_name || file.name
version: inferred.version || current.version
file_size_label: data.file_size_label || current.file_size_label
```

- [ ] **Step 2: Run the UI test and confirm failure**

Run:

```bash
npx tsx --test backend/tests/toolsAdminDownloadsUi.test.ts
```

Expected: FAIL because the form and drop zone have no persistent filename
state.

- [ ] **Step 3: Extend the admin model and form**

Add optional `local_file_name` to the item model and required
`local_file_name` to `ToolDownloadFormState`. Default it to empty and populate
it from admin API metadata when editing.

- [ ] **Step 4: Refresh upload inference**

After every package upload:

```ts
local_file_name: data.original_name || file.name,
version: inferred.version || current.version,
file_size_label: data.file_size_label || current.file_size_label,
```

Do not clear a valid version when the new filename has no recognizable
version.

- [ ] **Step 5: Render the success panel**

Inside the package drop zone, render a green/white confirmation panel when
`form.local_file_url` exists. Show `form.local_file_name`, file size, and
version while retaining the normal upload affordance for replacement.

- [ ] **Step 6: Run focused UI and backend tests**

Run:

```bash
npx tsx --test backend/tests/toolsAdminDownloadsUi.test.ts backend/tests/toolUpload.test.ts backend/tests/toolDownloadRepository.test.ts backend/tests/toolsDownloadService.test.ts backend/tests/toolsRoutes.test.ts
```

Expected: all tests pass.

### Task 4: Complete regression and production build

**Files:**
- Modify: `dist/assets/AdminApp.js`
- Modify: `dist/assets/index.js` only if emitted differently
- Modify: `dist/assets/index.css` only if emitted differently

- [ ] **Step 1: Run the complete backend suite**

Run:

```bash
npm run test:backend
```

Expected: zero failures.

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

Expected: Vite exits 0 and refreshes tracked assets.

- [ ] **Step 4: Inspect the final diff**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors and only files required by this feature are
modified.

- [ ] **Step 5: Commit**

Run:

```bash
git add shared/toolDownloads.ts backend/src/utils/toolUpload.ts backend/src/repositories/toolDownloadRepository.ts backend/src/services/toolsDownloadService.ts backend/tests src/admin/AdminApp.tsx dist/assets docs/superpowers/plans/2026-07-26-tool-package-replacement.md
git commit -m "feat: replace tool packages safely"
```
