# GateRank

GateRank 是一个「机场测评与榜单」系统。  
目标是基于稳定性、性能、价格、风险四个维度，生成可解释、可追踪的每日评分与榜单。

## 产品逻辑

### 评分目标

- 面向用户：快速找到“当前更稳、更值、更安全”的机场
- 面向运营：可解释分数来源，支持人工录入与每日重算

### 核心流程

1. 维护机场基础信息（名称、站点、价格、试用、订阅链接）
2. 接入自动化采样（延迟/下载/可用性/丢包）并按日聚合
3. 系统按统一公式计算 `S/P/C/R`
4. 生成当日综合分与时间衰减分 `FinalScore`
5. 生成 5 类榜单（今日推荐、最稳定、性价比、新机场、风险榜）

### 评分公式

- 稳定性：`S = 0.5*UptimeScore + 0.3*StabilityScore + 0.2*StreakScore`
- 性能：`P = 0.4*LatencyScore + 0.4*SpeedScore + 0.2*LossScore`
- 价格：`C = 0.6*PriceScore + 0.2*TrialScore + 0.2*ValueScore`
- 风险：`R = 100 - RiskPenalty`
- 综合：`Score = 0.4*S + 0.3*P + 0.2*C + 0.1*R`
- 衰减权重：`w = exp(-lambda * days_diff)`，默认 `lambda = 0.1`
- 历史衰减分：`HistoricalScore = Σ(score_i * w_i) / Σ(w_i)`，仅统计当前日期之前的每日 `score`
- 最终衰减分：`FinalScore = Σ(score_i * w_i) / Σ(w_i)`，统计历史序列与当日 `score`

说明：子项评分采用“阈值分段 + 线性插值”，并截断到 `[0, 100]`。时间衰减按天计算，日期越近权重越高。
稳定性中的 `StabilityScore` 使用稳健波动值 `effective_latency_cv`，不是直接使用原始 `latency_cv`。规则如下：

- 当稳定性延迟样本数 `>= 5` 时，先去掉 1 个最大值和 1 个最小值
- 用剩余样本计算 `effective_mean_ms` 和 `effective_std_ms`
- `effective_latency_cv = effective_std_ms / max(effective_mean_ms, 10)`
- 稳定日判定：`uptime >= 99%` 且 `effective_latency_cv <= 0.20`，并且当日存在有效延迟样本

原始 `latency_mean_ms`、`latency_std_ms`、`latency_cv` 仍会保留，主要用于后台诊断和核对采样质量。
风险项例外：`RiskPenalty = DomainPenalty + SslPenalty + ComplaintPenalty + HistoryPenalty`，其中域名异常记 `30`，SSL 未知记 `5`，证书即将过期按 `5/10/20/30` 分段，投诉按 `3` 分每条封顶 `15`，历史异常按 `10` 分每次封顶 `30`。

## 技术方案

### 架构

- 前端：React + Vite（展示榜单与报告）
- 后端：Node.js + Express + TypeScript
- 数据库：MySQL 8
- 任务：后端内置午夜维护流水线（上海时区）

### 后端分层

- `routes`: 公共接口、管理接口
- `services`: 评分引擎、榜单生成、重算编排
- `repositories`: MySQL 读写封装
- `middleware`: API Key 鉴权、请求上下文、统一错误结构
- `jobs`: 午夜自动维护任务

### 数据模型（MVP）

- `airports`: 机场基础信息
- `airport_metrics_daily`: 每日指标快照
- `airport_probe_samples`: 自动化采样明细
- `airport_packet_loss_samples`: 丢包采样明细
- `airport_scores_daily`: 每日子分/总分/衰减分
- `airport_rankings_daily`: 每日榜单结果
- `admin_audit_logs`: 管理操作审计

SQL 文件：[`backend/sql/schema.sql`](backend/sql/schema.sql)

## API 设计

### 公共接口

- `GET /api/v1/rankings?type=today|stable|value|new|risk&date=YYYY-MM-DD`
- `GET /api/v1/airports/:id/score-trend?days=30`
- `GET /api/v1/airports/:id/report?date=YYYY-MM-DD`

### 管理接口（`Bearer admin_token` 或 `x-api-key`）

