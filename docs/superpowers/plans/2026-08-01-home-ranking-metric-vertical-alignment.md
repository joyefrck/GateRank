# GateRank 首页排行榜关键列垂直居中 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让首页桌面排行榜的排名、GateRank 分、月付价格和观察时长四列在每一行内上下居中，同时保持其它列和移动端不变。

**Architecture:** React 表格直接在四个目标 `<td>` 上使用 Tailwind `align-middle`；SSR 首页表格通过限定到 `.home-v3-table-wrap td` 的 `vertical-align: middle` 保持首屏一致。测试分别锁定 React 目标单元格数量和 SSR 专用样式，不改变任何数据契约。

**Tech Stack:** React 19、TypeScript、Tailwind CSS、Node test runner、Vite、服务端模板字符串 SSR

---

## 文件结构

- 修改 `src/pages/home/HomePageV3.tsx`：给 `RankingTableRow` 的四个目标单元格添加 `align-middle`。
- 修改 `backend/src/services/publicPageRenderer.ts`：给 SSR 首页排行榜正文单元格添加专用垂直居中样式。
- 修改 `backend/tests/frontendCrawlableLinks.test.ts`：锁定 React 目标单元格的对齐类数量和排名列文本对齐。
- 修改 `backend/tests/publicPageRoutes.test.ts`：锁定 SSR 首页排行榜的垂直居中样式。
- 更新 `dist/assets/index.js` 和 `dist/assets/index.css`：保持生产构建产物与源代码一致。

### Task 1: 建立垂直对齐失败回归用例

**Files:**
- Modify: `backend/tests/frontendCrawlableLinks.test.ts:161-198`
- Modify: `backend/tests/publicPageRoutes.test.ts:45-80`

- [ ] **Step 1: 增加 React 目标单元格契约断言**

在首页 React 源代码用例中截取 `RankingTableRow`：

```ts
const rankingTableRowSource = source.slice(
  source.indexOf('function RankingTableRow'),
  source.indexOf('function RankingMobileCard'),
);
const verticallyCenteredRankingCells = rankingTableRowSource.match(/<td className="align-middle px-4 py-4(?: text-center)?">/g) || [];
assert.equal(verticallyCenteredRankingCells.length, 4);
assert.match(rankingTableRowSource, /<td className="align-middle px-4 py-4 text-center"><RankBadge/);
```

这确保只有框选的四个单元格使用目标类，并确认排名列同时保留水平居中。

- [ ] **Step 2: 增加 SSR 首页排行榜样式断言**

在首页公共路由 HTML 用例中加入：

```ts
assert.match(html, /\.home-v3-table-wrap td\s*\{[^}]*vertical-align:\s*middle;/);
```

- [ ] **Step 3: 运行聚焦测试并确认失败**

Run:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts backend/tests/publicPageRoutes.test.ts
```

Expected: FAIL；React 用例找到 0 个目标 `align-middle` 单元格，SSR 用例找不到专用 `vertical-align: middle`。

### Task 2: 实施 React 与 SSR 垂直居中

**Files:**
- Modify: `src/pages/home/HomePageV3.tsx:593-623`
- Modify: `backend/src/services/publicPageRenderer.ts:3480`
- Test: `backend/tests/frontendCrawlableLinks.test.ts`
- Test: `backend/tests/publicPageRoutes.test.ts`

- [ ] **Step 1: 给排名单元格添加垂直居中**

```tsx
<td className="align-middle px-4 py-4 text-center"><RankBadge rank={item.rank} /></td>
```

- [ ] **Step 2: 给评分和价格单元格添加垂直居中**

两处起始标签改为：

```tsx
<td className="align-middle px-4 py-4">
```

内部评分、涨跌、价格和月付文案结构保持不变。

- [ ] **Step 3: 给观察时长单元格添加垂直居中**

```tsx
<td className="align-middle px-4 py-4"><span className="font-mono text-[14.5px] font-bold text-gray-700">{observationDays(item.created_at, date, false)}</span></td>
```

- [ ] **Step 4: 给 SSR 首页排行榜添加专用垂直居中样式**

```css
.home-v3-table-wrap td { color: #404040; font-size: 12px; vertical-align: middle; }
```

- [ ] **Step 5: 运行聚焦测试并确认通过**

Run:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts backend/tests/publicPageRoutes.test.ts
```

Expected: 两个测试文件全部 PASS，失败数为 0。

### Task 3: 完整验证、构建与浏览器验收

**Files:**
- Update: `dist/assets/index.js`
- Update: `dist/assets/index.css`

- [ ] **Step 1: 运行前后端类型检查**

Run:

```bash
npm run lint
npm run server:typecheck
```

Expected: 两条命令均以状态码 0 结束。

- [ ] **Step 2: 运行完整后端测试**

Run:

```bash
npm run test:backend
```

Expected: 所有测试 PASS，失败数为 0。

- [ ] **Step 3: 生成生产构建**

Run:

```bash
npm run build
```

Expected: Vite 构建以状态码 0 结束，并更新受跟踪的 `dist` 产物。

- [ ] **Step 4: 在桌面视口测量目标列几何中心**

在 1440px 宽度打开本地首页，读取首行索引为 0、2、3、4 的四个目标 `<td>`，对每个单元格计算：

```ts
Math.abs(
  (contentRect.top + contentRect.bottom) / 2
  - (cellRect.top + cellRect.bottom) / 2,
)
```

Expected: 四列内容中心与单元格中心的偏差不超过 2px；排名徽章、评分组合、价格组合和观察时长视觉上均上下居中。

- [ ] **Step 5: 验证移动端未回归**

在 390px 视口确认页面无横向溢出，`data-testid="home-ranking-mobile"` 的既有隐藏/布局行为不变。

- [ ] **Step 6: 检查并提交差异**

Run:

```bash
git diff --check
git status --short
```

Expected: 差异仅包含两处实现、两处测试、计划文档和构建生成的受跟踪文件。

提交：

```bash
git add src/pages/home/HomePageV3.tsx \
  backend/src/services/publicPageRenderer.ts \
  backend/tests/frontendCrawlableLinks.test.ts \
  backend/tests/publicPageRoutes.test.ts \
  dist
git commit -m "fix: center homepage ranking metrics vertically"
```
