# GateRank 公开页面访问统计全覆盖设计

## 背景

GateRank Admin 的“访问记录”来自自建 `marketing_events`，不是 Google Analytics、Nginx 日志或 Cloudflare 流量统计。当前公开页面只有在前端路由被转换为有效 `page_kind`，或服务端页面显式写入事件时，才会进入后台 PV、UV、来源、国家和热门页面统计。

现有实现存在多处独立维护的页面类型集合：

- React 路由到统计类型的映射。
- 浏览器端 `MarketingPageKind` 类型。
- 后端领域类型和请求白名单。
- MySQL `marketing_events.page_kind` ENUM。
- Admin 前端类型和中文显示名称。

这些集合在后期功能开发中发生漂移。月度报告被显式排除，工具下载、流媒体检测、IP 检测、DNS 泄漏检测和排名独立性声明没有映射，`/for-ai` 没有接入统计；活动优惠虽然可以入库，但 Admin 类型和格式化函数没有正确识别。结果是后台总 PV、UV 和热门页面都缺少部分公开流量。

## 目标

1. 所有有效公开 HTML 页面都有明确且可读的统计分类。
2. 每次页面访问只由客户端或服务端其中一端记录，避免双计数。
3. 页面类型、后端校验和 Admin 中文名称只有一个共享定义来源。
4. 新增 React 公开路由时，类型检查或测试必须要求开发者明确选择统计分类或排除理由。
5. 数据库不再因为 ENUM 未扩展而拒绝后期新增的合法页面类型。
6. 保持现有 PV、UV、来源和国家统计口径，不把文件下载、API 请求或错误页面混入页面访问量。

## 统计边界

### 纳入统计

以下返回有效内容的公开 HTML 页面纳入访问统计：

| 页面类别 | 路径范围 | `page_kind` |
| --- | --- | --- |
| 首页 | `/` | `home` |
| 全量榜单 | `/rankings/all` 及 `/rankings/:category/:slug` | `full_ranking` |
| 机场报告 | `/airports/:slug` | `report` |
| 跑路监测 | `/risk-monitor` | `risk_monitor` |
| 活动优惠 | `/deals` | `deals` |
| 月报中心 | `/monthly-reports` | `monthly_reports` |
| 月报详情 | `/monthly-reports/:slug` | `monthly_report` |
| 测评方法 | `/methodology` | `methodology` |
| 排名独立性声明 | `/ranking-transparency` | `ranking_transparency` |
| 申请入驻 | `/apply` | `apply` |
| 工具下载 | `/download` | `tools_download` |
| 流媒体检测 | `/tools/streaming-check` | `streaming_check` |
| IP 检测 | `/tools/ip-check` | `ip_check` |
| DNS 泄漏检测 | `/tools/dns-leak-test` | `dns_leak_test` |
| News | `/news`、分类、专题和文章页 | `news` |
| 发布文档 | `/publish-token-docs` | `publish_token_docs` |
| AI 数据入口 | `/for-ai` | `for_ai` |

查询参数不会产生新的页面类型，但会保留现有路径规范：

- `page_path` 继续存储规范化 pathname，不写入 query 和 hash。
- 同一路径的分页、筛选和日期查询仍聚合到同一热门页面行。
- `/rankings/:category/:slug` 保留实际静态筛选路径，类型统一为 `full_ranking`。

### 排除统计

以下入口不写入 `page_view`：

- `/admin` 和所有管理后台页面。
- `/portal` 和个人后台页面。
- `/api/**`。
- `/download/file/:slug` 和上传文件地址。
- JSON、Markdown、文本、robots、sitemap 和其他机器可读入口。
- 404、500 和其他错误响应。
- 301 跳转别名，例如 `/tools`、`/tools/download`、`/risk-watch` 和 `/reports/:id`；只统计最终成功落地页。

## 方案选择

### 采用：共享页面类型注册表

新增共享模块，集中定义 `page_kind` 和 Admin 中文名称。浏览器端、后端请求校验、领域类型和 Admin UI 都从该模块导入，消除重复枚举。

共享注册表包含：

- 稳定的机器值，例如 `monthly_report`、`dns_leak_test`。
- 对应中文名称，例如“月报详情”“DNS 泄漏检测”。
- 派生的 `MarketingPageKind` TypeScript 类型。
- 派生的后端合法值集合。

### 未采用：继续扩展所有独立枚举

这个方案改动较少，但无法解决多处定义长期漂移的问题。下一次增加公开模块时，仍可能只修改 React 路由而遗漏后端、数据库或 Admin。

### 未采用：统一写成 `public_page`

这个方案可以完全依赖 `page_path`，但会失去后台按功能模块识别页面的能力，也无法准确显示“月报详情”“工具检测”等类别。

## 客户端统计

React 管理的公开页面继续使用现有 `/api/v1/marketing/events` 队列和 `sendBeacon` 机制。这样保持当前访问统计主要反映实际运行浏览器 JavaScript 的访客，不把 SSR 抓取、缓存预热和无脚本探测直接扩大为 PV。

路由映射改为完整对象，而不是一串可能漏掉新增分支的 `if`：

- 每个 `RouteState['kind']` 都必须在对象中出现。
- 有效公开 React 页面映射到共享 `MarketingPageKind`。
- `portal`、`not_found` 等排除项显式映射为 `null`。
- TypeScript `satisfies Record<RouteState['kind'], MarketingPageKind | null>` 保证新增路由后未更新映射会导致类型检查失败。

