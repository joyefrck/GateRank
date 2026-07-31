# GateRank 首页商业合作卡片广告标记与评分移除 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从首页商业合作卡片中移除卡片级广告标记与公开评分，同时保持区域说明、广告语义、价格、链接和营销追踪不变。

**Architecture:** 变更同时覆盖 React 首页和服务端 SSR 首页，避免首屏与客户端接管后的内容不一致。测试使用现有源代码契约与公共路由渲染用例锁定展示边界，接口、评分数据和广告业务逻辑保持不变。

**Tech Stack:** React 19、TypeScript、Node test runner、Vite、服务端模板字符串 SSR

---

## 文件结构

- 修改 `src/pages/home/HomePageV3.tsx`：删除 React 商业合作卡片的 `AD 广告` 标签和评分徽章。
- 修改 `backend/src/services/publicPageRenderer.ts`：删除 SSR 商业合作卡片的“广告”标记与公开评分输出。
- 修改 `backend/tests/frontendCrawlableLinks.test.ts`：增加 React 商业合作卡片的源代码回归约束。
- 修改 `backend/tests/publicPageRoutes.test.ts`：增加 SSR 商业合作卡片的 HTML 回归约束。
- 更新 `dist/assets/index.js` 及 Vite 生成的相关清单：保持跟踪的生产构建产物与源代码一致。

### Task 1: 建立 React 与 SSR 失败回归用例

**Files:**
- Modify: `backend/tests/frontendCrawlableLinks.test.ts:161-186`
- Modify: `backend/tests/publicPageRoutes.test.ts:61-73`

- [ ] **Step 1: 为 React 商业合作卡片添加展示边界断言**

在现有 `React homepage exposes desktop table, mobile cards, empty states, hidden scores, and sponsored links` 用例中提取 `SponsoredDealCard` 源码片段，并加入：

```ts
const sponsoredCardSource = source.slice(
  source.indexOf('function SponsoredDealCard'),
  source.indexOf('function SponsoredEmptySlot'),
);
assert.doesNotMatch(sponsoredCardSource, /AD 广告/);
assert.doesNotMatch(sponsoredCardSource, /scoreLabel\(deal\.score, deal\.score_hidden\)/);
assert.doesNotMatch(sponsoredCardSource, /<Star className=/);
```

- [ ] **Step 2: 为 SSR 商业合作卡片添加 HTML 断言**

在首页公共路由用例现有的 `sponsoredDealHtml` 断言旁加入：

```ts
assert.doesNotMatch(sponsoredDealHtml, /<b>广告<\/b>/);
assert.doesNotMatch(sponsoredDealHtml, /公开分/);
assert.doesNotMatch(sponsoredDealHtml, /91\.2/);
assert.match(sponsoredDealHtml, /<small>月付起<\/small><strong>¥12<\/strong>/);
```

- [ ] **Step 3: 运行聚焦测试并确认失败原因**

Run:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts backend/tests/publicPageRoutes.test.ts
```

Expected: FAIL；React 用例命中现有 `AD 广告`、`Star` 或 `scoreLabel`，SSR 用例命中现有 `<b>广告</b>`、`公开分`或 `91.2`。

### Task 2: 删除 React 与 SSR 的卡片级标记和评分

**Files:**
- Modify: `src/pages/home/HomePageV3.tsx:476-507`
- Modify: `backend/src/services/publicPageRenderer.ts:2052-2068`
- Test: `backend/tests/frontendCrawlableLinks.test.ts`
- Test: `backend/tests/publicPageRoutes.test.ts`

- [ ] **Step 1: 删除 React 卡片右上角广告标签**

将卡片头部改为只渲染机场标识与文字信息：

```tsx
<div className="flex items-start justify-between gap-2">
  <div className="flex min-w-0 items-center gap-2.5">
    <AirportMark name={deal.name} />
    <div className="flex min-w-0 flex-col">
      <h3 className="truncate text-[14px] font-black leading-tight text-gray-900 transition-colors group-hover:text-indigo-600 sm:text-[15px]">{deal.name}</h3>
      <span className="mt-1 font-mono text-[11.5px] leading-none text-gray-400">{deal.tracking_days} 天观察</span>
    </div>
  </div>
</div>
```

- [ ] **Step 2: 删除 React 价格行评分徽章**

将价格行改为只保留价格块：

```tsx
<div className="flex items-center justify-between">
  <div className="space-y-0.5">
    <span className="block text-[10px] font-bold leading-none text-gray-400">起步月付</span>
    <span className="font-mono text-[15px] font-black text-indigo-600">¥{formatPrice(deal.plan_price_month)} <span className="text-[10.5px] font-normal text-gray-400">/起</span></span>
  </div>
</div>
```

保留 `Star` import，因为同一文件的其它排行榜卡片仍使用该图标。

- [ ] **Step 3: 删除 SSR 卡片顶部广告标记并精简价格**

SSR 卡片顶部不再输出 `<b>广告</b>`，底部价格块改为：

```ts
<div class="home-v3-deal-bottom">
  <span><small>月付起</small><strong>¥${escapeHtml(formatPublicPrice(deal.plan_price_month))}</strong></span>
  <a href="${escapeAttribute(normalizeExternalHref(deal.website))}" target="_blank" rel="nofollow sponsored noopener noreferrer" aria-label="访问 ${escapeAttribute(deal.name)} 官网">↗</a>
</div>
```

- [ ] **Step 4: 运行聚焦测试并确认通过**

Run:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts backend/tests/publicPageRoutes.test.ts
```

Expected: 两个测试文件全部 PASS，失败数为 0。

### Task 3: 完整验证与生产构建

**Files:**
- Update: `dist/assets/index.js`
- Update: `dist/.vite/manifest.json`（仅当构建内容发生变化）
- Update: `dist/index.html`（仅当构建哈希发生变化）

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

Expected: Vite 构建以状态码 0 结束，`dist/assets/index.js` 不再包含 React 商业合作卡片的 `AD 广告` 展示节点或对应评分徽章代码。

- [ ] **Step 4: 在桌面与移动视口做页面验收**

在本地首页分别使用约 1440px 与 390px 宽度检查：

- 商业合作卡片右上角不显示 `AD 广告`。
- 价格区不显示星形评分。
- 顶部“广告展位”和“独立于机场评分”仍存在。
- 名称、价格、两个按钮对齐正常，无异常空白或横向溢出。

- [ ] **Step 5: 检查最终差异**

Run:

```bash
git diff --check
git status --short
```

Expected: `git diff --check` 无输出；变更仅包含计划文件、两处实现、两处测试和构建生成的受跟踪文件。

- [ ] **Step 6: 提交实施结果**

```bash
git add src/pages/home/HomePageV3.tsx \
  backend/src/services/publicPageRenderer.ts \
  backend/tests/frontendCrawlableLinks.test.ts \
  backend/tests/publicPageRoutes.test.ts \
  dist
git commit -m "fix: remove sponsored card ad labels and scores"
```