- `POST /api/v1/admin/login`
- `GET /api/v1/admin/airports`
- `GET /api/v1/admin/airports/:id`
- `POST /api/v1/admin/airports`
- `PATCH /api/v1/admin/airports/:id`
- `GET /api/v1/admin/airports/:id/dashboard?date=YYYY-MM-DD`
- `POST /api/v1/admin/probe-samples`
- `POST /api/v1/admin/performance-runs`
- `GET /api/v1/admin/airports/:id/probe-samples?date=YYYY-MM-DD`
- `GET /api/v1/admin/airports/:id/daily-metrics?date=YYYY-MM-DD`
- `GET /api/v1/admin/airports/:id/scores?date=YYYY-MM-DD`
- `POST /api/v1/admin/jobs/aggregate?date=YYYY-MM-DD`
- `POST /api/v1/admin/scores/recompute?date=YYYY-MM-DD`
- `POST /api/v1/admin/complaints`
- `POST /api/v1/admin/incidents`

`/dashboard` 返回固定结构：`base / stability / performance / risk / time_decay`，用于后台固定 5 Tab。

统一错误结构：

```json
{
  "code": "BAD_REQUEST",
  "message": "date must be YYYY-MM-DD",
  "request_id": "..."
}
```

## 本地运行

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp backend/.env.example backend/.env
```

按需修改 `backend/.env` 中 MySQL、`ADMIN_UI_PASSWORD`、`ADMIN_API_KEY` 与 `ADMIN_JWT_SECRET`。

前端可选配置放在仓库根目录 `.env`，当前公开站支持这些 `VITE_` 变量：

- `VITE_SITE_URL`: 生成 canonical 和绝对链接时使用的站点地址
- `VITE_API_BASE`: 前端请求后端 API 的基础地址
- `VITE_GA_MEASUREMENT_ID`: GA4 测量 ID；未配置时默认回退到 `G-4V9Z53GSP2`

News 模块补充：

- `NEWS_UPLOAD_ROOT_DIR`: 可选，新闻图片上传根目录；默认落到 `backend/uploads`
- 新闻图片会保存在 `${NEWS_UPLOAD_ROOT_DIR}/news`
- 生产环境需要给 API 容器挂持久卷，否则重启后上传图片会丢失

Google Analytics 当前只统计公开站页面，不统计 `/admin`，并且只接入基础 `page_view`，未启用 EEA consent mode。

申请通知优先在管理后台的“系统设置”里配置，支持两种互斥模式：

- `Telegram 直发`：适合发给用户、群组、频道
- `Webhook 转发`：适合把申请事件推给你自己的 bot 后端或其他系统

如果数据库里还没有保存配置，后端只会对 `Telegram 直发` 继续回退使用下面这些环境变量；`Webhook` 模式没有环境变量回退：

- `TELEGRAM_BOT_TOKEN`: Telegram Bot Token
- `TELEGRAM_CHAT_ID`: 你接收通知的 chat id
- `TELEGRAM_API_BASE`: 可选，默认 `https://api.telegram.org`
- `TELEGRAM_NOTIFY_TIMEOUT_MS`: 可选，默认 `5000`

### 3. 初始化数据库

执行 [`backend/sql/schema.sql`](backend/sql/schema.sql)。

### 4. 启动服务

前端：

```bash
npm run dev
```

后端：

```bash
npm run server:start
```

开发模式（自动重载）：

```bash
npm run server:dev
```

## 质量检查

- 后端类型检查：`npm run server:typecheck`
- 后端测试：`npm run test:backend`
- 全局 TS 检查：`npm run lint`

## 生产发布

当前生产环境通过 1Panel 的 `gaterank` 编排发布，编排内包含：

- `gaterank-web`
- `gaterank-api`

News 模块上线要求：

- `gaterank-web` 需要把 `/news`、`/uploads`、`/sitemap.xml` 代理到 `gaterank-api`
- `gaterank-api` 需要挂载新闻图片持久化目录

推荐发布流程：

1. 在本地完成修复并运行至少 `npm run server:typecheck`、`npm run test:backend`
2. 如前端构建需要更高 Node 内存，可用 `NODE_OPTIONS=--max-old-space-size=4096 npm run build`
3. 将需要发布的提交推送到 GitHub `main`
4. 登录 1Panel，进入「容器」->「编排」
5. 找到编排 `gaterank` 并点击「重启」
6. 等待 `gaterank-web` 和 `gaterank-api` 启动完成后回查线上页面和后台手动任务