月报列表、月报详情、工具下载、三个检测页和排名独立性声明补入有效映射。Google Analytics 逻辑保持不变。

## 服务端统计

不是由 React 路由负责统计的 HTML 页面继续在成功响应时由服务端写入：

- News 首页、分类、专题和文章页。
- `/publish-token-docs`。
- `/for-ai`。

服务端复用统一的安全写入辅助函数：

1. 只在确认将返回 `200` HTML 后调用。
2. 使用请求 IP、User-Agent、来源、UTM 和国家信息构造现有匿名身份字段。
3. 写入失败只记录结构化错误日志，不影响公开页面响应。
4. 404、500 和机器可读版本不调用。

React 统计映射不为这些服务端页面再发送自建 `page_view`。因此同一路由只有一个写入者。Google Analytics 属于独立系统，不计入自建事件的双计数判断。

## 数据库兼容迁移

`marketing_events.page_kind` 从固定 ENUM 改为 `VARCHAR(64)`：

- 新建数据库直接使用 `VARCHAR(64) NOT NULL`。
- 已有数据库启动时读取当前字段类型。
- 只有字段仍是 ENUM 或长度不符合要求时，才执行安全的 `ALTER TABLE ... MODIFY COLUMN page_kind VARCHAR(64) NOT NULL`。
- 现有索引 `idx_marketing_events_page_kind_date` 保留。
- 现有数据值原样保留。

合法值约束由共享注册表和后端请求校验承担。选择 `VARCHAR` 是为了避免以后每增加一个合法公开页面，都必须同步修改 MySQL ENUM；共享白名单仍会拒绝未知客户端输入。

本次迁移不回填历史缺失事件。历史缺口若需要估算，只能另行使用 GA、Cloudflare 或访问日志，不能伪造到现有匿名访客口径中。

## Admin 展示

Admin 直接使用共享中文名称，不再维护本地 `MarketingPageKind` 联合类型和长 `if` 格式化函数。

后台热门页面继续按 `page_path + page_kind` 聚合，新增类型会显示：

- 月报中心
- 月报详情
- 排名独立性声明
- 工具下载
- 流媒体检测
- IP 检测
- DNS 泄漏检测
- AI 数据入口

同时修复 `deals` 被回退显示成“发布文档”的现有问题。未知历史值或异常值使用原始字符串回退显示，不伪装成其他页面类别。

## 月报和工具交互边界

本次只补齐页面 PV/UV：

- 月报正文中的机场链接不新增 `airport_impression` 或 `outbound_click`。
- 流媒体检测、IP 查询、DNS 检测按钮不新增工具执行次数事件。
- 工具文件继续使用独立 `download_count` 统计实际下载。

这些交互指标需要独立定义事件类型、去重和转化口径，不与页面访问修复捆绑。

## 错误处理

- 客户端统计请求失败继续静默丢弃，不阻断页面浏览。
- 服务端统计写入失败记录 `pagePath`、`pageKind` 和 `requestId`，页面仍正常返回。
- 后端收到未知 `page_kind` 返回现有 `400 BAD_REQUEST`。
- 数据库迁移失败时服务启动失败并保留原错误，避免运行在“代码接受但数据库拒绝”的半兼容状态。
- Admin 遇到未知值显示原值，不映射到错误中文名称。

## 测试

### 共享定义

- 所有预期页面类型都有唯一机器值和非空中文名称。
- `deals`、月报、工具页、排名独立性声明和 `/for-ai` 均在共享合法值集合中。

### 客户端路由

- 每个 `RouteState['kind']` 都有显式映射。
- 月报列表和详情映射到不同类型。
- 工具下载和三个检测页面映射到对应类型。
- `portal`、`not_found` 和其他排除项返回 `null`。
- 同一路由重复渲染继续由现有 route key 去重。

### 后端接口和数据库

- `/marketing/events` 接受所有新增合法类型并拒绝未知类型。
- 新表使用 `VARCHAR(64)`。
- 旧 ENUM 字段只迁移一次，已是目标类型时不重复执行 ALTER。
- 聚合查询能返回新增页面类型。

### 服务端页面

- News、发布文档和 `/for-ai` 的成功 HTML 响应各写入一次。
- 对应 404、500、Markdown 和 API 响应不写入。
- 统计写入失败不改变 HTML 响应状态。

### Admin

- 所有共享页面类型显示正确中文名称。
- `deals` 显示“活动优惠”，不再显示为“发布文档”。
- 未知值回退显示原始值。

### 完整回归

- 聚焦统计测试。
- `npm run test:backend`。
- `npm run lint`。
- `npm run server:typecheck`。
- `npm run build`。
- 检查构建产物中的公开路由映射和共享页面名称。

## 验收标准

1. 每个纳入范围的公开 HTML 路由都能明确关联一个 `page_kind`。
2. 所有新增页面类型都能通过后端校验并写入数据库。
3. Admin 能在热门页面中显示正确的路径、类型、PV、UV 和最近访问时间。
4. 重定向、错误页、后台、个人后台、API、机器可读内容和文件下载不产生 `page_view`。
5. 客户端和服务端写入边界清楚，没有同一路由双计数。
6. 新增 React 路由但未声明统计策略时，类型检查或测试失败。
7. 完整测试、类型检查和生产构建不新增失败。

## 发布边界

本设计确认后的实现只修改仓库代码、数据库兼容迁移和测试。不会自动部署生产，也不会回填历史统计。生产部署和上线后真实访问验证需要在实现完成、验证通过并获得单独授权后执行。
