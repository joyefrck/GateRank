# GateRank 首页视觉验收

## Source visual truth

- 原始首页布局参考：`/var/folders/vb/rrtsjfg94bb2d86gl6pg62kr0000gn/T/codex-clipboard-74b4da7a-672d-40b9-bea7-e994c2328557.png`
  - 像素：1550 × 1150。
- 本次修改前页面参考：`/var/folders/vb/rrtsjfg94bb2d86gl6pg62kr0000gn/T/codex-clipboard-32f9d030-8c88-4462-8c95-b0553a51e078.png`
  - 像素：2940 × 1912。
  - 用户文字修订优先于截图：官网按钮恢复黑色；标签缩小；最多保留 3 个；仅首页移除标签内圆点。

## Implementation evidence

- 桌面实现：`/Users/joyefrack/.codex/visualizations/2026/07/30/019fb38f-a531-7ce2-9685-7efdcfb3a1ff/gaterank-home-qa-2026-07-31/desktop-1440-viewport.jpg`
  - 浏览器 CSS 视口：1440 × 1200。
  - 截图像素：1440 × 1121；浏览器截图接口裁去不可见的应用外层区域，页面内容密度为 1x。
- 手机实现：`/Users/joyefrack/.codex/visualizations/2026/07/30/019fb38f-a531-7ce2-9685-7efdcfb3a1ff/gaterank-home-qa-2026-07-31/mobile-390-viewport.jpg`
  - CSS 视口与截图像素：390 × 844，1x。
- 全页并排对照：`/Users/joyefrack/.codex/visualizations/2026/07/30/019fb38f-a531-7ce2-9685-7efdcfb3a1ff/gaterank-home-qa-2026-07-31/comparison-full.jpg`
- 今日推荐卡片重点对照：`/Users/joyefrack/.codex/visualizations/2026/07/30/019fb38f-a531-7ce2-9685-7efdcfb3a1ff/gaterank-home-qa-2026-07-31/comparison-card-detail.jpg`
- 状态：默认首页、真实本地 API 数据、未伪造机场或标签。

## Findings

- 没有 P0、P1 或 P2 问题。
- 官网按钮：
  - React 计算样式为 `oklch(0.129 0.042 264.695)`，对应 Tailwind `slate-950`；文字为白色。
  - SSR 使用 `#0f172a`，悬停使用 `#1e293b`。
  - 官网地址仍为 `/api/v1/outbound/airports/:id?target=website&placement=home_card`，原点击追踪处理器未改。
- 首页标签：
  - 计算字号为 10px，高度为 21px，间距比修改前更紧凑。
  - 每个标签只有一个文本子元素，不存在 6px 装饰圆点。
  - React 和 SSR 均保留 `slice(0, 3)`；SSR 三标签夹具与源码回归测试通过。
  - 当前真实 API 卡片最多返回 2 个标签，因此没有为视觉验收伪造第三个标签。
- 手机端：
  - 卡片宽度 335.4px，即 390px 视口的 86vw。
  - 横向容器 `overflow-x: auto`、`scroll-snap-type: x mandatory`，滚动宽度 1062px。
  - 页面文档宽度等于 390px，无整体横向溢出。
  - 官网与测评按钮的 `scrollWidth` 等于 `clientWidth`，文字未被裁切。
- 浏览器控制台没有 warning 或 error。

## Required fidelity surfaces

- 字体与排版：沿用现有字体、标题和数字字重；仅将首页标签收紧到 10px，没有影响卡片信息层级。
- 间距与布局节奏：标签区从可换行大胶囊调整为单行紧凑布局；卡片维持 292px 高度，趋势区和双按钮没有位移或拥挤。
- 颜色与视觉 token：主按钮恢复为现有站点黑色 CTA 系统；标签继续保留原语义色，仅移除圆点。
- 图片与资产质量：本次区域没有新增或替换图片资产；折线图和既有图标保持原实现。
- 文案与内容：名称、评分、价格、增减、标签、按钮文案和链接均未改。

## Comparison history

1. 2026-07-30 基础首页改造：修正手机卡片宽度、键盘焦点、首屏文案一致性、快捷入口移动端网格和 reduced-motion，最终通过。
2. 2026-07-31 本次迭代：
   - 修改前：官网按钮为蓝色；标签较大且包含圆点。
   - 修复：React 与 SSR 官网按钮改黑色；`TagBadge` 增加兼容的 `xs` / `showDot` 参数，首页使用 10px 无圆点标签。
   - 修复后证据：桌面和手机截图、卡片重点对照、计算样式与 DOM 结构检查均无 P0/P1/P2 问题。

## Interaction and regression evidence

