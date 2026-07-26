# 工具下载版本、更新日期与原始文件名 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在后台软件列表展示独立版本号，让前台日期跟随编辑更新时间，并让本地安装包下载名保持上传时的原始文件名。

**Architecture:** 后台仅调整现有 React 表格，不改变接口；前台日期统一由共享格式函数读取 `updated_at`；下载服务从上传时已有的同目录元数据读取 `original_name`，并通过现有 `Content-Disposition` 响应交付给浏览器。旧安装包缺少元数据时使用实际存储名，不再生成新的业务文件名。

**Tech Stack:** React 19、TypeScript、Node.js、Express、Node Test Runner、Vite

---

### Task 1: 后台软件版本列

**Files:**
- Create: `backend/tests/toolsAdminDownloadsUi.test.ts`
- Modify: `src/admin/AdminApp.tsx:2145-2185`

- [ ] **Step 1: 写入失败的后台表格源码测试**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const adminSource = readFileSync(path.resolve(process.cwd(), 'src/admin/AdminApp.tsx'), 'utf8');
const listStart = adminSource.indexOf('<h2 className="text-lg font-black tracking-normal">软件列表</h2>');
const listEnd = adminSource.indexOf('<h2 className="font-black tracking-normal">页面 SEO 配置</h2>', listStart);
const softwareListSource = adminSource.slice(listStart, listEnd);

test('software list renders a dedicated software version column', () => {
  assert.ok(listStart >= 0);
  assert.ok(listEnd > listStart);
  assert.match(softwareListSource, />平台与系统版本<\/th>/);
  assert.match(softwareListSource, />软件版本<\/th>/);
  assert.ok(
    softwareListSource.indexOf('平台与系统版本') < softwareListSource.indexOf('软件版本'),
  );
  assert.match(softwareListSource, /\{item\.version \|\| '—'\}/);
  assert.match(softwareListSource, /colSpan=\{6\}/);
});
```

- [ ] **Step 2: 运行测试并确认先失败**

Run: `npx tsx --test backend/tests/toolsAdminDownloadsUi.test.ts`

Expected: FAIL，指出缺少“平台与系统版本”“软件版本”、版本单元格或 `colSpan={6}`。

- [ ] **Step 3: 最小实现后台版本列**

将表头改为六列：

```tsx
<thead className="bg-neutral-50 text-xs text-neutral-500">
  <tr>
    <th className="px-4 py-3">软件</th>
    <th className="px-4 py-3">平台与系统版本</th>
    <th className="px-4 py-3">软件版本</th>
    <th className="px-4 py-3">下载</th>
    <th className="px-4 py-3">状态</th>
    <th className="px-4 py-3">操作</th>
  </tr>
</thead>
```

在平台单元格之后增加：

```tsx
<td className="px-4 py-3 font-bold text-neutral-700">{item.version || '—'}</td>
```

空列表行改为：

```tsx
{!loading && items.length === 0 && <tr><td className="px-3 py-6 text-center text-neutral-500" colSpan={6}>暂无软件</td></tr>}
```

- [ ] **Step 4: 运行后台表格测试**

Run: `npx tsx --test backend/tests/toolsAdminDownloadsUi.test.ts`

Expected: PASS，1 test passed。

- [ ] **Step 5: 提交后台版本列**

```bash
git add backend/tests/toolsAdminDownloadsUi.test.ts src/admin/AdminApp.tsx
git commit -m "feat: show software versions in admin list"
```

### Task 2: 前台日期使用更新时间

**Files:**
- Modify: `backend/tests/toolDownloadsShared.test.ts:31-54`
- Modify: `shared/toolDownloads.ts:338-343`

- [ ] **Step 1: 将现有日期测试改为期望更新时间**

```ts
test('tool download trust meta shows version and latest updated date', () => {
  assert.equal(
    buildToolDownloadTrustMeta({
      version: 'v2.3.4',
      published_at: '2026-07-08 09:30:00',
      updated_at: '2026-07-09 10:00:00',
    }),
    '版本：v2.3.4 · 发布：2026-07-09',
  );
});

