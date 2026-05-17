# GateRank 安全审查报告

日期：2026-05-17
范围：本地静态代码审查，覆盖 TypeScript / Express / React 代码库，并运行 `npm audit --omit=dev`。

## 执行摘要

这个项目目前存在需要修复的安全问题。在把当前版本视为生产环境安全加固完成之前，建议先处理这些风险。

优先级最高的问题包括：生产依赖存在已知漏洞、登录入口缺少防爆破限流、认证密钥存在弱默认值或复用 fallback、Express 基础安全加固不完整。我没有发现 `.env` 文件被提交到 git；抽查到的 SQL 路径大多使用参数化查询；支付回调有签名校验，这是正向安全控制。

## Critical 严重

### SEC-001：`sanitize-html` 存在漏洞，且用于新闻内容清洗

- 严重级别：Critical
- 位置：`package.json:34`，`backend/src/services/newsContentService.ts:99`
- 证据：`sanitize-html` 是直接生产依赖，lockfile 中版本为 `2.17.2`；`npm audit --omit=dev` 报告 `sanitize-html <=2.17.3` 存在 critical XSS advisories。后端使用它清洗 Markdown 渲染后的 HTML。
- 影响：如果 sanitizer 被绕过，攻击者可通过新闻内容形成存储型 XSS。由于 admin 和 portal token 存在浏览器 localStorage，一旦同源页面 XSS 成功，就可能窃取 token。
- 修复：升级 `sanitize-html` 到已修复版本，重新生成 `package-lock.json`，并补充恶意 Markdown/HTML payload 的回归测试。
- 缓解：确认前端 bundle 兼容后，为 public/news 页面增加严格 CSP。

### SEC-002：未使用的 `@google/genai` 引入了 critical `protobufjs` 漏洞

- 严重级别：Critical
- 位置：`package.json:19`
- 证据：`npm audit --omit=dev` 报告 `protobufjs <=7.5.5` 存在 critical/high advisories。`npm ls` 显示它由 `@google/genai@1.46.0` 引入。仓库搜索只在 `package.json` 中发现 `@google/genai`，看起来业务代码没有使用。
- 影响：如果后续代码使用该包处理攻击者可控的 protobuf 输入，相关 advisory 覆盖代码执行和拒绝服务风险。即便当前未使用，也增加了生产供应链暴露面。
- 修复：如果不需要 `@google/genai`，直接移除；如果需要，升级到解决 `protobufjs` 漏洞的版本。
- 缓解：未使用的 AI SDK 不应保留在生产依赖里。

## High 高危

### SEC-003：Vite dev server 有高危 advisory，且默认绑定所有网卡

- 严重级别：High
- 位置：`package.json:37`，`package.json:7`
- 证据：`npm audit --omit=dev` 报告 `vite <=6.4.1` 有 high advisories。dev 脚本为 `vite --port=3000 --host=0.0.0.0`，会监听所有网卡。
- 影响：如果 dev server 被局域网或公网访问，Vite 的文件读取/路径穿越类漏洞可能泄露本机文件。
- 修复：升级 Vite，并把默认 dev 监听地址改为 `127.0.0.1`；如确实需要局域网访问，单独提供显式脚本。
- 缓解：防火墙限制本地 dev 端口，生产环境绝不暴露 Vite dev server。

### SEC-004：admin 和申请人登录入口没有可见限流

- 严重级别：High
- 位置：`backend/src/routes/adminAuthRoutes.ts:8`，`backend/src/routes/portalRoutes.ts:203`，`backend/src/routes/portalRoutes.ts:219`，`backend/src/routes/portalRoutes.ts:245`
- 证据：登录和登录启动接口可反复 POST。仓库搜索没有发现 `express-rate-limit`、`rateLimit` 或等价中间件。
- 影响：攻击者可以爆破单一 admin 密码、申请人密码，或滥用 OAuth/Telegram 登录流程创建。
- 修复：对 `/api/v1/admin/login`、`/api/v1/portal/login`、OAuth start/complete、Telegram login start/complete 增加限流。限流 key 建议结合 IP 和账号标识。
- 缓解：对连续失败登录增加审计和告警。

### SEC-005：认证密钥存在共享 fallback 和默认值

- 严重级别：High
- 位置：`backend/src/utils/adminAuthConfig.ts:12`，`backend/src/utils/adminAuthConfig.ts:13`，`backend/src/utils/adminAuthConfig.ts:14`，`backend/src/utils/portalAuthConfig.ts:10`
- 证据：admin UI 密码默认回退到 `ADMIN_API_KEY`，admin JWT secret 也默认回退到 `ADMIN_API_KEY`，portal JWT secret 最终会回退到静态字符串 `gaterank-applicant-portal`。
- 影响：生产环境如果缺少 env 配置，可能导致 token 可伪造，或者一个泄露的 admin API key 同时变成多个安全边界的密钥。
- 修复：生产环境强制要求分别配置高强度的 `ADMIN_UI_PASSWORD`、`ADMIN_API_KEY`、`ADMIN_JWT_SECRET`、`APPLICANT_PORTAL_JWT_SECRET`；缺失或过短时启动失败。
- 缓解：部署严格校验后轮换现有密钥。

