# Homepage Today Card Button and Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将首页“今日推荐”卡片的“访问官网”按钮恢复为黑色，并把最多 3 个标签缩小、去掉标签内圆点，同时保证其他页面的标签样式不变。

**Architecture:** 通过扩展共享 `TagBadge` 的可选展示参数实现首页局部定制，默认行为保持兼容；React 首页显式使用紧凑无圆点样式，服务端公开页渲染器输出对应的小标签结构和黑色按钮，避免首屏样式切换。现有链接、外链追踪、点击计费和首页数据契约均不改动。

**Tech Stack:** React 19、TypeScript、Tailwind CSS、Express SSR、Node test runner（`tsx --test`）

---

## Execution constraints

- 仅修改首页“今日推荐”区域；其他页面继续通过 `TagBadge` 默认值显示圆点。
- 不改 `onClick={createTrackedOutboundClickHandler(...)}`、官网外链地址或测评链接。
- 标签仍使用 `item.tags.slice(0, 3)`，不得减少为 1 或 2 个。
- 当前检出目录已有本轮首页改造的未提交修改。每次提交前必须先执行 `git diff --cached --stat` 和 `git diff --cached`，不得把无关构建产物、依赖目录或用户修改带入提交。

### Task 1: 为共享 TagBadge 增加紧凑无圆点能力

**Files:**

- Modify: `src/components/TagBadge.test.tsx`
- Modify: `src/components/TagBadge.tsx:3-10,160-184`

- [ ] **Step 1: 写出失败测试**

在 `src/components/TagBadge.test.tsx` 新增测试，直接调用组件并检查输出结构：

```tsx
test('xs tag badge can hide its decorative dot', () => {
  const element = TagBadge({
    tag: '风险观察',
    size: 'xs',
    showDot: false,
  });

  assert.match(String(element.props.className || ''), /text-\[10px\]/);
  assert.equal(element.props.children[0], null);
  assert.equal(element.props.children[1].props.children, '风险观察');
});

test('tag badge keeps its dot by default', () => {
  const element = TagBadge({ tag: '稳定' });

  assert.notEqual(element.props.children[0], null);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npx tsx --test src/components/TagBadge.test.tsx
```

Expected: 新增的 `xs` / `showDot` 用例因属性尚未定义或子元素数量不符而失败。

- [ ] **Step 3: 实现最小 API 扩展**

在 `TagBadgeProps` 和组件中加入：

```tsx
type TagBadgeSize = 'xs' | 'sm' | 'md';

interface TagBadgeProps {
  key?: React.Key;
  tag: string;
  size?: TagBadgeSize;
  showDot?: boolean;
  className?: string;
}

export function TagBadge({
  tag,
  size = 'md',
  showDot = true,
  className = '',
}: TagBadgeProps) {
  const sizeClassName = size === 'xs'
    ? 'gap-1 px-2 py-0.5 text-[10px] tracking-[0.04em]'
    : size === 'sm'
      ? 'gap-1.5 px-2.5 py-1 text-[11px] tracking-[0.08em]'
      : 'gap-2 px-3 py-1.5 text-[11px] md:text-xs tracking-[0.1em]';

  const tone = getTagBadgeTone(tag);

  return (
    <span
      className={[
        'inline-flex max-w-full items-center rounded-full border font-black whitespace-nowrap transition-transform duration-200 hover:-translate-y-0.5',
        sizeClassName,
        tone.className,
        className,
      ].join(' ')}
    >
      {showDot ? (
        <span
          aria-hidden="true"
          className={['h-1.5 w-1.5 shrink-0 rounded-full', tone.dotClassName].join(' ')}
        />
      ) : null}
      <span className="truncate">{tag}</span>
    </span>
  );
}
```

`showDot` 默认必须为 `true`，从而不影响所有既有调用点。

- [ ] **Step 4: 运行组件测试**

Run:

```bash
npx tsx --test src/components/TagBadge.test.tsx
```

Expected: 全部用例通过。

- [ ] **Step 5: 检查范围并提交独立组件改动**

Run:

```bash
git diff -- src/components/TagBadge.tsx src/components/TagBadge.test.tsx
git add src/components/TagBadge.tsx src/components/TagBadge.test.tsx
git diff --cached --stat
git diff --cached
git commit -m "feat: add compact dotless tag badges"
```

Expected: 暂存区只包含 `TagBadge` 及其测试。

### Task 2: 调整 React 首页今日推荐卡片

**Files:**

- Modify: `src/App.tsx:3083-3087,3125-3127`
- Modify: `backend/tests/frontendCrawlableLinks.test.ts:112-145`

- [ ] **Step 1: 写出首页源码回归测试**

在 `backend/tests/frontendCrawlableLinks.test.ts` 中读取 `src/App.tsx`，截取 `function HomeTodayPickCard` 到 `function HomeQuickLinks`，加入：

```ts
test('React homepage today cards use compact dotless tags and a black website CTA', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/App.tsx'), 'utf8');
  const start = source.indexOf('function HomeTodayPickCard');
  const end = source.indexOf('function HomeQuickLinks', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const cardSource = source.slice(start, end);

  assert.match(cardSource, /item\.tags\.slice\(0, 3\)/);
  assert.match(cardSource, /<TagBadge[\s\S]*?size="xs"[\s\S]*?showDot=\{false\}[\s\S]*?\/>/);
  assert.match(cardSource, /bg-slate-950/);
  assert.match(cardSource, /hover:bg-slate-800/);
  assert.match(cardSource, /createTrackedOutboundClickHandler/);
  assert.doesNotMatch(cardSource, /bg-blue-600/);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts
```

Expected: 新增首页卡片测试因仍使用默认标签和蓝色按钮而失败。

- [ ] **Step 3: 仅修改首页标签调用**

把首页标签容器和调用改为：

```tsx
<div className="mt-3 flex min-h-5 gap-1 overflow-hidden">
  {item.tags.slice(0, 3).map((tag) => (
    <TagBadge
      key={tag}
      tag={tag}
      size="xs"
      showDot={false}
      className="min-w-0 max-w-full truncate"
    />
  ))}
</div>
```

如果源码回归测试使用单行正则，应按最终 JSX 格式调整为允许空白的正则；不要为了测试牺牲可读性。容器不换行，单个过长标签通过 `truncate` 收敛，仍保留最多 3 个 DOM 标签。

- [ ] **Step 4: 将访问官网按钮改成黑色**

仅替换视觉类，保留按钮内容、`href`、`target`、`rel` 和点击处理器：

```tsx
className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[8px] bg-slate-950 px-2.5 text-xs font-black text-white shadow-[0_10px_22px_rgba(15,23,42,0.18)] transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-300"
```

- [ ] **Step 5: 运行首页源码测试和类型检查**