- `npx tsx --test src/components/TagBadge.test.tsx`：4/4 通过。
- `npx tsx --test backend/tests/frontendCrawlableLinks.test.ts`：12/12 通过。
- `npx tsx --test backend/tests/publicPageRoutes.test.ts`：30/30 通过。
- `npm run test:backend`：729/729 通过。
- `npm run lint`：通过。
- `npm run build`：通过。
- `npm run server:typecheck`：被既有类型债务阻塞；错误位于本次未修改的工具路由测试、公开站点 DOM 类型以及 `publicPageRoutes.test.ts` 另一处旧断言，不属于本次变更。

## Follow-up polish

- 无必须处理的 P3 项。

## 2026-07-31 运行天数与趋势说明迭代

### Source visual truth

- 用户修订参考：`/var/folders/vb/rrtsjfg94bb2d86gl6pg62kr0000gn/T/codex-clipboard-90b0edd3-3703-425a-b52d-d552be1c3cc4.png`
  - 原始像素：2786 × 1582。
  - 用户确认方案 A：标签下方同一行，左侧“近 30 天评分趋势”，右侧“已运行 N 天”，折线图位于下一行。

### Implementation evidence

- 桌面实现：`/Users/joyefrack/.codex/visualizations/2026/07/30/019fb38f-a531-7ce2-9685-7efdcfb3a1ff/gaterank-home-runtime-trend-2026-07-31/desktop-1440x1200-settled.jpg`
- 手机实现：`/Users/joyefrack/.codex/visualizations/2026/07/30/019fb38f-a531-7ce2-9685-7efdcfb3a1ff/gaterank-home-runtime-trend-2026-07-31/mobile-390x844-settled.jpg`
- 参考图与实现卡片对照：`/Users/joyefrack/.codex/visualizations/2026/07/30/019fb38f-a531-7ce2-9685-7efdcfb3a1ff/gaterank-home-runtime-trend-2026-07-31/reference-vs-implementation.jpg`

### Findings

- 没有 P0、P1 或 P2 问题。
- 运行天数复用首页卡片既有 `details` 中的真实“运行天数”字段；React 与 SSR 缺失时统一显示“运行天数待补充”。
- 桌面端标题与“已运行 89 天”在同一行，均为 `nowrap`；三张真实卡片高度均为 312px，折线区域保持 58px。
- 1440px 桌面网格计算为五列 `240px`，当前真实接口只有三张推荐卡片，因此仅显示三张。
- 390px 手机端卡片宽 335.4px，等于 86vw；页面文档宽度等于 390px，无整体横向溢出。
- 手机端两个按钮均为 40px 高，宽度约 146.7px，未被新增说明行挤压或裁切。
- 浏览器控制台没有 warning 或 error。

### Interaction and regression evidence

- 聚焦回归测试：71/71 通过。
- `npm run lint`：通过。
- `npm run test:backend`：730/730 通过。
- `npm run build`：通过；仅保留既有大分块提示。
- `git diff --check`：通过。
- `npm run server:typecheck`：仍被既有类型债务阻塞；错误集中于工具路由测试的隐式 `any`、公开站点缺失 DOM/React 类型以及 `publicPageRoutes.test.ts` 的旧 `unknown` 断言，本次新增的运行天数与趋势实现没有新增类型错误。

final result: passed

## 2026-07-31 首页广告活动标题提示位置

### Source visual truth

- 用户标注截图：`/var/folders/vb/rrtsjfg94bb2d86gl6pg62kr0000gn/T/codex-clipboard-90b1f56c-4fa2-431c-bd8d-f9268d9b8c1b.png`
- 原始像素：1844 × 1328。
- 目标状态：选择“投放首页”后，`显示在首页广告描述中。` 紧跟在“活动标题”标签右侧；普通优惠活动不显示该提示。

### Implementation evidence

- 浏览器实现截图：`/Users/joyefrack/.codex/visualizations/2026/07/31/019fb774-582c-7e30-a056-f184e2c12651/activity-title-helper-implementation.png`
- 同尺寸并排对照：`/Users/joyefrack/.codex/visualizations/2026/07/31/019fb774-582c-7e30-a056-f184e2c12651/activity-title-helper-comparison.png`
- 浏览器 CSS 视口：1844 × 1329；实现截图像素：1844 × 1328，截图接口归一化为 CSS 1x。
- 状态：本地申请人后台已登录，新建投放弹窗打开并选择“投放首页”；未填写表单、未扣费、未提交。

### Findings