说明：

- 当前线上编排会在启动时重新从 GitHub 拉取最新代码
- 不要把 1Panel 账号、密码或其他敏感信息写入仓库

## 午夜自动维护

后端支持一个按上海时间串行执行的午夜维护流水线，用来覆盖管理后台里的四个模块：

- 稳定性数据（S）：调用 `scripts/monitor_stability.py`
- 性能数据（P）：调用 `scripts/monitor_performance.py`
- 风险数据（R）：逐机场执行风险体检
- 时间维度（衰减）：最后统一执行一次 `aggregate + recompute`

这样做的目的是控制服务器负载：

- `S / P` 阶段只采样，不各自重复触发聚合和重算
- `R` 阶段按机场串行执行，并可配置每个机场之间的间隔
- 全量聚合与时间衰减重算只在最后执行一次

建议配置：

```bash
NIGHTLY_PIPELINE_ENABLED=1
NIGHTLY_PIPELINE_START_AT=00:00
NIGHTLY_PIPELINE_TRIGGER_WINDOW_MINUTES=30
NIGHTLY_PIPELINE_STAGE_GAP_MS=30000
NIGHTLY_PIPELINE_RISK_AIRPORT_GAP_MS=1500
NIGHTLY_PIPELINE_SCRIPT_TIMEOUT_MS=1800000
```

可选地限制只跑某个状态的机场：

```bash
NIGHTLY_PIPELINE_AIRPORT_STATUS=normal
```

说明：

- `00:00` 指上海时间每日零点开始整条流水线，不代表四个模块同时并发启动。
- 任务只会在设定时间后的一个短窗口内触发一次，避免服务白天重启后补跑整条午夜流水线。
- “时间维度（衰减）”没有单独脚本，它包含在最后一次 `recomputeForDate` 里。

## 稳定性采集 Cron

项目内置了一个可直接给 cron 调用的稳定性采集脚本：
[`scripts/monitor_stability.py`](scripts/monitor_stability.py)

职责：

- 检测官网可用性，写入 `availability` 样本
- 采集多次 TCP 建连延迟，写入 `latency` 样本
- 调用后端 `aggregate` 与 `recompute`，刷新当日 S 分与榜单

最小调用示例：

```bash
cd /path/to/GateRank
ADMIN_API_KEY=gaterank_admin_key \
AIRPORT_ID=1 \
WEBSITE_URL=https://www.elphantroute.com/ \
/usr/bin/python3 scripts/monitor_stability.py
```

推荐 cron 写法：

```cron
0 */6 * * * cd /path/to/GateRank && ADMIN_API_KEY=gaterank_admin_key AIRPORT_ID=1 WEBSITE_URL=https://www.elphantroute.com/ /usr/bin/python3 scripts/monitor_stability.py >> /var/log/gaterank-stability.log 2>&1
```

全机场批量模式：

```cron
0 */6 * * * cd /path/to/GateRank && ADMIN_API_KEY=gaterank_admin_key ALL_AIRPORTS=1 /usr/bin/python3 scripts/monitor_stability.py >> /var/log/gaterank-stability.log 2>&1
```

可选地只跑某个状态：

```cron
0 */6 * * * cd /path/to/GateRank && ADMIN_API_KEY=gaterank_admin_key ALL_AIRPORTS=1 AIRPORT_STATUS=normal /usr/bin/python3 scripts/monitor_stability.py >> /var/log/gaterank-stability.log 2>&1
```

常用环境变量：

- `ADMIN_API_KEY`: 后台接口鉴权 key

## 最近 30 天回刷

稳定性规则升级后，可用下面的脚本按日期升序回刷最近窗口，确保 `stable_days_streak` 按新规则连续重建：

```bash
cd /path/to/GateRank
ADMIN_API_KEY=gaterank_admin_key \
/usr/bin/python3 scripts/backfill_stability_window.py --days 30
```

可选参数：

