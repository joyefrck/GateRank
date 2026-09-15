# 网络覆盖衰减 Implementation Plan

**Goal:** 为所有 v2 机场的 N 分项接入历史指数衰减，减少单次覆盖采集引发的总分波动。

**Architecture:** 在最终评分引擎新增可空原始 N 日序列，筛选有效记录并按日去重后复用 `computeWeightedScore`。所有最终计算入口传入原始历史；存储层继续区分原始值、自动值和人工覆盖。

**Tech Stack:** TypeScript、Node test runner、现有 MySQL repository 与 Express 路由。

## 步骤

- [x] 在 `backend/tests/scoringEngine.test.ts` 增加突降、恢复、连续故障、缺失/无效数据、同日去重测试；先运行确认旧逻辑失败。
- [x] 在 `backend/src/services/scoringEngine.ts` 的 `FinalEngineScoreInput` 增加 `nSeries?: Array<{ date: string; score: number | null | undefined }>`；有效当天 `networkCoverageScore` 覆盖同日历史，经 `computeWeightedScore` 得出 N。
- [x] 在 `backend/src/services/recomputeService.ts` 两个最终计算入口和 `backend/src/repositories/scoreRepository.ts` 的事务内计算传入 `nSeries: history.map(row => ({ date: row.date, score: row.n }))`，始终使用原始字段。
- [x] 在 `backend/src/routes/adminRoutes.ts` 评分预览传入 N 原始日序列，更新 `shared/gateRankScore.ts` 中公式输入说明。
- [x] 在 `backend/tests/networkCoverageDecay.test.ts` 添加 repository 同日重算/人工覆盖测试与 recompute 两个入口测试，在 `backend/tests/adminRoutes.test.ts` 添加后台预览回归测试，覆盖原始值保留及最终分数一致性。
- [x] 运行 `node --import tsx --test backend/tests/scoringEngine.test.ts backend/tests/scoreRepository.test.ts backend/tests/recomputeService.test.ts backend/tests/adminRoutes.test.ts backend/tests/scoreComponents.test.ts`。
- [x] 运行 `npm run test:backend`、`npm run server:typecheck`、`npm run lint` 和 `git diff --check`；审查差异并记录结果。


## 验证结果

- 新增的 6 项评分引擎场景在旧逻辑下失败，接入衰减后通过。
- 聚焦测试：147 passed，覆盖评分引擎、事务内保存、批量/单机场重算、后台预览与分项覆盖。
- 全量后端：1037 passed、4 skipped、0 failed。MySQL 专用集成环境等可选测试仍按原条件跳过，事务内逻辑另有可执行的 repository 回归覆盖。
- `npm run server:typecheck`、`npm run lint`、`git diff --check` 均通过。
- `npm run build -- --outDir /tmp/gaterank-n-decay-build` 通过；仅有既有大包体积提示。构建未覆盖工作区已有 dist 改动。
- Chrome 以本次生产构建和本地模拟 API 数据检查桌面及 390px iframe 窄屏，确认总分公式、覆盖公式和原始分标签显示正常；样例显示原始 N=60、自动 N=87、总分=90.40。这是本地界面验收，不代表生产评分已更新。
- 未提交、未推送、未部署，未重写生产分数。