- 没有 P0、P1 或 P2 问题。
- “活动标题”与提示语由同一个 `flex` 标签行承载，浏览器测量两者顶部均为 709.8984375px、底部均为 725.8984375px，提示与标题间距为 8px。
- 普通优惠活动状态下提示不存在；切换“投放首页”后提示显示且输入框位于标签行下方。
- 全视图并排对照可以清楚辨认目标标签区域，因此不需要额外裁切重点区域；DOM 几何测量作为同一行的补充证据。

### Required fidelity surfaces

- 字体与排版：提示使用现有 12px 中等字重，标题继续使用原有粗体、字距和大写规则；提示单独恢复正常字距。
- 间距与布局节奏：提示移到标签右侧后，输入框与下一字段之间不再多占一行，标签与输入框的原有 8px 间距保持不变。
- 颜色与视觉 token：提示继续使用现有 cyan-700 语义色，其他字段颜色不变。
- 图片与资产质量：本轮没有新增、替换或伪造图片与图标资产。
- 文案与内容：提示文字保持 `显示在首页广告描述中。`，并继续仅受 `form.is_homepage` 控制。

### Comparison history

1. 修改前提示位于活动标题输入框下方，和用户箭头标注不符。
2. 为通用字段组件增加可选标题后缀，将提示放入活动标题标签行；其他字段不传后缀，布局保持不变。
3. 同尺寸并排截图和 DOM 几何复核均确认提示紧跟标题右侧，没有遗留 P0/P1/P2。

### Interaction and regression evidence

- 普通优惠活动 → 首页广告切换已在已登录 Chrome 会话中实测，提示按条件隐藏和显示。
- `node --import tsx --test backend/tests/frontendCrawlableLinks.test.ts`：16/16 通过。
- `npm run lint`、`npm run build` 与 `git diff --check`：通过；构建仅保留既有的大分块提示。

final result: passed

## 2026-07-31 页脚方格背景与广告官网外链修正

### Source visual truth

- 可运行设计稿：`/Users/joyefrack/Documents/GitHub/GateRank/gaterank-3.0`
- 设计稿页脚：`gaterank-3.0/src/components/Footer.tsx`
- 方格 token：`gaterank-3.0/src/index.css` 中的 30px `grid-bg`。
- 用户明确要求：最底部区域恢复与 UI 一致的方格背景；广告“官网”必须打开真实官网，不能落到本地站内路径。

### Implementation evidence

- 设计稿页脚截图：`/Users/joyefrack/.codex/visualizations/2026/07/31/019fb658-7b2d-7fd0-80d6-c3f718f656a5/gaterank-footer-grid-external-link/reference-footer-1470x433.png`
- 正式实现页脚截图：`/Users/joyefrack/.codex/visualizations/2026/07/31/019fb658-7b2d-7fd0-80d6-c3f718f656a5/gaterank-footer-grid-external-link/implementation-footer.png`
- 同状态并排对照：`/Users/joyefrack/.codex/visualizations/2026/07/31/019fb658-7b2d-7fd0-80d6-c3f718f656a5/gaterank-footer-grid-external-link/comparison-footer.png`
- 设计稿 CSS 视口为 1470 × 900、DPR 1，页脚高度 434px；正式实现 CSS 视口为 1470 × 741、DPR 2，页脚高度 433.5px。
- 浏览器截图均归一化为 CSS 1x；设计稿页脚裁切到 1470 × 433 后，与正式实现 1470 × 433 并排比较。
- 外链交互实测：广告卡 `href` 为 `https://www.xiaomi.com`；点击后新标签打开并由官网重定向到 `https://www.mi.com/`。

### Findings

- 初始正式页脚本体的计算样式为 `background-image: none`，只有 24px 圆点覆盖层；因此没有设计稿清晰可见的 30px 方格。
- 正式 React 页脚已恢复两层 30px 线性方格，并保留设计稿原有的 24px 圆点覆盖层；SSR 页脚输出同等方格与圆点背景。
- 初始广告链接属性为 `www.xiaomi.com`，浏览器解析结果为 `http://127.0.0.1:3000/www.xiaomi.com`。
- 根因是首页广告卡没有复用活动页和 SSR 已有的外链规范化语义。现由公开页面共享方法统一将裸域名规范为 HTTPS，并同时用于链接 `href` 和营销统计 `target_url`。
- 页脚并排对照确认方格密度、颜色、背景叠层、上下间距和品牌内容区域与设计稿一致；导航入口差异来自此前用户要求补充“月度报告”和“工具”，属于已确认内容差异。

### Required fidelity surfaces

