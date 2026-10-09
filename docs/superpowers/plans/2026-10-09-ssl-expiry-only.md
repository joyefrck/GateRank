# SSL 仅过期扣分实现计划

**Goal:** 只有确认过期的证书触发 SSL 扣分及预警。

**Architecture:** 在风险工具中统一有限负数判断，评分引擎及公开风险卡片复用；风险原因不再使用旧临期扣分作为失效证据。

**Tech Stack:** TypeScript、Node test、React、Vite。

- [x] 修改 `backend/tests/scoringEngine.test.ts`、`risk.test.ts`、`homeSummaryEligibility.test.ts`，验证有效、未知、过期及旧快照边界；先运行确认失败。
- [x] 修改 `backend/src/utils/risk.ts`、`services/scoringEngine.ts`、`services/publicViewService.ts`，同步 `src/admin/AdminApp.tsx` 和 README。
- [x] 增加公开卡片回归验证；运行相关测试及 `npm run test:backend`、`npm run lint`、`npm run server:typecheck`。
- [x] `npm run build -- --outDir /tmp/gaterank-ssl-expiry-build-20261009` 验证构建，检查生成公式和 `git diff --check`，更新计划并交付。

本地修改阶段已完成且未操作生产；用户随后授权立即发布生产，并重新体检及重算熊猫cloud当天风险分。

发布按 GitHub 提交推送、同 SHA 镜像 CI 成功、生产配置与相关数据备份、Web/API 成对更新、风险任务及公网/浏览器验收的顺序执行。仅提交本次文件，保留所有无关本地修改。

验证结果：相关测试 60/60；完整后端测试 1160 通过、0 失败、8 个数据库集成测试未启用而跳过；前后端类型检查和构建通过。构建产物确认包含新公式且不含旧临期扣分说明，`git diff --check` 通过。构建保留现有的大体积 chunk 提示；既有 dist 及无关本地修改未覆盖。
