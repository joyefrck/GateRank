# 官网风险检测 Implementation Plan

> 在当前会话按下面顺序执行；用户已授权修复。保持当前分支，不覆盖已有构建产物及运行日志。

**Goal:** 消除无协议地址误判，区分 Cloudflare 挑战与服务故障，提供持久化诊断。

**Architecture:** 共用地址规范化工具；独立网络检测模块输出结构化结果；服务编排与仓库事务负责风险指标及诊断原子落库；后台读取诊断并复用现有字段样式。

**Tech Stack:** TypeScript、Node HTTP/TLS、MySQL、React、node:test。

- [x] 新增地址/分类/网络边界回归测试，确认旧实现失败。
- [x] 新增 shared/websiteUrl.ts、shared/riskCheck.ts，接入 admin/portal 写入口及两个机场仓库写入路径。
- [x] 新增 backend/src/services/websiteProbe.ts，实现有界探测、重定向、TLS 与诊断脱敏；riskCheckService.ts 保留编排职责。
- [x] 新增 RiskCheckRepository，事务写风险字段与每次检测日志；新增表同步到 schema.sql 和启动 ensureSchema。
- [x] 接入 app/admin dashboard 与手动/定时执行摘要，补足配置失败和历史日期诊断查询测试。
- [x] 风险页增加最近检测和可展开明细；公开风险描述避免把可达说成网页正常。
- [x] 执行 node --import tsx --test 针对用例；npm run server:typecheck；npm run lint；npm run test:backend；Vite build 输出临时目录。
- [x] 本地浏览器验证桌面与手机宽度；检查 Git diff，只汇报本任务改动及未验证的生产部分。


## 验收记录（2026-09-25，北京时间）

- 首次规范化和探测回归在旧实现上失败，随后实现通过。
- `GATERANK_RISK_TEST_PORT=33199 npm run test:backend`：1137 项，1131 通过，6 项环境条件跳过，0 失败。
- 独立临时 MySQL 5.7 实测表创建、重复初始化、指标与诊断事务回滚、旧指标保留和历史日期查询；已关闭测试实例。
- `npm run server:typecheck`、`npm run lint` 均通过。
- `npm run build -- --outDir /tmp/gaterank-risk-build` 通过；仍有构建器原有的大 chunk 提示，未覆盖仓库 dist。
- Chrome 对真实 RiskCheckDetails 组件的本地测试数据进行桌面、390px 窄屏及展开明细验收；无横向溢出，已恢复视口并关闭临时页面和服务。
- 本机默认 DNS 返回非公网代理地址，校验返回 NON_PUBLIC_TARGET。独立公网 DNS 查询获得 Cloudflare 公网地址后，新函数真实请求返回 challenge / HTTP 403 / domain_ok=true / SSL 74 天，耗时约 1 秒。未修改系统 DNS 或任何生产状态。
- 以上为本地修复验收记录；随后用户已授权生产发布，发布后需另核对当日诊断、指标、重算评分及公开说明。