- 字体与排版：页脚品牌、说明、导航与版权排版未改变。
- 间距与布局节奏：正式页脚 433.5px 与设计稿 434px 等高，16px 子像素舍入差异不影响视觉。
- 颜色与视觉 token：使用设计稿 `rgba(0,0,0,.03)`、30px 方格以及 24px 浅灰圆点叠层。
- 图片与资产质量：没有新增、替换或伪造任何图片和图标。
- 文案与内容：保留当前真实导航和免责声明；仅修正外链协议，不修改广告数据或统计字段含义。

### Comparison history

1. 初始复现确认两个 P1/P2：广告官网被解析为本地相对路径；页脚缺少方格背景。
2. 增加共享外链规范化并应用于首页广告与活动页，React/SSR 页脚同步恢复 30px 方格。
3. 浏览器实点广告官网成功进入小米官网；同尺寸页脚并排对照没有遗留 P0/P1/P2。

final result: passed

## 2026-07-31 导航补全、安全宽度与信任区菜单去重

### Source visual truth

- 用户标注截图：`/var/folders/vb/rrtsjfg94bb2d86gl6pg62kr0000gn/T/codex-clipboard-dc699758-0eef-45fc-9323-4be1d6d5eea6.png`
- 可运行设计稿：`/Users/joyefrack/Documents/GitHub/GateRank/gaterank-3.0`
- 本轮明确要求：顶部与页脚补回“月度报告”和“工具”，导航左右边界对齐内容安全宽度，并移除信任区下方与页脚重复的菜单。

### Implementation evidence

- 顶部完整导航：`/Users/joyefrack/.codex/visualizations/2026/07/31/019fb658-7b2d-7fd0-80d6-c3f718f656a5/gaterank-navigation-completion/header-full-navigation.png`
- 信任区去重结果：`/Users/joyefrack/.codex/visualizations/2026/07/31/019fb658-7b2d-7fd0-80d6-c3f718f656a5/gaterank-navigation-completion/trust-without-duplicate-menu.png`
- 页脚完整导航：`/Users/joyefrack/.codex/visualizations/2026/07/31/019fb658-7b2d-7fd0-80d6-c3f718f656a5/gaterank-navigation-completion/footer-full-navigation.png`
- 重复菜单前后对照：`/Users/joyefrack/.codex/visualizations/2026/07/31/019fb658-7b2d-7fd0-80d6-c3f718f656a5/gaterank-navigation-completion/comparison-duplicate-menu-removal.png`
- 浏览器 CSS 视口：1470 × 900；截图像素：1470 × 900，截图已归一化为 CSS 1x。

### Findings

- 原顶部导航和页脚分别通过过滤条件排除了 `monthly_reports` 与 `tools`；现已统一直接消费共享公开导航配置，不再存在两套遗漏规则。
- 桌面导航原先始终使用 16px 内边距，与首页 32px 内容安全边界不一致；现改为 16px、24px、32px 的响应式安全边距。1470px 视口下品牌左边界为 127px、操作区右边界为 1343px，与内容安全边界完全一致。
- 1200px 宽度下完整菜单会与右侧操作区发生约 3px 重叠；桌面完整导航断点调整为 1240px。1240px 下菜单与操作区保留约 37px 间隔，1199px 和 1200px 下使用抽屉导航，均无横向溢出。
- 顶部现在包含：首页、机场排行、月度报告、活动优惠、跑路监测快照、测评方法、工具、News。
- 页脚现在包含：首页、机场排行、月度报告、活动优惠、跑路监测、测评方法、工具、News、申请入驻。
- “为什么选择 GateRank?” 下方原有 7 项硬编码深度链接已经移除；该区域直接衔接 FAQ，不再与最底部导航重复。

### Required fidelity surfaces

- 字体与排版：沿用 3.0 导航和页脚的字号、字重、行高及选中态。
- 间距与布局节奏：顶部容器宽度保持 1280px，并让导航内容与页面主体共享同一响应式安全边界。
- 颜色与视觉 token：没有改变现有导航、按钮、信任卡或页脚的颜色与交互 token。
- 图片与资产质量：本轮未新增位图或占位资产。
- 文案与内容：月度报告、工具及其真实 URL 均来自共享导航配置；没有新增演示链接或弹窗。

### Comparison history

1. 初始复核确认顶部与页脚遗漏两个入口，桌面导航边界超出主体安全宽度，信任区存在与页脚重复的 7 项链接。
2. 统一顶部和页脚链接来源，删除信任区硬编码重复菜单，并对齐响应式安全边距。
3. 1200px 运行测量发现临界重叠后，将完整桌面导航断点调整到 1240px。
4. 1470px、1240px、1200px 三档浏览器复核均无横向溢出；目标入口、边界、抽屉切换和去重结果符合要求。

final result: passed

## 2026-07-31 首页右侧栏工具图标与 News 间距修正

### Source visual truth