- `--end-date YYYY-MM-DD`: 指定窗口结束日期，默认上海时区今天
- `BACKFILL_DAYS`: 与 `--days` 等价，默认 `30`
- `AIRPORT_ID`: 机场 ID，推荐显式配置
- `AIRPORT_KEYWORD`: 可替代 `AIRPORT_ID`，脚本会先查机场再上报
- `ALL_AIRPORTS`: 设为 `1/true/yes/on` 时批量遍历全部机场
- `AIRPORT_STATUS`: 批量模式下可按 `normal|risk|down` 过滤
- `WEBSITE_URL`: 用于 HTTP 可用性探测；未传时默认取后台记录的主官网
- `TCP_HOST`: TCP 探测主机；未传时从 `WEBSITE_URL` 自动提取
- `TCP_PORT`: 默认 `443`
- `LATENCY_SAMPLE_COUNT`: 默认 `5`
- `PAGE_SIZE`: 批量取机场列表时每页大小，默认 `100`
- `SOURCE`: 样本来源标记，默认 `cron-stability`
- `SKIP_RECOMPUTE`: 设为 `1/true/yes/on` 时只聚合不重算

## 性能采集 Cron

项目内置了一个可直接给 cron 调用的性能采集脚本：
[`scripts/monitor_performance.py`](scripts/monitor_performance.py)

职责：

- 从后台基础信息读取 `subscription_url`
- 检查 `sing-box` 是否可执行，并为代表节点启动临时本地代理
- 采集代理链路延迟、下载速度与代理探测失败率
- 调用后端 `performance-runs` 接口写入运行状态与原始性能样本
- 调用后端 `aggregate` 与 `recompute`，刷新当日 P 分与榜单

最小调用示例：

```bash
cd /path/to/GateRank
ADMIN_API_KEY=gaterank_admin_key \
AIRPORT_ID=1 \
SING_BOX_BIN=sing-box \
/usr/bin/python3 scripts/monitor_performance.py
```

推荐 cron 写法：

```cron
15 */6 * * * cd /path/to/GateRank && ADMIN_API_KEY=gaterank_admin_key ALL_AIRPORTS=1 SING_BOX_BIN=sing-box /usr/bin/python3 scripts/monitor_performance.py >> /var/log/gaterank-performance.log 2>&1
```

常用环境变量：

- `ADMIN_API_KEY`: 后台接口鉴权 key
- `AIRPORT_ID`: 单机场模式的机场 ID
- `AIRPORT_KEYWORD`: 单机场模式下按关键字查机场
- `ALL_AIRPORTS`: 设为 `1/true/yes/on` 时批量遍历全部机场
- `AIRPORT_STATUS`: 批量模式下可按 `normal|risk|down` 过滤
- `SING_BOX_BIN`: `sing-box` 可执行路径，默认 `sing-box`
- `PROXY_PORT`: 本地 HTTP 代理端口，默认 `7890`
- `PROXY_STARTUP_TIMEOUT`: 等待 `sing-box` 启动秒数，默认 `8`
- `LATENCY_ATTEMPTS`: 每节点延迟探测次数，默认 `3`
- `TEST_URL_LATENCY`: 代理 HTTP 诊断 URL，默认 `https://www.google.com/generate_204`
- `TEST_URL_SPEED`: 下载测速 URL，默认 `https://speed.cloudflare.com/__down?bytes=5000000`
- `SPEED_CONNECTIONS`: 下载测速并发连接数，默认 `4`
- `SOURCE`: 运行来源标记，默认 `cron-performance`
- `SKIP_RECOMPUTE`: 设为 `1/true/yes/on` 时只聚合不重算

说明：

- `median_latency_ms` 现在按“节点服务器 TCP 建连延迟”计算，用于性能评分，更接近代理客户端里的节点延迟口径。
- `TEST_URL_LATENCY` 只用于记录代理 HTTP 诊断耗时，不再直接参与 `P` 评分。
- `median_download_mbps` 现在按“多连接并发下载”计算，比之前的单连接下载更接近 Speedtest 的测速口径。

## 当前 MVP 边界

- 管理后台为单管理员模型（密码换短期 token）
- 数据台固定 5 Tab：
  - 基础信息（人工维护）
  - 稳定性数据（S）
  - 性能数据（P）
  - 风险数据（R）
  - 时间维度（衰减）
