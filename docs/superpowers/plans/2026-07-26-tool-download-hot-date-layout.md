# 热门工具发布日期响应式布局 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让热门工具卡片的大屏版本与发布日期保持单行、小屏允许换行，并始终完整显示日期。

**Architecture:** 热门徽标继续绝对定位，但右侧避让空间从整个卡片头部缩小到软件名称标题行。SSR 和 React 使用等价的响应式规则：基础样式允许换行，`sm` 及以上保持单行，避免页面接管前后布局不一致。

**Tech Stack:** React 19、TypeScript、Tailwind CSS、服务端 HTML/CSS 渲染、Node Test Runner、Vite

---

### Task 1: 写入响应式布局回归测试

**Files:**
- Modify: `backend/tests/toolDownloadsUi.test.ts`
- Modify: `backend/tests/publicPageRoutes.test.ts:300-315`

- [ ] **Step 1: 增加 React 卡片源码约束**

在 `backend/tests/toolDownloadsUi.test.ts` 增加：

```ts
test('hot tool cards reserve badge space only on the title and keep responsive trust metadata', () => {
  assert.match(
    toolDownloadCardSource,
    /<h3 className=\{`truncate text-lg font-black text-slate-950 \$\{item\.is_hot \? 'pr-16' : ''\}`\}>/,
  );
  assert.match(
    toolDownloadCardSource,
    /<p className="whitespace-normal break-words text-sm leading-5 text-slate-500 sm:whitespace-nowrap">/,
  );
  assert.match(toolDownloadCardSource, /<div className="min-w-0 flex-1">/);
  assert.doesNotMatch(
    toolDownloadCardSource,
    /<div className=\{`flex items-center gap-3 \$\{item\.is_hot \? 'pr-16' : ''\}`\}>/,
  );
  assert.doesNotMatch(
    toolDownloadCardSource,
    /<p className="truncate text-sm text-slate-500">/,
  );
});
```

- [ ] **Step 2: 增加 SSR 布局约束**

在公开工具下载页 HTML 断言中增加：

```ts
assert.match(html, /class="muted tool-trust-meta"/);
assert.match(html, /\.tool-card-head > div \{ min-width: 0; flex: 1; \}/);
assert.match(html, /\.tool-card\.is-hot \.tool-card-head h3 \{ padding-right: 68px; \}/);
assert.match(html, /\.tool-trust-meta \{ line-height: 1\.5; overflow-wrap: anywhere; \}/);
assert.match(html, /@media \(min-width: 641px\) \{\s*\.tool-trust-meta \{ white-space: nowrap; \}/);
assert.doesNotMatch(html, /\.tool-card\.is-hot \.tool-card-head \{ padding-right: 68px; \}/);
```

- [ ] **Step 3: 运行测试并确认先失败**

Run:

```bash
npx tsx --test \
  backend/tests/toolDownloadsUi.test.ts \
  backend/tests/publicPageRoutes.test.ts
```

Expected: FAIL，指出 React 仍在整个头部使用 `pr-16` 和元信息 `truncate`，SSR 仍在整个头部预留徽标空间。

### Task 2: 同步修复 React 与 SSR 布局

**Files:**
- Modify: `src/App.tsx:4380-4405`
- Modify: `backend/src/services/publicPageRenderer.ts:1895-1910,2878-2892`

- [ ] **Step 1: 调整 React 卡片标题与元信息**

将头部改为：

```tsx
<div className="flex items-center gap-3">
  {item.icon_url ? (
    <img
      className="h-12 max-h-12 min-h-12 w-12 min-w-12 max-w-12 shrink-0 rounded-[8px] object-cover"
      src={item.icon_url}
      alt={`${item.name} 图标`}
    />
  ) : (
    <div className={`flex h-12 max-h-12 min-h-12 w-12 min-w-12 max-w-12 shrink-0 items-center justify-center rounded-[8px] text-lg font-black text-white ${iconTone}`}>
      {item.name.slice(0, 1).toUpperCase()}
    </div>
  )}
  <div className="min-w-0 flex-1">
    <h3 className={`truncate text-lg font-black text-slate-950 ${item.is_hot ? 'pr-16' : ''}`}>{item.name}</h3>
    <p className="whitespace-normal break-words text-sm leading-5 text-slate-500 sm:whitespace-nowrap">
      {buildToolDownloadTrustMeta(item)}
    </p>
  </div>
</div>
```

热门徽标节点和其他卡片内容保持不变。

- [ ] **Step 2: 调整 SSR 元信息标记**

将 SSR 元信息改为：

```ts
<p class="muted tool-trust-meta">${escapeHtml(buildToolDownloadTrustMeta(item))}</p>
```

- [ ] **Step 3: 调整 SSR 响应式 CSS**

使用：

```css
.tool-card-head { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.tool-card-head > div { min-width: 0; flex: 1; }
.tool-card.is-hot .tool-card-head h3 { padding-right: 68px; }
.tool-trust-meta { line-height: 1.5; overflow-wrap: anywhere; }
@media (min-width: 641px) {
  .tool-trust-meta { white-space: nowrap; }
}
```

删除旧的：

```css
.tool-card.is-hot .tool-card-head { padding-right: 68px; }
```

- [ ] **Step 4: 运行针对性测试**

Run:

```bash
npx tsx --test \
  backend/tests/toolDownloadsUi.test.ts \
  backend/tests/publicPageRoutes.test.ts
```

Expected: PASS，无失败测试。

- [ ] **Step 5: 提交响应式布局修复**

```bash
git add \
  src/App.tsx \
  backend/src/services/publicPageRenderer.ts \
  backend/tests/toolDownloadsUi.test.ts \
  backend/tests/publicPageRoutes.test.ts
git commit -m "fix: keep hot tool dates visible"
```

### Task 3: 生成资源与完整验证

**Files:**
- Modify: `dist/assets/index.js`
- Verify: all modified files

- [ ] **Step 1: 运行前端类型检查**

Run: `npm run lint`

Expected: exit code 0。

- [ ] **Step 2: 运行完整后端测试**

Run: `npm run test:backend`

Expected: 全部测试通过，无失败。

- [ ] **Step 3: 运行生产构建**

Run: `npm run build`

Expected: Vite 构建成功并刷新 `dist/assets/index.js`。

- [ ] **Step 4: 检查最终差异**

Run:

```bash
git diff --check
git status --short
```

Expected: `git diff --check` 无输出；状态仅包含本次布局修改及构建资源。