- 用户标注截图：`/var/folders/vb/rrtsjfg94bb2d86gl6pg62kr0000gn/T/codex-clipboard-cc48949f-f50f-4bc6-b141-c06a38cd2f39.png`
  - 原始像素：882 × 1210。
- 可运行设计稿：`/Users/joyefrack/Documents/GitHub/GateRank/gaterank-3.0/src/components/SidebarWidgets.tsx`
- 同状态设计稿截图：`/Users/joyefrack/.codex/visualizations/2026/07/31/019fb658-7b2d-7fd0-80d6-c3f718f656a5/gaterank-sidebar-fidelity/reference-tools.png`

### Implementation evidence

- 修正后截图：`/Users/joyefrack/.codex/visualizations/2026/07/31/019fb658-7b2d-7fd0-80d6-c3f718f656a5/gaterank-sidebar-fidelity/implementation-tools.png`
- 工具区并排对照（左设计稿、右正式实现）：`/Users/joyefrack/.codex/visualizations/2026/07/31/019fb658-7b2d-7fd0-80d6-c3f718f656a5/gaterank-sidebar-fidelity/comparison-tools.png`
- News 区并排对照（左设计稿、右正式实现）：`/Users/joyefrack/.codex/visualizations/2026/07/31/019fb658-7b2d-7fd0-80d6-c3f718f656a5/gaterank-sidebar-fidelity/comparison-sidebar.png`
- 浏览器 CSS 视口：1470 × 685；截图像素：1470 × 685；浏览器 DPR 2，截图已归一化为 CSS 1x。
- 状态：桌面首页真实数据，工具 4 条、News 5 条。

### Findings

- 初始实现存在两个 P2：四个工具图标被统一成靛蓝色且工具卡边框过浅；News 语义列表的 `first:pt-0` 误作用到每条链接，导致所有文章行被压缩到约 32px。
- 修正后工具卡与设计稿均为 342 × 62px、1px 深灰边框、12px 圆角；图标盒均为 40 × 40px、8px 圆角，图标恢复蓝、紫、绿、橙四种语义色。
- 修正后 News 容器高度均为 213.625px；五行高度依次为 32.125、42.125、42.125、42.125、31.125px，行间距和首尾留白与设计稿一致。
- 正式实现继续展示真实工具摘要和真实 News 标题，因此文字内容与设计稿演示数据不同；布局、截断和日期对齐一致。
- 页面文档宽度等于视口宽度，没有新增横向溢出。

### Required fidelity surfaces

- 字体与排版：工具标题、摘要、News 标题和日期沿用设计稿的字号、字重、行高与截断规则。
- 间距与布局节奏：工具卡尺寸、卡间 14px 间距、News 行间 6px 间距及首尾 padding 与设计稿计算值一致。
- 颜色与视觉 token：工具图标恢复 blue-500、purple-500、emerald-500、amber-500，卡片边框恢复 gray-800。
- 图片与资产质量：继续使用项目已有 Lucide 图标库，没有引入自绘 SVG、占位图或位图替代。
- 文案与内容：保留真实工具说明、News 标题和发布日期，不使用设计稿模拟内容。

### Comparison history

1. 初次对照发现工具卡边框、四个小图标颜色和 News 行高不一致。
2. 修正图标语义色与深色边框，并把 News 的垂直间距从链接移到实际列表行。
3. 同视口复测后，工具卡、图标盒和 News 五行的计算尺寸与设计稿一致；并排截图无遗留 P0/P1/P2。

final result: passed

## 2026-07-31 GateRank 3.0 首页像素级回归

### Source visual truth

- 可运行设计稿：`/Users/joyefrack/Documents/GitHub/GateRank/gaterank-3.0`
- 桌面设计稿截图：`/Users/joyefrack/.codex/visualizations/2026/07/31/019fb658-7b2d-7fd0-80d6-c3f718f656a5/gaterank-home-v3-fidelity/reference-1440x1000.png`
  - CSS 视口：1440 × 1000，截图像素：1440 × 3918，1x。
- 手机设计稿截图：`/Users/joyefrack/.codex/visualizations/2026/07/31/019fb658-7b2d-7fd0-80d6-c3f718f656a5/gaterank-home-v3-fidelity/reference-390x844.png`
  - CSS 视口：390 × 844，截图像素：390 × 8037，1x。

### Implementation evidence

- 桌面实现截图：`/Users/joyefrack/.codex/visualizations/2026/07/31/019fb658-7b2d-7fd0-80d6-c3f718f656a5/gaterank-home-v3-fidelity/implementation-1440x1000.png`
  - CSS 视口：1440 × 1000，截图像素：1440 × 3618，1x。
