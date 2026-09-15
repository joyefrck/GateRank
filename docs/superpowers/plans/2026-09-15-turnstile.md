# Turnstile Implementation Plan

**Goal:** 为申请登录及提交申请加入端到端真人校验，保持页面改动最少。
**Architecture:** 共享前端组件，后端共享验证服务，四个入口在业务处理前验证；运行时公共配置与私密 secret 分离。
**Tech Stack:** React 19、TypeScript、Express 4、Cloudflare Turnstile。

- [x] 检查现有表单、接口、登录限流及 Cloudflare 控制台。
- [x] 新建 `backend/src/services/turnstileService.ts`：固定 HTTPS Siteverify、8 秒超时、2048 字符上限、hostname/action 校验；生产配置缺失拒绝服务。
- [x] 新建 `src/components/TurnstileWidget.tsx`：脚本加载、挂载清理、令牌过期、失败重试；通过 `useTurnstile` 协调提交状态。
- [x] 修改 publicRoutes、portalRoutes、rateLimit、App；四个受保护 POST 为申请、邮箱密码登录、X 登录发起、Telegram 登录发起。
- [x] 添加验证服务与路由业务边界测试，并运行 `npx tsx --test backend/tests/turnstile*.test.ts backend/tests/publicRoutes.test.ts backend/tests/portalRoutes.test.ts`。
- [x] 执行 `npm run lint`、`npm run server:typecheck`、`npm run test:backend`、`npm run build -- --outDir /tmp/gaterank-turnstile-build` 和 `git diff --check`，逐项确认结果。
- [ ] 配置 Cloudflare 托管组件并验证桌面/手机布局，核实生产环境与发布条件；保留原工作区改动。

## 验证记录

- 聚焦测试 75/75 通过；全量后端 1023 通过、4 跳过、0 失败。
- 前后端类型检查、独立目录生产构建、git diff --check 通过。
- Chrome 使用 Cloudflare 官方测试小组件验证两个页面的桌面及 390px 手机布局；校验通过后按钮启用，表单布局保留。
- Cloudflare 已创建 GateRank Portal + Apply，托管模式、gate-rank.com 域名、无预清除。生产密钥不写入仓库。
- 用户指定发布顺序：先提交并推送 GitHub，等待对应 SHA 的 Docker 构建成功，再配置生产并成对部署 Web/API。
