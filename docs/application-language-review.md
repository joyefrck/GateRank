# 入驻申请语言攻击审核

公开申请在 Cloudflare Turnstile 后端验证通过后，调用 DeepSeek 判断名称和简介是否包含针对对象的辱骂、骚扰、威胁、群体仇恨或攻击性脏话。只有有效 `allow` 结果可以创建申请、账号、钱包及发送通知。未支付申请编辑和运营资料编辑同样在写入前审核，改邮箱时审核失败不会消费验证码。

## 提示词与输入

固定提示词：`backend/src/services/applicationModerationPrompt.ts`，版本 `language-attacks-v1`。提示词不包含网站名、业务名或行业背景，不增加政治判断。模型对输入主题的实际处理仍取决于供应商。

`system` 只包含固定提示词，`user` 只有以下序列化结构：

```json
{"fields":{"text_1":"名称文本","text_2":"简介文本"}}
```

测试账号、密码、邮箱、Telegram、官网、订阅链接、Turnstile token 和原始请求体不会发送给模型。用户自行写入名称/简介的内容会被发送，因此不要在这些字段填写凭据。审核副本处理 NFKC 全半角和不可见格式字符，业务存储仍沿用原有文本处理。名称上限 128、简介上限 4000，按 JavaScript 字符串长度计算，与 HTML maxLength 一致；禁止静默截断后审核。

## 服务端配置

在 ignored 的 `backend/.env` 或容器服务端环境配置中设置，禁止使用 `VITE_` 变量保存 Key：

```dotenv
APPLICATION_MODERATION_ENABLED=1
DEEPSEEK_API_KEY=
DEEPSEEK_MODERATION_MODEL=deepseek-flash
APPLICATION_MODERATION_TIMEOUT_MS=15000
APPLICATION_MODERATION_MAX_CONCURRENT=4
APPLICATION_IP_RATE_LIMIT_MAX=50
```

- 生产默认开启，缺少 Key 时提交返回 503。开发环境在提供 Key 或显式开启时启用；`APPLICATION_MODERATION_ENABLED=0` 只用于本地开发。
- 使用固定官方 HTTPS endpoint，不跟随重定向，不自动重试，不提供模型工具。JSON mode、非思考模式、temperature 0、max_tokens 1024。
- 超时默认 15 秒，可配置 100–30000 毫秒；并发默认每个进程 4 个，可配置 1–16，超过上限返回 503。生产 `createApp` 中的两个 router 共享审核实例。
- 保留原有每 IP+邮箱 15 分钟 10 次限流；公开提交另加每 IP 15 分钟 50 次上限，后台两类编辑共享各自的 IP 上限。多副本部署的计数和并发上限均按进程计算。
- Key 不记录到日志或版本库。不要记录输入、上游原始响应、模型理由或带认证信息的 fetch 异常。

## 返回行为

| 模型结果 | API 行为 |
|---|---|
| `allow` 且 `issues=[]` | 继续原业务流程 |
| 有合法 issues 的 `reject` | 422 `APPLICATION_CONTENT_REJECTED`，固定中文提示相关字段 |
| 有合法 issues 的 `review` | 422 `APPLICATION_CONTENT_REVIEW_REQUIRED`，提示调整措辞或联系管理员 |
| 超时、HTTP 错误、空输出、截断、无效 JSON、未知字段或类别、结构矛盾 | 503 `APPLICATION_MODERATION_UNAVAILABLE`，不继续业务 |

后端严格校验指定键、decision/category 枚举、issues 数量和理由长度，不把模型理由直接交给用户。失败保留前端表单，并沿用 Turnstile 的单次令牌刷新逻辑。

## 验证

```sh
node --import tsx --test backend/tests/applicationModerationService.test.ts backend/tests/applicationModerationRoutes.test.ts backend/tests/turnstileRoutes.test.ts backend/tests/turnstileService.test.ts
npm run server:typecheck
npm run lint
npm run test:backend
npm run build -- --outDir /tmp/gaterank-language-review-build
```

有服务端 Key 时，可以显式运行真实模型检查（6 次调用，仅使用合成文本，不查询或写入任何申请）：

```sh
node --import tsx scripts/verify-application-moderation.ts
```

正常介绍、合理批评和用于举报的辱骂引用应通过；直接辱骂、变体辱骂及带有操纵指令的辱骂应拒绝。提示词分离不等于保证模型永远无法绕过，有限样本只能证明本次样本结果。

发布前须在生产服务端配置 Key；发布时需验证对应提交的 CI、API/Web 配对部署、正常页面、人机验证和审核业务拦截。开发环境的测试结果不能代替生产验收。