- 手机实现截图：`/Users/joyefrack/.codex/visualizations/2026/07/31/019fb658-7b2d-7fd0-80d6-c3f718f656a5/gaterank-home-v3-fidelity/implementation-390x844.png`
  - CSS 视口：390 × 844，截图像素：390 × 7400，1x。
- 桌面并排对照：`/Users/joyefrack/.codex/visualizations/2026/07/31/019fb658-7b2d-7fd0-80d6-c3f718f656a5/gaterank-home-v3-fidelity/comparison-1440.png`
- 手机并排对照：`/Users/joyefrack/.codex/visualizations/2026/07/31/019fb658-7b2d-7fd0-80d6-c3f718f656a5/gaterank-home-v3-fidelity/comparison-390.png`
- 状态：设计稿使用自带演示数据；正式实现使用 2026-07-31 本地真实 API 数据，当前为 6 条榜单、0 条有效广告、5 条 News。

### Findings

- 没有遗留 P0、P1 或 P2 视觉问题。
- 桌面端导航、Hero、指标卡、广告四列容器、8:4 榜单双栏、工具与 News 侧栏、四类摘要榜、信任区、FAQ 和页脚均复用了设计稿的原始结构、尺寸与 class 体系。
- 手机端恢复设计稿的双行品牌、登录与黑色申请按钮，以及横向紧凑榜单表格；页面宽度为 390px，无文档级横向溢出。
- 正式实现没有用设计稿模拟数据补位。设计稿的 4 张广告卡在本地无有效投放时显示 4 个真实空广告位；设计稿的 10 条榜单在本地只展示 6 条真实记录。因此正式页面比设计稿全页截图短 300px（桌面）和 637px（手机），这是数据量差异，不是布局漂移。
- 桌面导航计算高度为 65px（64px 内容高度 + 1px 边框）；1440px 与 390px 页面 `scrollWidth` 均等于视口宽度。
- 桌面与手机控制台均无 warning 或 error。

### Required fidelity surfaces

- 字体与排版：正式页面和设计稿均使用 Inter、JetBrains Mono 与相同字重、字号、行高和字距；标题、数字指标、标签与小字层级一致。
- 间距与布局节奏：统一使用设计稿的 `max-w-7xl`、64px 导航、24px 主卡圆角、20px 子卡圆角、四列广告和 8:4 双栏节奏。
- 颜色与视觉 token：恢复设计稿的 `#fafafa` 底色、点阵纹理、靛蓝侧栏、黑色主操作、玫红导航选中态及语义标签色。
- 图片与资产质量：设计稿没有独立位图资产；正式实现复用了 Lucide 图标和设计稿闪电品牌图形，没有添加占位图片。
- 文案与内容：结构文案与设计稿一致；榜单、价格、分数、News、广告和日期来自真实接口，隐藏分数显示“未公开”，缺失涨跌显示“—”。

### Focused comparison

- 首屏：导航、Hero 标题换行、双指标卡与报告时间位置一致。
- 商业合作区：标题栏、四列栅格和 225px 卡片最小高度一致；空投放使用同尺寸虚线空位。
- 主榜与侧栏：桌面列宽、表头、行高、双操作按钮、深色推广块、工具条目和 News 密度一致。
- 手机：品牌与操作区、广告单列、横向榜单、侧栏堆叠、摘要榜、信任卡、FAQ 与页脚顺序一致。

### Comparison history

1. 初始实现偏离设计稿：Hero 过大、广告为空时合并成单块、榜单密度不足、侧栏缺少深色推广块、摘要榜和页脚比例不同。
2. 第一轮修复：正式首页重建为设计稿原始结构，并同步导航与页脚；桌面并排对照已无结构级偏差。
3. 第二轮修复：移除手机端汉堡与卡片式榜单偏差，恢复设计稿的移动导航操作区和横向紧凑表格。
4. 最终复核：1440 × 1000 与 390 × 844 均无 P0/P1/P2 问题，控制台无 warning/error。

### Follow-up polish

- 无必须处理的 P3 项。页面长度差仅来自真实数据少于设计稿演示数据。

final result: passed

## 2026-07-31 Hero 方格背景、固定导航与按钮 Hover 修正

### Source visual truth

- 可运行设计稿：`/Users/joyefrack/Documents/GitHub/GateRank/gaterank-3.0`
- 设计稿实现：
  - `gaterank-3.0/src/components/Header.tsx`
  - `gaterank-3.0/src/components/Hero.tsx`
- 同标签、同视口设计稿截图：`/Users/joyefrack/.codex/visualizations/2026/07/31/019fb658-7b2d-7fd0-80d6-c3f718f656a5/gaterank-nav-hero-fidelity/reference-nav-hero.png`

