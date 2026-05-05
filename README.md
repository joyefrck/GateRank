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

### 第三方发文接口（`Bearer publish_token`）

- `POST /api/v1/publish/news`
- `PATCH /api/v1/publish/news/:id`
- `POST /api/v1/publish/news/:id/publish`
- `POST /api/v1/publish/news/:id/archive`
- `POST /api/v1/publish/news/upload-image`

`POST /api/v1/publish/news` 请求体当前支持这些字段：

- `title`: 文章标题
- `content_markdown`: 正文 Markdown
- `slug`: 可选，不传则自动生成
- `excerpt`: 可选，不传则按正文自动提取
- `cover_image_url`: 可选，封面地址字段
- `publish_mode`: 可选，`draft | publish`，默认 `draft`

最常见流程：

1. 调 `POST /api/v1/publish/news/upload-image` 上传封面
2. 把返回的 `url` 填到 `cover_image_url`
3. 调 `POST /api/v1/publish/news` 创建草稿或直接发布
4. 如果先创建草稿，再调 `POST /api/v1/publish/news/:id/publish` 上线

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

发布令牌补充：

- 发布令牌在后台“系统设置 -> 发布令牌”里创建
- 这是系统级 Bearer 令牌，给第三方系统或 AI 调用受限发文接口用，不复用全局 `x-api-key`
- 公开接入文档页面：`/publish-token-docs`
- 令牌明文只会在创建成功时展示一次，之后不会再次返回
- 吊销后令牌立即失效，页面默认也不再显示已吊销项
- 令牌作用域当前固定支持：
  - `news:create`
  - `news:update`
  - `news:publish`
  - `news:archive`
  - `news:upload`

第三方发文约定：

- Base URL: `http://<host>:<port>/api/v1/publish`
- 鉴权方式：`Authorization: Bearer <publish_token>`
- 封面字段：`cover_image_url`
- 发布模式字段：`publish_mode`
  - `draft`: 只创建草稿，不出现在前台
  - `publish`: 创建后立即发布到前台，需要令牌同时具备 `news:create` 和 `news:publish`

如果封面图片还没有上传到 GateRank，需要先调用上传接口，再把返回的 `url` 写入 `cover_image_url`。

上传封面示例：

```bash
curl -X POST 'http://localhost:3000/api/v1/publish/news/upload-image' \
  -H 'Authorization: Bearer <publish_token>' \
  -F 'mode=cover' \
  -F 'file=@/path/to/cover.png'
```

返回示例：

```json
{
  "url": "/uploads/news/1743240000000-cover.webp"
}
```

创建文章示例：

```bash
curl -X POST 'http://localhost:3000/api/v1/publish/news' \
  -H 'Authorization: Bearer <publish_token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "title":"新文章",
    "slug":"new-article",
    "excerpt":"可选摘要",
    "cover_image_url":"/uploads/news/1743240000000-cover.webp",
    "content_markdown":"# Hello\n\n正文内容",
    "publish_mode":"draft"
  }'
```

Google Analytics 当前只统计公开站页面，不统计 `/admin`，并且只接入基础 `page_view`，未启用 EEA consent mode。

申请通知优先在管理后台的“系统设置”里配置，支持两种互斥模式：

- `Telegram 直发`：适合发给用户、群组、频道
- `Webhook 转发`：适合把申请事件推给你自己的 bot 后端或其他系统

如果数据库里还没有保存配置，后端只会对 `Telegram 直发` 继续回退使用下面这些环境变量；`Webhook` 模式没有环境变量回退：

- `TELEGRAM_BOT_TOKEN`: Telegram Bot Token
- `TELEGRAM_CHAT_ID`: 你接收通知的 chat id
- `TELEGRAM_API_BASE`: 可选，默认 `https://api.telegram.org`
- `TELEGRAM_NOTIFY_TIMEOUT_MS`: 可选，默认 `5000`

### 3. 准备本地测试数据库

后端会优先读取 `backend/.env`，其次才是仓库根目录 `.env`。本仓库当前本地测试默认连：

- `MYSQL_HOST=127.0.0.1`
- `MYSQL_PORT=3310`
- `MYSQL_DATABASE=gaterank`

如果你的机器上已经有历史测试数据，默认应该直接复用已有的 MySQL 容器，而不是重新创建空库。当前本地约定容器名为 `gaterank-mysql`。

推荐启动顺序：

```bash
docker start gaterank-mysql
docker exec gaterank-mysql mysqladmin ping -uroot -p'<你的 MYSQL_ROOT_PASSWORD>' --silent
```

如果返回 `mysqld is alive`，再继续启动后端。

重要说明：