Run:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts
npm run lint
```

Expected: 两条命令均退出 0。

- [ ] **Step 6: 复核差异**

Run:

```bash
git diff -- src/App.tsx backend/tests/frontendCrawlableLinks.test.ts
```

Expected: `src/App.tsx` 中本次新增差异只涉及今日推荐标签与官网按钮；外链追踪代码没有变化。由于 `src/App.tsx` 已包含此前未提交的首页改造，不在确认完整文件差异前单独提交该文件。

### Task 3: 同步服务端公开页 HTML 与样式

**Files:**

- Modify: `backend/src/services/publicPageRenderer.ts:2090-2110,2804-2810`
- Modify: `backend/tests/publicPageRoutes.test.ts:14-110`

- [ ] **Step 1: 写出 SSR 失败测试**

在首页分支的现有断言中增加：

```ts
assert.match(html, /class="home-today-tags">[\s\S]*<span title="稳定">稳定<\/span>[\s\S]*<span title="高速">高速<\/span>[\s\S]*<span title="流媒体">流媒体<\/span>/);
assert.doesNotMatch(html, /class="home-today-tags">[^<]*·/);
assert.match(html, /\.home-website-button\s*\{\s*background:\s*#0f172a;/);
assert.match(html, /\.home-website-button:hover\s*\{\s*background:\s*#1e293b;/);
```

并在 `homeView.sections.today_pick.items[0].tags` 测试夹具中加入第三个标签，例如 `['稳定', '高速', '流媒体']`，再断言三个独立 `<span>` 均可抓取。

- [ ] **Step 2: 运行 SSR 路由测试确认失败**

Run:

```bash
npx tsx --test backend/tests/publicPageRoutes.test.ts
```

Expected: 首页标签结构和黑色按钮 CSS 断言失败。

- [ ] **Step 3: 输出三个独立的小标签**

把字符串拼接的中点分隔文本替换为独立标签：

```ts
const visibleTags = item.tags.slice(0, 3);
const tagsMarkup = visibleTags.length > 0
  ? visibleTags
      .map((tag) => `<span title="${escapeAttribute(tag)}">${escapeHtml(tag)}</span>`)
      .join('')
  : '<span class="home-today-tag-empty">标签待补充</span>';
```

模板中使用：

```html
<div class="home-today-tags">${tagsMarkup}</div>
```

不得输出装饰圆点或 `·` 分隔符。

- [ ] **Step 4: 同步 SSR 样式**

用以下规则替换当前纯文本标签与蓝色按钮样式：

```css
.home-today-tags {
  display: flex;
  min-height: 20px;
  gap: 4px;
  margin: 12px 0 0;
  overflow: hidden;
}
.home-today-tags > span {
  min-width: 0;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  background: #f8fafc;
  padding: 2px 7px;
  color: #64748b;
  font-size: 10px;
  font-weight: 800;
  line-height: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.home-website-button { background: #0f172a; color: #fff; }
.home-website-button:hover { background: #1e293b; }
```

- [ ] **Step 5: 运行 SSR 回归测试和后端类型检查**

Run:

```bash
npx tsx --test backend/tests/publicPageRoutes.test.ts
npm run server:typecheck
```

Expected: 两条命令均退出 0。

- [ ] **Step 6: 复核 React / SSR 一致性**

确认两端都满足：

- 官网按钮默认黑色、悬停深灰黑。
- 标签最多 3 个、10px、无圆点。
- 缺少标签时仍显示“标签待补充”。
- 官网和测评链接不变。

Run:

```bash
git diff -- src/App.tsx src/components/TagBadge.tsx backend/src/services/publicPageRenderer.ts backend/tests/frontendCrawlableLinks.test.ts backend/tests/publicPageRoutes.test.ts
```

### Task 4: 完整验证与视觉验收

**Files:**

- Modify: `design-qa.md`

- [ ] **Step 1: 运行完整自动化验证**

Run:

```bash
npm run lint
npm run server:typecheck
npm run test:backend
npm run build
```

Expected: 所有命令退出 0；如遇已有基线失败，必须记录精确命令、错误和本次聚焦测试结果，不得将基线债务误报为本次回归。

- [ ] **Step 2: 确认本地服务状态**

优先使用已经运行的 `http://127.0.0.1:3000`；如果未运行，再分别启动：

```bash
npm run server:dev
npm run dev
```

Expected: 后端与 Vite 页面均可访问，首页数据正常加载。

- [ ] **Step 3: 桌面视觉验收**

使用应用内浏览器打开 `http://127.0.0.1:3000`，在约 1440px 宽度检查：

- “访问官网”为接近 `#0f172a` 的黑色，悬停变为 `#1e293b`。
- 有 3 个标签的数据卡能同时显示 3 个小标签。
- 标签内部没有圆点，标签本身仍为圆角胶囊。
- “查看测评”按钮、趋势图和卡片高度未被挤压。

- [ ] **Step 4: 手机视觉验收**

在 390px 宽度检查：

- 横向吸附滑动仍可用，页面整体没有横向溢出。
- 两个按钮均可点击且没有文字截断。
- 三个短标签可同排；长标签截断而不撑宽卡片。

- [ ] **Step 5: 更新视觉验收记录**

通过 `apply_patch` 更新根目录 `design-qa.md`，记录桌面与手机检查、按钮颜色、三标签和无圆点结果，并确保最终状态为：

```md
result: passed
```

- [ ] **Step 6: 最终工作区检查**

Run:

```bash
git status --short --branch
git diff --check
```

Expected: `git diff --check` 无输出；工作区中无意外新增构建产物。不要部署生产环境。
