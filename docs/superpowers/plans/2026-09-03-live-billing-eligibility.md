# 实时计费资格与评分隐藏修复计划

**Goal:** 余额不足当前榜位点击费时隐藏公开评分，充值足额自动恢复，所有公开入口与实际扣费使用同一资格算法。

**Architecture:** 按未受余额影响的评分顺序逐一分配有资格的榜位；不合格条目保留本次尝试榜位的费率、不占位、不降价重试。资格从当前数据库读取，在 SQL 分页之前应用。扣费事务锁定钱包后再读取资格。评分响应不复用旧页面缓存；SSE 通知已打开页面重新取数。

**Tech Stack:** TypeScript, React, Express, MySQL, node:test, Docker.

## 已批准范围

用户要求立即实施且不再询问。沿用当前分支，保留已有生成物改动。不改计价配置、不补扣、不删除机场、不修改真实评分，保留不足余额免费访问。

## 执行顺序

- [x] 先新增 `backend/tests/billingEligibility.test.ts`，使用合成数据覆盖阶梯费率不足、递补、恰好足额、扣款后不足和充值恢复。运行 `node --import tsx --test backend/tests/billingEligibility.test.ts`，确认旧实现失败。
- [x] 新建 `backend/src/services/billingEligibilityService.ts`，实现按候选顺序分配榜位的纯函数和实时数据库查询。每次判断用整数分比较：`Math.round(balance * 100) >= Math.round(price * 100)`；隐藏项不增加有效排名计数。
- [x] 接入 `scoreRepository.ts`、`applicantBillingRepository.ts`、`app.ts`。全榜资格在筛选分页前注入 SQL；报告使用同一资格；扣费在钱包锁内重新获取单价。保留未注入服务的仓储测试兼容路径。
- [x] 修改 `publicCache.ts`，含实时评分的 home/full-ranking/risk-monitor/report 缓存键直接执行 loader；对应 HTML/API 使用 no-store，其他内容保留现有缓存。增加 SSE 状态变更通知和前端共享刷新订阅，连接恢复时重新校验。
- [x] 运行聚焦回归、`npm run lint`、`npm run server:typecheck`、`npm run test:backend`、`npm run build`、`git diff --check`，逐项确认完成输出；完整后端 928/928 通过，并在生产数据库只读事务中验证所有可见排名与计费资格一致。
- [ ] 仅提交本次源码/测试/计划。核对远端、CI 镜像及生产编排漂移，保留 Web/API 回滚镜像，再成对发布。生产只读验收 Now/Nice 评分隐藏、榜位递补、余额不变、HTTP 缓存策略、SSE、容器与健康接口；不发送真实计费请求。

## 一致性与实时边界

新请求实时读取数据库资格，不依赖计划任务或下一次点击；已打开页面收到 SSE 后重取。服务端统一检测余额、费率、评分变化（1 秒周期），仅在公开资格变化时广播，避免每次点击都触发全站页面刷新。断开连接后重连会强制刷新。