test('tool download trust meta falls back to published date when updated date is absent', () => {
  assert.equal(
    buildToolDownloadTrustMeta({
      version: '1.0.0',
      published_at: '2026-07-08 09:30:00',
      updated_at: '',
    }),
    '版本：1.0.0 · 发布：2026-07-08',
  );
});
```

保留现有“无版本时显示官方页面为准”的覆盖。

- [ ] **Step 2: 运行共享测试并确认先失败**

Run: `npx tsx --test backend/tests/toolDownloadsShared.test.ts`

Expected: FAIL，实际日期仍为 `2026-07-08`。

- [ ] **Step 3: 更改日期来源优先级**

```ts
export function buildToolDownloadTrustMeta(
  item: Pick<ToolDownloadItem, 'version' | 'published_at' | 'updated_at'>,
): string {
  const versionLabel = item.version.trim() || '以官方发布页为准';
  const dateLabel = formatToolDownloadDate(item.updated_at || item.published_at);
  return `版本：${versionLabel} · 发布：${dateLabel}`;
}
```

- [ ] **Step 4: 运行共享测试**

Run: `npx tsx --test backend/tests/toolDownloadsShared.test.ts`

Expected: PASS，全部共享工具下载测试通过。

- [ ] **Step 5: 提交日期行为**

```bash
git add backend/tests/toolDownloadsShared.test.ts shared/toolDownloads.ts
git commit -m "fix: show tool download update dates"
```

### Task 3: 下载响应保留上传原始文件名

**Files:**
- Modify: `backend/tests/toolsDownloadService.test.ts`
- Modify: `backend/src/utils/toolUpload.ts:172-188`
- Modify: `backend/src/services/toolsDownloadService.ts:1-170`
- Modify: `backend/src/services/publicPageRenderer.ts:80-95,1888-1920`
- Modify: `src/App.tsx:90-110,4376-4410`
- Modify: `shared/toolDownloads.ts:346-354,371-379`
- Modify: `backend/tests/publicPageRoutes.test.ts:350-395`
- Create: `backend/tests/toolDownloadsUi.test.ts`

- [ ] **Step 1: 增加下载服务的原始名称与回退测试**

在 `backend/tests/toolsDownloadService.test.ts` 引入临时目录工具和上传元数据函数，并增加：

```ts
test('ToolsDownloadService preserves the original uploaded filename', async () => {
  const uploadRoot = await mkdtemp(path.join(os.tmpdir(), 'gaterank-tool-download-'));
  const previousUploadRoot = process.env.NEWS_UPLOAD_ROOT_DIR;
  process.env.NEWS_UPLOAD_ROOT_DIR = uploadRoot;
  try {
    const filename = '1783493370824-storage-id.dmg';
    const fileDir = path.join(uploadRoot, 'tools', 'files');
    await mkdir(fileDir, { recursive: true });
    await writeFile(path.join(fileDir, filename), 'fixture');
    await writeToolUploadMetadata('files', filename, {
      original_name: 'Clash.Verge_2.5.1_aarch64.dmg',
      size: 7,
    });

    const service = createDownloadService({
      local_file_url: `/uploads/tools/files/${filename}`,
    });
    const target = await service.getDownloadFileTarget('clash-verge-macos', 'macos');

    assert.equal(target.downloadFilename, 'Clash.Verge_2.5.1_aarch64.dmg');
  } finally {
    if (previousUploadRoot === undefined) delete process.env.NEWS_UPLOAD_ROOT_DIR;
    else process.env.NEWS_UPLOAD_ROOT_DIR = previousUploadRoot;
    await rm(uploadRoot, { recursive: true, force: true });
  }
});

test('ToolsDownloadService falls back to the stored filename when upload metadata is absent', async () => {
  const uploadRoot = await mkdtemp(path.join(os.tmpdir(), 'gaterank-tool-download-'));
  const previousUploadRoot = process.env.NEWS_UPLOAD_ROOT_DIR;
  process.env.NEWS_UPLOAD_ROOT_DIR = uploadRoot;
  try {
    const filename = 'legacy-storage-name.dmg';
    const fileDir = path.join(uploadRoot, 'tools', 'files');
    await mkdir(fileDir, { recursive: true });
    await writeFile(path.join(fileDir, filename), 'fixture');

    const service = createDownloadService({
      local_file_url: `/uploads/tools/files/${filename}`,
    });
    const target = await service.getDownloadFileTarget('clash-verge-macos', 'macos');

    assert.equal(target.downloadFilename, filename);
  } finally {
    if (previousUploadRoot === undefined) delete process.env.NEWS_UPLOAD_ROOT_DIR;
    else process.env.NEWS_UPLOAD_ROOT_DIR = previousUploadRoot;
    await rm(uploadRoot, { recursive: true, force: true });
  }
});
```

`createDownloadService` 返回一个仓储桩，提供已发布、支持 macOS 的 `ToolDownloadItem`。

- [ ] **Step 2: 运行下载服务测试并确认先失败**

Run: `npx tsx --test backend/tests/toolsDownloadService.test.ts`

Expected: FAIL，实际文件名仍为重新生成的 `Clash-Verge-macOS-2.5.1.dmg`。

- [ ] **Step 3: 暴露安全的原始名称读取函数**

在 `backend/src/utils/toolUpload.ts` 增加：

```ts
export async function readToolUploadOriginalName(filename: string): Promise<string> {
  const storedFilename = path.basename(filename);
  const metadata = await readToolUploadMetadata(getToolUploadDir('files'), storedFilename);
  const originalName = typeof metadata.original_name === 'string' ? metadata.original_name : '';
  const safeOriginalName = path.basename(originalName.replace(/\\/g, '/'));
  return safeOriginalName || storedFilename;
}
```

- [ ] **Step 4: 下载服务改用上传元数据**

移除 `buildToolDownloadFilename` 导入，增加 `readToolUploadOriginalName` 导入，并在已验证文件存在后读取：

```ts
const storedFilename = path.basename(absolutePath);
const downloadFilename = await readToolUploadOriginalName(storedFilename);

