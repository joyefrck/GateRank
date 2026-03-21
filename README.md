# GateRank

GateRank 是一个「机场测评与榜单」系统。  
目标是基于稳定性、性能、价格、风险四个维度，生成可解释、可追踪的每日评分与榜单。

## 产品逻辑

### 评分目标

- 面向用户：快速找到“当前更稳、更值、更安全”的机场
- 面向运营：可解释分数来源，支持人工录入与每日重算

### 核心流程

1. 录入机场基础信息（名称、站点、价格、试用状态）
2. 录入每日指标（可用率、延迟、下载、丢包、风险信号）
3. 系统按统一公式计算 `S/P/C/R`
4. 生成当日综合分与时间衰减分 `FinalScore`
5. 生成 5 类榜单（今日推荐、最稳定、性价比、新机场、风险榜）

### 评分公式

- 稳定性：`S = 0.5*UptimeScore + 0.3*StabilityScore + 0.2*StreakScore`
- 性能：`P = 0.4*LatencyScore + 0.4*SpeedScore + 0.2*LossScore`
- 价格：`C = 0.6*PriceScore + 0.2*TrialScore + 0.2*ValueScore`
- 风险：`R = 100 - RiskPenalty`
- 综合：`Score = 0.4*S + 0.3*P + 0.2*C + 0.1*R`
- 衰减：`FinalScore = 0.7*RecentScore + 0.3*HistoricalScore`

说明：子项评分采用“阈值分段 + 线性插值”，并截断到 `[0, 100]`。

## 技术方案

### 架构

- 前端：React + Vite（展示榜单与报告）
- 后端：Node.js + Express + TypeScript
- 数据库：MySQL 8
- 任务：后端内置每日重算任务（上海时区）

### 后端分层

- `routes`: 公共接口、管理接口
- `services`: 评分引擎、榜单生成、重算编排
- `repositories`: MySQL 读写封装
- `middleware`: API Key 鉴权、请求上下文、统一错误结构
- `jobs`: 每日自动重算

### 数据模型（MVP）

- `airports`: 机场基础信息
- `airport_metrics_daily`: 每日指标快照
- `airport_scores_daily`: 每日子分/总分/衰减分
- `airport_rankings_daily`: 每日榜单结果
- `admin_audit_logs`: 管理操作审计

SQL 文件：[`backend/sql/schema.sql`](backend/sql/schema.sql)

## API 设计

### 公共接口

- `GET /api/v1/rankings?type=today|stable|value|new|risk&date=YYYY-MM-DD`
- `GET /api/v1/airports/:id/score-trend?days=30`
- `GET /api/v1/airports/:id/report?date=YYYY-MM-DD`

### 管理接口（需要 `x-api-key`）

- `POST /api/v1/admin/airports`
- `PATCH /api/v1/admin/airports/:id`
- `POST /api/v1/admin/metrics/daily`
- `POST /api/v1/admin/scores/recompute?date=YYYY-MM-DD`
- `POST /api/v1/admin/complaints`
- `POST /api/v1/admin/incidents`

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

### 2. 配置后端环境变量

```bash
cp backend/.env.example .env
```

按需修改 `.env` 中 MySQL 与 `ADMIN_API_KEY`。

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

## 当前 MVP 边界

- 当前阶段不接入真实探测器（HTTP/tcp/curl），以管理接口手动录入数据为主
- 鉴权采用静态 API Key（未实现账号密码/JWT）
- 管理端目前是 API 形态，管理后台 UI 后续可补
