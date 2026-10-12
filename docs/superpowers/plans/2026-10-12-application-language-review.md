# Application Language Review Implementation Plan

> 执行方式：在当前分支内顺序实施，复用已批准的设计，不创建分支。用户追加授权直接发布生产并配置 API。

**Goal:** Cloudflare 验证后，通过中性的 DeepSeek 文本审核保护申请创建和后续资料修改。

**Architecture:** 独立固定提示词、可注入 fetch 的审核服务，以及共享给公开和个人后台路由的服务实例。后端只序列化名称和简介为中性文本字段，校验返回结构后才允许业务变更。

**Tech Stack:** TypeScript、Express、Node fetch、node:test、React。

---

### Task 1: 审核协议与安全边界

Files: `backend/src/services/applicationModerationPrompt.ts`, `backend/src/services/applicationModerationService.ts`, `backend/tests/applicationModerationService.test.ts`。

- [x] 测试固定 endpoint、system/user 分离、JSON mode、敏感字段排除，以及正常/违规/不确定结果。
- [x] 测试缺少配置、网络失败、HTTP 错误、空输出、截断、额外键、未知字段/枚举、理由过长、allow 携带 issues 均不放行。
- [x] 实现 `createApplicationModerationService(env, fetcher)`，`verify({ name, airport_intro }): Promise<void>`，最大 128/4000 字符、默认 15 秒超时、最多 4 个并发；只在合法 allow 结果时成功返回。
- [x] 执行 `node --import tsx --test backend/tests/applicationModerationService.test.ts`，确认先失败再通过。

### Task 2: 路由和副作用边界

Files: `backend/src/routes/publicRoutes.ts`, `backend/src/routes/portalRoutes.ts`, `backend/src/app.ts`, `backend/src/middleware/rateLimit.ts`, `backend/tests/applicationModerationRoutes.test.ts`。

- [x] 公开提交在构造已验证的 applicationInput 后、repository.create 前调用 `await applicationModeration.verify(applicationInput)`。
- [x] 未支付编辑在审核通过后消费邮箱验证码并写入资料；运营编辑在审核通过后写入和同步正式资料。
- [x] `createApp` 创建一个审核服务实例传给两个 router。独立 IP 限流保持现有 IP+邮箱隔离规则。
- [x] HTTP 测试确认 Turnstile 失败时不调用模型；reject/review/503 时不创建账号、钱包、通知或邮件，也不消费验证码或同步正式资料；allow 继续正常流程。

### Task 3: 配置、界面与验证

Files: `backend/.env.example`, `backend/.env` (ignored), `src/App.tsx`, `docs/application-language-review.md`。

- [x] 在 `.env.example` 记录 `APPLICATION_MODERATION_ENABLED`, `DEEPSEEK_API_KEY`, `DEEPSEEK_MODERATION_MODEL`, `APPLICATION_MODERATION_TIMEOUT_MS`, `APPLICATION_MODERATION_MAX_CONCURRENT`, `APPLICATION_IP_RATE_LIMIT_MAX`，不写真实 Key。
- [x] Key 仅写入权限为 600 的 ignored `backend/.env`；运行时保留其他环境配置。
- [x] 保留页面布局，提交按钮使用“校验并审核中…”，名称/简介限制同步后端，错误使用可访问的 alert。
- [x] 用真实 API 检验正常介绍、合理负面评价、引用攻击、直接辱骂、变体及提示词注入合成样本；不操作生产资料。
- [x] 执行 `npm run server:typecheck`, `npm run lint`, `npm run test:backend`, `npm run build -- --outDir /tmp/gaterank-language-review-build`，检查 diff 和敏感信息泄漏。
- [x] 更新本文件完成状态并报告代码/测试/真实模型结果。

### Task 4: 生产发布

- [ ] 推送当前 main 的明确业务文件，等待相同 SHA 的 `docker-publish.yml` 两个镜像均成功。
- [ ] 备份实际生效的 Compose、override、环境文件与原镜像元数据，备份权限 700。
- [ ] 私密传输服务端 Key，验证合并配置开启审核并保留 Turnstile，然后成对部署完整 SHA 的 API/Web 镜像。
- [ ] 检查生产容器、健康、manifest 一致、目标页面版本、缺失/伪造 Turnstile 拦截及生产进程内合成文本真实模型验证。