return {
  item,
  platform,
  downloadFilename,
  absolutePath,
  internalRedirectPath: buildInternalRedirectPath(item.local_file_url),
};
```

- [ ] **Step 5: 删除前台和共享层的二次命名**

在服务端 `renderToolDownloadCard` 和客户端 `ToolDownloadCard` 中分别把：

```ts
<a class="tool-download-primary" href="..." download="...">立即下载</a>
```

改为：

```ts
<a class="tool-download-primary" href="${escapeAttribute(buildToolControlledDownloadUrl(item, platform))}">立即下载</a>
```

同时从 `backend/src/services/publicPageRenderer.ts` 和 `src/App.tsx` 删除 `buildToolDownloadFilename` 导入，并从 `shared/toolDownloads.ts` 删除 `buildToolDownloadFilename` 与只供它使用的 `sanitizeDownloadFilenamePart`。增加客户端源码约束测试，保证 React 接管页面后也不会重新指定下载文件名。

- [ ] **Step 6: 更新受控下载路由测试**

将路由桩的下载名和响应头断言改为原始上传文件名：

```ts
downloadFilename: 'Clash.Verge_2.5.1_aarch64.dmg',
```

```ts
assert.match(
  browserResponse.headers.get('content-disposition') || '',
  /filename\*=UTF-8''Clash\.Verge_2\.5\.1_aarch64\.dmg/,
);
```

- [ ] **Step 7: 运行下载相关测试**

Run:

```bash
npx tsx --test \
  backend/tests/toolsDownloadService.test.ts \
  backend/tests/toolDownloadsShared.test.ts \
  backend/tests/publicPageRoutes.test.ts
```

Expected: PASS，所有下载服务、共享格式和公开路由测试通过。

- [ ] **Step 8: 提交原始下载文件名行为**

```bash
git add \
  backend/tests/toolsDownloadService.test.ts \
  backend/src/utils/toolUpload.ts \
  backend/src/services/toolsDownloadService.ts \
  backend/src/services/publicPageRenderer.ts \
  src/App.tsx \
  shared/toolDownloads.ts \
  backend/tests/publicPageRoutes.test.ts \
  backend/tests/toolDownloadsUi.test.ts
git commit -m "fix: preserve uploaded tool filenames"
```

### Task 4: 全量验证

**Files:**
- Verify: all modified source and test files

- [ ] **Step 1: 运行针对性测试**

Run:

```bash
npx tsx --test \
  backend/tests/toolsAdminDownloadsUi.test.ts \
  backend/tests/toolDownloadsShared.test.ts \
  backend/tests/toolsDownloadService.test.ts \
  backend/tests/toolDownloadsUi.test.ts \
  backend/tests/publicPageRoutes.test.ts
```

Expected: PASS，无失败测试。

- [ ] **Step 2: 运行前后端类型检查**

Run:

```bash
npm run lint
npm run server:typecheck
```

Expected: 两条命令均以 exit code 0 结束。

- [ ] **Step 3: 运行生产构建**

Run: `npm run build`

Expected: Vite 构建成功并生成 `dist` 资源。

- [ ] **Step 4: 检查最终差异**

Run:

```bash
git diff --check
git status --short
```

Expected: `git diff --check` 无输出；状态中只包含本计划涉及的预期文件或生成资源。
