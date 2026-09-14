# GateRank 首页优秀机场 Implementation Plan

**Goal:** 实现已确认的公平轮换、营销间隔配置及首页命名调整。

**Architecture:** 独立纯函数处理完整轮换队列；MySQL 单行事务保存进度并复用现有扣费资格服务。首页按选中的 ID 读取展示数据，完整评分榜继续使用原有查询。

**Tech Stack:** TypeScript、MySQL、Express、React、Vite、node:test。

- [x] 在 `backend/src/utils/homeAirportRotation.ts` 实现 `advanceHomeAirportRotation(previous, candidateIds, now, intervalMinutes, random)`，并在 `backend/tests/homeAirportRotation.test.ts` 用固定随机源、虚拟时钟验证五选四及资格变化。
- [x] 在 `backend/src/services/homeAirportRotationService.ts` 创建数据库表、`SELECT ... FOR UPDATE` 锁定状态、查询付费及充值候选、复用 `BillingEligibilityService.getSnapshot(connection)` 后提交新状态。`backend/src/app.ts` 初始化并注入。
- [x] 在 `marketingSettingsService.ts` 增加 `home_rotation_interval_minutes`，默认 120，验证整数 1–10080；`adminRoutes.ts` 解析请求；`AdminApp.tsx` 增加分钟输入框并保存回填。
- [x] 在 `scoreRepository.ts` 支持按首页已选中的机场 ID 限定查询；`publicViewService.ts` 先轮换后取数据，首页序号按队列重新编号，返回时段元数据，保留完整评分榜方法与报表行为。
- [x] 在 `HomePageV3.tsx` 和 `publicPageRenderer.ts` 同步优秀机场标题、轮换说明、展示序号和空态，移除 10 家截断；React 到期/回到前台刷新。
- [x] 运行 `npx tsx --test backend/tests/homeAirportRotation.test.ts backend/tests/marketingSettingsService.test.ts backend/tests/publicViewService.test.ts`，修正并扩展与变更相关的回归。
- [x] 运行 `npm run lint`、`npm run server:typecheck`、`npm run build`；通过 Chrome 验证桌面及移动页面、营销配置。

用户已授权按方案直接实施，在当前 main 完成；保留原有未提交的构建产物和上传文件。本次不包含生产部署。

## 验证结果

- 全量后端回归：1012 项，1008 通过，4 项按各自数据库测试开关跳过，0 失败。首次并行全量中的 `/for-ai` 测试曾出现 404/500 不匹配；单文件 11/11 通过，再次完整运行通过。
- 另外启动隔离 MySQL 8.0 测试容器，实际执行轮换数据库集成测试：成功。覆盖 24 个并发请求、服务重建后续轮、余额退出/恢复、排除未付费/未充值/余额不足/下架/跑路机场，以及扣费档位不受首页展示位置影响。
- 前后端类型检查及 `git diff --check` 通过。生产构建使用 `npm run build -- --outDir /tmp/gaterank-4-rotation-build`，保留工作区原有 dist 改动。
- Chrome 真实本地首页空态验证通过；隔离五家机场数据下，桌面和 390×844 手机布局验证通过。自动到期由 ABCD 变为 BCDE，无手动刷新；浏览器无控制台错误。
- 隔离营销模块将 120 分钟改为 30 分钟，保存成功且重载回填正确。实际业务库未修改营销设置或机场余额。
- 当前 main 源码已完成，未提交、推送或部署生产环境。
