# Homepage Card Runtime and Trend Label Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在首页今日推荐卡片恢复真实运行天数，并为 30 天评分折线增加可见标题，同时保持 React、SSR 和移动端一致。

**Architecture:** 不扩展接口，直接复用服务层已返回的 `item.details` 中“运行天数”。React 和 SSR 分别生成同一条趋势信息行，缺失运行天数时显示安全文案；现有折线、外链追踪和标签行为保持不变。

**Tech Stack:** React 19、TypeScript、Tailwind CSS、Express SSR、Recharts、Node test runner

---

## Execution constraints

- 仅修改首页今日推荐卡片及对应 SSR。
- 不修改 `PublicViewService` 的运行天数计算，不新增 API 字段。
- 不修改官网外链、点击处理器、测评链接、折线数据或标签数量。
- 当前工作区已包含此前首页改造的未提交修改；实施阶段不提交源码文件，避免把重叠文件中的既有改动错误拆分进新提交。

### Task 1: React 首页恢复运行天数并增加趋势标题

**Files:**

- Modify: `backend/tests/frontendCrawlableLinks.test.ts`
- Modify: `src/App.tsx:3027-3138`

- [ ] **Step 1: 写失败的源码回归断言**

在现有 `React homepage today cards use compact dotless tags and a black website CTA` 测试中增加：

```ts
assert.match(cardSource, /detail\.label === '运行天数'/);
assert.match(cardSource, /近 30 天评分趋势/);
assert.match(cardSource, /运行天数待补充/);
assert.match(cardSource, /已运行 \$\{runningDays\}/);
assert.match(cardSource, /min-h-\[312px\]/);
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts
```

Expected: 首页卡片测试因尚未读取运行天数、没有趋势标题而失败。

- [ ] **Step 3: 实现运行天数安全文案**

在 `HomeTodayPickCard` 变量区加入：

```tsx
const runningDays = item.details.find((detail) => detail.label === '运行天数')?.value;
const runningDaysText = runningDays ? `已运行 ${runningDays}` : '运行天数待补充';
```

- [ ] **Step 4: 增加信息行并保持折线高度**

将卡片最小高度改为 `min-h-[312px]`，并在标签区与折线容器之间加入：

```tsx
<div className="mt-3 flex min-h-4 items-center justify-between gap-2">
  <span className="truncate text-[10px] font-black tracking-[0.04em] text-slate-600">
    近 30 天评分趋势
  </span>
  <span className="shrink-0 whitespace-nowrap text-[10px] font-bold text-slate-400">
    {runningDaysText}
  </span>
</div>
```

将折线容器上边距从 `mt-3` 改为 `mt-1.5`，保留 `h-[58px]` 和现有 `aria-label`。

- [ ] **Step 5: 运行 React 回归**

Run:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts
npm run lint
```

Expected: 两条命令退出 0。

### Task 2: SSR 同步趋势信息行与安全降级

**Files:**

- Modify: `backend/tests/publicPageRoutes.test.ts`
- Modify: `backend/src/services/publicPageRenderer.ts:2070-2120,2790-2830`

- [ ] **Step 1: 写 SSR 失败测试**

把首页测试夹具的第一项 `details` 改为：

```ts
details: [
  { label: '运行天数', value: '64 天' },
  { label: '核心亮点', value: '性价比高' },
],
```

在首页 HTML 断言中增加：

```ts
assert.match(html, /<strong>近 30 天评分趋势<\/strong>/);
assert.match(html, /<span>已运行 64 天<\/span>/);
```

增加缺失运行天数的 SSR 测试：

```ts
test('homepage SSR safely labels a missing running-day detail', async () => {
  const missingRuntimeView: HomePageView = {
    ...homeView,
    sections: {
      ...homeView.sections,
      today_pick: {
        ...homeView.sections.today_pick,
        items: homeView.sections.today_pick.items.map((item) => ({
          ...item,
          details: [
            { label: '30 天可用率', value: '99.90%' },
            { label: '中位延迟', value: '88 ms' },
          ],
        })),
      },
    },
  };
  const app = express();
  app.use(createPublicPageRoutes({ publicViewService: createPublicViewServiceStub(missingRuntimeView) }));
  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const html = await (await fetch(`http://127.0.0.1:${port}/`)).text();
    assert.match(html, /运行天数待补充/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
```

- [ ] **Step 2: 运行 SSR 测试并确认失败**

Run:

```bash
npx tsx --test backend/tests/publicPageRoutes.test.ts
```

Expected: 新标题、运行天数和缺失降级断言失败。

- [ ] **Step 3: 实现 SSR 文案**

在 `renderHomeTodayPickCard` 中加入：

```ts
const runningDays = item.details.find((detail) => detail.label === '运行天数')?.value;
const runningDaysText = runningDays ? `已运行 ${runningDays}` : '运行天数待补充';
```

在标签与趋势摘要之间输出：

```html
<div class="home-trend-head">
  <strong>近 30 天评分趋势</strong>
  <span>${escapeHtml(runningDaysText)}</span>
</div>
```

- [ ] **Step 4: 同步 SSR 样式**

将 SSR 卡片最小高度改为 312px，增加：

```css
.home-trend-head { display:flex; min-height:16px; align-items:center; justify-content:space-between; gap:8px; margin-top:12px; }
.home-trend-head strong { overflow:hidden; color:#475569; font-size:10px; letter-spacing:.04em; text-overflow:ellipsis; white-space:nowrap; }
.home-trend-head span { flex:0 0 auto; color:#94a3b8; font-size:10px; font-weight:700; white-space:nowrap; }
```

将 `.home-trend-summary` 的 `margin-top` 从 10px 改为 6px，保留 58px 最小高度。

- [ ] **Step 5: 运行 SSR 回归**

Run:

```bash
npx tsx --test backend/tests/publicPageRoutes.test.ts
```

Expected: 全部用例通过。

### Task 3: 完整验证与视觉 QA

**Files:**

- Modify: `design-qa.md`

- [ ] **Step 1: 运行自动化验证**

Run:

```bash
npx tsx --test src/components/TagBadge.test.tsx backend/tests/frontendCrawlableLinks.test.ts backend/tests/publicPageRoutes.test.ts backend/tests/publicViewService.test.ts
npm run lint
npm run server:typecheck
npm run test:backend
npm run build
git diff --check
```

Expected:

- 聚焦测试、`lint`、全部后端测试、构建和 `git diff --check` 退出 0。
- 如果 `server:typecheck` 仍只报告当前已记录的既有错误，保留原始错误证据并在 QA 报告中单独说明，不修改无关文件。

- [ ] **Step 2: 桌面与手机浏览器验收**

在应用内浏览器检查 `http://127.0.0.1:3000/`：

- 1440px：标题与运行天数同排、折线高度保持、卡片等高、双按钮不被挤压。
- 390px：卡片仍为 86vw，信息行不换行，整体页面无横向溢出。
- 缺失趋势时仍可看到标题和“暂无趋势”。
- 浏览器控制台无 warning/error。

- [ ] **Step 3: 更新 QA 证据**

通过 `apply_patch` 更新 `design-qa.md`，加入本轮参考图、桌面/手机截图、重点对照、DOM/计算样式、测试结果和比较历史，最后一行保持：

```md
final result: passed
```