### SEC-006：Vite `define` 存在客户端打包泄露 secret 的风险

- 严重级别：High
- 位置：`vite.config.ts:61`
- 证据：Vite 将 `env.GEMINI_API_KEY` 定义为 `process.env.GEMINI_API_KEY`。当前仓库搜索没发现运行时代码使用它，但任何前端引用都会把该值内联进浏览器 JS。
- 影响：如果 build 时设置了 `GEMINI_API_KEY`，且前端代码引用了它，该 key 会变成公开信息。
- 修复：移除这条 `define`。AI/API secret 只能由服务端读取和使用。
- 缓解：所有 Vite 暴露给前端的配置都应视为公开值。

## Medium 中危

### SEC-007：Express 基础安全加固不完整

- 严重级别：Medium
- 位置：`backend/src/app.ts:215`，`backend/src/app.ts:216`，`backend/src/app.ts:217`，`backend/src/app.ts:220`
- 证据：Express app 未使用 `helmet`，未关闭 `x-powered-by`，JSON/urlencoded parser 没有项目级明确 limit。
- 影响：缺少浏览器安全头会削弱 XSS/clickjacking 防御纵深；如果边缘层没有处理，Express 指纹也会暴露。
- 修复：增加 `helmet`，调用 `app.disable('x-powered-by')`，设置明确 parser limits，并验证生产响应头。
- 缓解：如果 Nginx/CDN 已设置这些 header，需要文档化并用运行时检查验证。

### SEC-008：CORS 全局放开，且允许 privileged headers

- 严重级别：Medium
- 位置：`backend/src/app.ts:220`
- 证据：所有响应都设置 `Access-Control-Allow-Origin: *`，并允许 `Authorization` 和 `x-api-key`。
- 影响：Bearer token 不会像 cookie 那样自动发送，所以这本身不是 CSRF。但如果任何 privileged token/key 泄露，任意网站都可以从浏览器调用 API 并读取响应。
- 修复：把 CORS origin 限制到生产站点和明确的本地开发 origin；如果公开只读接口确实需要 wildcard，应按路由拆分策略。
- 缓解：采用 route-specific CORS policy。

### SEC-009：浏览器 token 存储在 localStorage

- 严重级别：Medium
- 位置：`src/admin/AdminApp.tsx:1035`，`src/admin/AdminApp.tsx:1262`，`src/App.tsx:902`，`src/App.tsx:907`
- 证据：admin 和申请人 portal bearer token 从 localStorage 读取并写入 localStorage。
- 影响：任何同源 XSS 都能窃取长期有效的 admin 或 portal token。
- 修复：优先改为 HttpOnly、SameSite cookie，并配套 CSRF 防护；如果必须保留 bearer token 存储，则缩短 TTL，并增加 refresh/session revocation 机制。
- 缓解：在迁移 token 存储前，优先修复 XSS 依赖漏洞并增加 CSP。

### SEC-010：支付 origin 构造在缺配置时会信任请求 header

- 严重级别：Medium
- 位置：`backend/src/routes/portalRoutes.ts:1458`，`backend/src/routes/portalRoutes.ts:1464`，`backend/src/utils/siteUrl.ts:9`
- 证据：当 `notify_origin`、`PAYMENT_NOTIFY_ORIGIN`、`API_BASE` 都未配置时，支付 notify/return origin 会回退到 `x-forwarded-*`、`host`、`origin` 或 `referer`。
- 影响：如果反向代理没有清洗这些 header，且支付 origin 未配置，生成的支付回调/返回地址可能受到 Host header 影响。
- 修复：启用支付时强制要求配置 `notify_origin` 或 `PAYMENT_NOTIFY_ORIGIN`。支付回调 origin 不应从客户端可控请求 header 推导。
- 缓解：在 Nginx/CDN 层强制 canonical host header。

## 低风险项 / 正向发现

- `.env` 和 `backend/.env` 已被 git ignore，没有被 git 跟踪；仅 `backend/.env.example` 被跟踪。
- 已审查的支付通知路由在标记订单已支付前会调用 `verifyNotificationPayload`。
- 新闻上传文件名使用服务端生成 UUID，并设置了文件大小限制。
- 多数 repository 查询使用 `execute` / `query` 参数占位；抽查的 request-to-query 路径未发现确定 SQL 注入。

## 已执行的验证命令

- `npm audit --omit=dev --json`
- `npm ls sanitize-html protobufjs vite path-to-regexp picomatch nodemailer geoip-country ip-address postcss @protobufjs/utf8 --all --omit=dev`
- 使用 `rg` 搜索 auth、CORS、Helmet/rate-limit、DOM XSS sink、redirect、shell execution、filesystem、SQL、secret patterns
- 人工审查 Express app bootstrap、auth middleware/routes、portal payment routes、news rendering/upload paths、Vite config
