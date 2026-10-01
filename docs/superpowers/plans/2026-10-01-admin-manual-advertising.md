# 管理员手动广告配置 Implementation Plan

> **For agentic workers:** 按任务在当前会话直接实施和验证；用户已明确无需后续询问。

**Goal:** 管理员可免费配置首页广告和优惠码活动，复用公开展示与统计。

**Architecture:** 在现有 campaign 表加入来源和操作人，允许手动记录没有商家钱包。独立的共享类型、输入解析与后台页面承载新功能，仓库统一处理事务和占位。

**Tech Stack:** React / TypeScript / Express / MySQL / Node test。

### Task 1: 输入契约与数据持久化
- [x] 创建 `shared/manualAds.ts` 和 `backend/src/utils/manualAdInput.ts`，校验正整数机场 ID、1–5 位、文本长度、百分比及明确时区的开始/结束时间。
- [x] 修改 `backend/src/repositories/airportAdCampaignRepository.ts` 与 `backend/sql/schema.sql`，新增来源和操作人字段，所属账号等允许 NULL，记录免费金额和零购买月数。
- [x] 新增手动投放列表、保存及下架方法。共享锁必须在读取 campaign 或检查位之前取得；冲突使用 `starts_at < new_end AND ends_at > new_start`，排除本次编辑 ID。
- [x] 商家购买、延期和续期也使用完整目标区间冲突检查。测试不扣款、预约冲突、相邻时间允许、越权编辑拒绝与 rollback。

### Task 2: 管理员接口
- [x] `backend/src/routes/adminRoutes.ts` 新增 GET/POST/PATCH 手动广告接口，使用现有 adminAuth、actor、audit、publicPageCache。
- [x] 候选机场分页搜索，完整保存字段由同一解析器校验；错误输入 400、占位冲突 409、非手动/不存在 404。
- [x] 使用 Express 测试验证 CRUD、校验、鉴权、审计及缓存清除。

### Task 3: 后台界面
- [x] `MarketingModuleTabs.tsx` 和 `AdminApp.tsx` 接入第三个 Tab、路由与菜单选中。
- [x] 创建 `MarketingConfigurationPage.tsx`：可筛选分页列表、表单弹窗、机场搜索、投放位、优惠内容、时间与保存/下架交互。
- [x] `MarketingStatisticsPage.tsx` 将零购买月数显示为管理员手动投放。
- [x] 浏览器验证桌面、手机、错误恢复、保存及下架，保持可访问性。

### Task 4: 最终验证
- [x] `npx tsx --test backend/tests/manualAd*.test.ts backend/tests/airportAdCampaignRepository.test.ts backend/tests/adminMarketingUi.test.ts`，确认测试没有失败。
- [x] `npm run lint`、`npm run server:typecheck`、`npm run build -- --outDir /tmp/gaterank-manual-ads-build`，构建不覆盖已有 dist。
- [x] 检查 diff 和需求覆盖，报告验证结果及未执行的生产操作。

## 验证结果

- 全量后端：1,154 项通过，0 项失败，8 项显式跳过；其中新增 MySQL 集成测试已通过显式端口另行运行。
- 真实 MySQL：旧表迁移重复执行、免费 CRUD、并发占位、相邻时段、商家购买/延期/续期冲突、前台读取与统计聚合通过。
- Chrome：桌面和 390px 手机布局、新增首页广告和普通优惠码活动、冲突反馈、日期修改、待投放统计、下架、空结果及恢复通过，控制台无错误。
- 前后端类型检查与 Vite 生产构建通过，构建输出位于独立临时目录，未覆盖现有 dist。

- 前台 React/SSR 渲染回归：2 项通过，覆盖无优惠码、标题回退与商家已有优惠码复制按钮；测试位于前台目录，避免浏览器模块进入后端类型检查范围。
- 最终前后端类型检查、构建和 diff 空白检查通过。本次临时预览服务与独立 MySQL 容器已清理。
