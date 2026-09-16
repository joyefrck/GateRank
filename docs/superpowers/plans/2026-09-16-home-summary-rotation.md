# 首页分类推荐轮换 Implementation Plan

**Goal:** 将首页性价比及长期稳定栏目改成已确认的达标公平轮换。

**Architecture:** 门槛纯函数筛选完整候选，现有轮换服务分别保存两个队列，首页只取轮换结果并保留真实分数。

**Tech Stack:** TypeScript、MySQL、React、Express、node:test。

- [x] 新增 `backend/src/utils/homeSummaryEligibility.ts` 及边界测试，明确稳定性/价格明细口径与风险排除。
- [x] 扩展 `homeAirportRotationService.ts`：状态行 2/3、全量当日候选查询、事务内分别推进队列。增加 MySQL 并发、完整候选和恢复测试。
- [x] 更新 `publicViewService.ts`：首页不再使用旧 stable/value 分类榜或分数兜底，按返回 ID 顺序构造卡片，透出轮换时间；正式排行保持不变。
- [x] 更新共享文案、接口类型、`HomePageV3.tsx` 和 `publicPageRenderer.ts`，最早到期自动刷新，保持卡片样式。
- [x] 执行相关 node:test 回归、`npm run lint`、`npm run server:typecheck`、`npm run build -- --outDir /tmp/gaterank-summary-rotation-build`，用 Chrome 验证桌面及手机。

用户已授权本地执行，在当前分支完成，不新建分支，不提交、推送或部署。

## 验证结果

- `GATERANK_ROTATION_TEST_PORT=13369 npm run test:backend`：1077 项，1074 通过、0 失败、3 项按独立环境开关跳过。两个轮换 MySQL 集成测试实际执行通过。
- 隔离 MySQL 8.0：57 家稳定候选、56 家性价比候选完整轮换，每家每轮获得一次首位；验证 24 并发、服务重建、阈值失效/恢复、配置间隔变化及 id=1 队列隔离。
- 前后端类型检查通过，生产构建输出 `/tmp/gaterank-summary-rotation-build`；构建仅有现有的大 chunk 提示。
- 实际本地 API 返回两个独立栏目的轮换信息；Chrome 桌面与 390×844 验证标题、副标题、空态，手机 scrollWidth=390，无控制台错误。本地业务数据无达标候选，未为视觉验收修改机场评分或门槛；有候选的顺序与评分由接口测试和真实 MySQL 集成测试验证。
- 源码审查及 diff 空白检查通过。工作保留在当前分支，未提交、推送或部署。