### Implementation evidence

- 正式实现截图：`/Users/joyefrack/.codex/visualizations/2026/07/31/019fb658-7b2d-7fd0-80d6-c3f718f656a5/gaterank-nav-hero-fidelity/implementation-nav-hero.png`
- 并排对照（左设计稿、右正式实现）：`/Users/joyefrack/.codex/visualizations/2026/07/31/019fb658-7b2d-7fd0-80d6-c3f718f656a5/gaterank-nav-hero-fidelity/comparison-nav-hero.png`
- 浏览器 CSS 视口：1470 × 741；截图像素：1470 × 741；浏览器 DPR 2，截图已归一化为 CSS 1x。
- 状态：桌面首页顶部，设计稿演示数据与正式真实数据分别渲染。

### Findings

- 初始实现有三个 P2：Hero 只有圆点纹理、缺少 30px 方格线；React 导航的 `sticky` 被外层 64px 容器限制，滚动 900px 后导航位置为 `y=-900`；登录按钮 hover 缺少灰底、阴影和缩放反馈。
- Hero 已恢复两组 30px 线性方格背景，并保留设计稿原有 20px 圆点叠层。
- React 导航外壳本身改为 `sticky; top: 0; z-index: 40`，内部导航保持同一视觉层。滚动到 900px 后外壳和导航计算位置均为 `y=0`；SSR 直接输出的导航仍保留原有 sticky 语义。
- 登录 hover 计算结果为 `rgb(243,244,246)` 灰底、黑字和 `scale(1.02)`；申请入驻 hover 为 `rgb(38,38,38)`、`translateY(-0.5px) scale(1.02)` 与更明显阴影。
- 登录与申请按钮补齐 `:active` 的 `scale(0.98)` 以及键盘 `:focus-visible` 外框。

### Required fidelity surfaces

- 字体与排版：导航品牌、菜单、按钮及 Hero 标题/描述继续使用设计稿原字号、字重和行高。
- 间距与布局节奏：64px 导航高度、1280px 内容宽度、Hero padding 和指标卡布局未改变。
- 颜色与视觉 token：Hero 方格使用设计稿的 `rgba(0,0,0,0.03)`；登录与申请按钮 hover 颜色对应 gray-100、gray-800。
- 图片与资产质量：该区域没有新增位图资产；沿用设计稿现有品牌和 Lucide 图标。
- 文案与内容：保留真实机场数量、实时测速和报告时间，未使用设计稿模拟数值。

### Comparison history

1. 初次运行测量确认 Hero 背景图为 `none`，导航滚动后离开视口，登录按钮无 hover 阴影与缩放。
2. 恢复方格背景，把 sticky 责任移动到 React 导航外壳，并补齐登录/申请按钮的 hover、active 与 focus-visible 状态。
3. 同标签同视口并排复核后，顶部结构、格纹密度、导航位置和按钮基础态与设计稿一致；交互计算值符合设计稿，没有遗留 P0/P1/P2。

final result: passed

## 2026-07-31 榜单说明精简与报告按钮 Hover 对齐

### Source visual truth

- 用户标注截图：`/var/folders/vb/rrtsjfg94bb2d86gl6pg62kr0000gn/T/codex-clipboard-aa8b92a8-8756-41fa-8966-cb89ca519246.png`
- 可运行设计稿：`/Users/joyefrack/Documents/GitHub/GateRank/gaterank-3.0`
- 用户截图像素：1742 × 1008；标注目标为删除“共收录 6 个机场”，并让“查看报告”按钮的鼠标交互与 3.0 UI 一致。

### Implementation evidence

- 设计稿 Hover 状态：`/Users/joyefrack/.codex/visualizations/2026/07/31/019fb658-7b2d-7fd0-80d6-c3f718f656a5/gaterank-ranking-button-fidelity/reference-hover.png`
- 正式实现 Hover 状态：`/Users/joyefrack/.codex/visualizations/2026/07/31/019fb658-7b2d-7fd0-80d6-c3f718f656a5/gaterank-ranking-button-fidelity/implementation-hover.png`
- 同状态并排对照：`/Users/joyefrack/.codex/visualizations/2026/07/31/019fb658-7b2d-7fd0-80d6-c3f718f656a5/gaterank-ranking-button-fidelity/comparison-hover.png`
- 设计稿浏览器 CSS 视口为 1470 × 900、DPR 1；正式实现 CSS 视口为 1470 × 741、DPR 2，浏览器截图均归一化为 CSS 1x。
- 并排对照前将设计稿顶部区域裁切为 1470 × 741，与正式实现截图等尺寸；最终对照图为 2940 × 741。
- 状态：首页综合榜首行“查看报告”按钮处于真实鼠标 Hover，榜单使用各自运行时数据。