- 不要在 `3310` 上直接再 `docker run` 一个新的 MySQL 容器，否则应用很容易连到一个空库，误以为“数据丢了”。
- 只有在你明确要初始化一套全新的本地测试库时，才新建 MySQL 容器。
- 如果只是日常开发或联调，优先 `docker start gaterank-mysql`，不要重建。

### 4. 初始化数据库（仅首次新建空库时）

只有在“明确新建了一套空的本地 MySQL”时，才执行 [`backend/sql/schema.sql`](backend/sql/schema.sql)。

如果你复用的是已有测试库，这一步通常不需要再做。

### 5. 启动服务

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

建议本地联调顺序：

1. 先确认 `gaterank-mysql` 已启动，且 `3310` 端口可连接
2. 再启动后端 `npm run server:dev`
3. 最后启动前端 `npm run dev`

这样如果后台页面报空数据，先排查数据库容器和端口，不要先怀疑业务数据被删。

## 质量检查

- 后端类型检查：`npm run server:typecheck`
- 后端测试：`npm run test:backend`
- 全局 TS 检查：`npm run lint`

## 生产发布

当前生产环境通过 1Panel 的 Docker Compose 编排 `gaterank` 发布，编排目录为：

```bash
/opt/1panel/docker/compose/gaterank
```

编排内包含两个核心服务：

- `gaterank-web`：公开站前端，宿主机端口 `18088`
- `gaterank-api`：后端 API，宿主机端口 `18787`

1Panel 网站反向代理配置：

- `/` -> `http://127.0.0.1:18088`
- `/api` -> `http://127.0.0.1:18787`

线上编排会在容器启动时从 GitHub 拉取最新代码：

- `gaterank-web` 克隆 `https://github.com/joyefrck/GateRank.git` 到 `/srv/gaterank-web`，执行 `npm install`、`npm run build`，再把 `dist` 复制到 Nginx 静态目录
- `gaterank-api` 克隆 `https://github.com/joyefrck/GateRank.git` 到 `/srv/gaterank-api`，执行 `npm install` 后启动 `npm run server:start`

推荐发布流程：

1. 在本地完成修复并运行必要检查，例如 `npm run server:typecheck`、`npm run test:backend`、`npm run lint`
2. 如前端构建需要更高 Node 内存，可用 `NODE_OPTIONS=--max-old-space-size=4096 npm run build`
3. 将需要发布的提交推送到 GitHub `main`
4. 登录 1Panel，打开「容器」->「编排」或 1Panel 终端
5. 在编排目录执行重建命令：

```bash
cd /opt/1panel/docker/compose/gaterank
docker compose up -d --force-recreate gaterank-web gaterank-api
```

6. 等待 `gaterank-web` 和 `gaterank-api` 启动完成后，检查容器、提交版本和线上接口

常用验证命令：

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'gaterank|NAMES'
docker exec gaterank-api sh -lc 'cd /srv/gaterank-api && git log -1 --pretty="%h %s"'
docker exec gaterank-web sh -lc 'cd /srv/gaterank-web && git log -1 --pretty="%h %s"'
curl -sS -I --connect-timeout 5 http://127.0.0.1:18088/ | head -5
curl -sS --connect-timeout 5 http://127.0.0.1:18787/api/v1/pages/home | head -c 220
curl -sS -I --connect-timeout 5 https://gate-rank.com/ | head -8
```

News 模块上线要求：

- `gaterank-web` 需要把 `/news`、`/uploads`、`/sitemap.xml` 代理到 `gaterank-api`
- `gaterank-api` 需要挂载新闻图片持久化目录，当前使用 Docker volume `gaterank_news_uploads`
- `gaterank-api` 需要在环境变量里配置 `NEWS_UPLOAD_ROOT_DIR`，并指向上面的持久化挂载路径
- 如启用第三方封面图库，需要先在管理后台的“系统设置 -> 图库设置”中配置 Pexels API Key

说明：

- 当前线上编排会在启动时重新从 GitHub 拉取最新代码，所以必须先确认代码已经 push 到 GitHub
- `docker compose up -d --force-recreate` 会重建容器，但不会删除已挂载的 Docker volume
- `gaterank-web` 不能直接用 `serve -s dist` 替代网关层；否则 `/news`、`/uploads`、`/sitemap.xml` 不会正确代理到 API
- `gaterank-api` 若未挂新闻图片持久卷，`/uploads/news` 下的封面会在容器重建后丢失
- 如果在 1Panel Web 终端里输入特殊字符出现错乱，优先用剪贴板粘贴整段命令
- 启动失败时先看 `docker logs --tail 100 gaterank-web` 和 `docker logs --tail 100 gaterank-api`
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