### Findings

- 原正式页面将真实总数追加在说明文案末尾，形成“· 共收录 6 个机场”；设计稿只保留“排名每日更新，基于真实数据和客观多节点测速得出”。正式页面现已与设计稿文案一致。
- 设计稿按钮 Hover 后背景从 `stone-900` 变为 `stone-800`，尺寸从 105 × 33.5px 放大至约 107.1 × 34.17px，即 `scale(1.02)`。
- 正式实现 Hover 后得到相同的 `stone-800` 背景、107.1 × 34.17px 尺寸和 `scale: 1.02`；按下状态为 `scale(0.98)`。
- 正式按钮额外保留 `focus-visible` 双像素焦点环，并在 Reduced Motion 环境禁用缩放，不改变原报告 URL 或站内导航行为。
- 1470px 视口下页面 `scrollWidth` 等于 1470px，没有新增横向溢出；控制台无 warning 或 error。

### Required fidelity surfaces

- 字体与排版：榜单标题、标签和保留的说明文案字号、字重、行高均未改变。
- 间距与布局节奏：删除尾部文案后标题区自然回到设计稿单段长度；榜单、列宽和行高未改变。
- 颜色与视觉 token：按钮基础态、Hover 背景、边框和阴影与设计稿一致。
- 图片与资产质量：本轮未新增或替换任何图片、图标或品牌资产。
- 文案与内容：仅移除用户框选的收录总数文案，真实榜单数据及后端 `ranking_preview.total` 数据契约保持不变。

### Comparison history

1. 初始实现存在两个 P2：榜单说明多出实时收录总数；报告按钮只有背景变色，没有设计稿的 Hover 放大与按下回缩。
2. 删除标题区的总数渲染，补齐 `scale(1.02)` Hover、`scale(0.98)` active、深灰背景、焦点环和 Reduced Motion 处理。
3. 运行设计稿与正式页面的真实 Hover 状态后，两者按钮背景和放大后尺寸一致；同尺寸并排图复核没有遗留 P0/P1/P2。

final result: passed

## 2026-07-31 FAQ 与页脚间大方格去除

### Source visual truth

- 用户标注截图：`/var/folders/vb/rrtsjfg94bb2d86gl6pg62kr0000gn/T/codex-clipboard-6f894374-503e-4ed8-aa2d-758551daf7ad.png`
- 可运行设计稿：`/Users/joyefrack/Documents/GitHub/GateRank/gaterank-3.0`
- 本轮目标：只去除 FAQ 与页脚之间暴露的 40px 大方格，不改变 64px 区段间距和页脚自身的 30px 方格。

### Implementation evidence

- 修正后浏览器截图：`/Users/joyefrack/.codex/visualizations/2026/07/31/019fb658-7b2d-7fd0-80d6-c3f718f656a5/gaterank-footer-gap-gray/implementation-footer-gap.jpg`
- 白色问题与修正后灰色背景纵向对照：`/Users/joyefrack/.codex/visualizations/2026/07/31/019fb658-7b2d-7fd0-80d6-c3f718f656a5/gaterank-footer-gap-gray/comparison-white-vs-gray.png`
- 浏览器 CSS 视口与截图像素：1280 × 720，1x。

### Findings

- 根因是共享 `PageFrame` 在所有内容和页脚后方固定绘制了 40px 方格；页脚的 `mt-16` 透明间隔让这层方格单独暴露。
- 已删除共享外壳的重复 40px 方格层。首轮修正遗漏了外壳底色，导致 64px 间隔暴露为白色；现已将共享外壳对齐首页整体的 `#fafafa` 灰色。
- 页脚本体仍使用设计稿的两层 30px 线性方格和 24px 圆点叠层；浏览器计算值为 `background-size: 30px 30px, 30px 30px`，页脚高度仍为 433.5px。
- 浏览器计算确认共享外壳为 `rgb(250, 250, 250)`，页脚仍为白色；纵向对照确认用户框选区域的大方格与白色断层均已消失，FAQ、页脚内容、导航、文字和页脚小方格未发生位移或样式回退。

### Regression evidence

- `npx tsx --test backend/tests/frontendCrawlableLinks.test.ts`：15/15 通过。
- `npx tsx --test backend/tests/frontendCrawlableLinks.test.ts backend/tests/publicPageRoutes.test.ts`：44/44 通过。
- `npm run lint`、`npm run server:typecheck`、`npm run build` 与 `git diff --check`：全部通过。
- 前端首页与 API 健康检查均返回 HTTP 200。

final result: passed
