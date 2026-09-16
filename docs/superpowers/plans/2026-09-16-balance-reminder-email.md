# 余额邮件催促 Implementation Plan

**Goal:** 管理员从余额弹窗发送带充值超链接的 HTML 催促邮件。

**Architecture:** 独立邮件渲染函数接入现有 MailService；管理员 POST 接口解析机场、联系邮箱和最新钱包余额；独立 React 按钮管理发送反馈与冷却。复用现有 SMTP、后台 URL 生成与管理员鉴权。

**Tech Stack:** React、TypeScript、Express、Nodemailer、node:test。

- [x] 在 `backend/src/services/balanceReminderEmail.ts` 实现 `renderBalanceReminderEmail`，输出 subject/text/html。动态名称及 URL 转义，URL 仅允许 http/https，按钮和完整地址均链接到 `/portal`。
- [x] 在 `mailService.ts` 增加 `sendBalanceReminderEmail`，使用 `requireConfigured` 和 `sendWithConfig`，配置或发送失败向上抛出。
- [x] 在 `adminRoutes.ts` 增加 `POST /airports/:id/balance-reminder`。读取机场、钱包与收件人；一分钟限发一次，失败不占用冷却；成功记录审计，返回邮箱与余额，SMTP 错误转为明确 HTTP 错误。
- [x] 新增 `src/admin/BalanceReminderButton.tsx` 并挂入余额弹窗。请求期间禁用按钮，成功显示邮箱并冷却 60 秒，失败显示错误；按机场 ID 挂载，避免切换机场时显示旧请求结果。
- [x] 在 `mailService.test.ts` 和 `adminRoutes.test.ts` 补充发送、转义、链接、回退、错误和限流测试。运行 `node_modules/.bin/tsx --test backend/tests/mailService.test.ts backend/tests/adminRoutes.test.ts`。
- [x] 运行 `npm run lint`、`npm run server:typecheck`、`npm run build -- --outDir /tmp/gaterank-balance-reminder-build`，检查浏览器桌面和手机布局及发送反馈。使用本地模拟数据与捕获邮件，不发送真实邮件。

验证结果：118 项相关测试通过；前后端 TypeScript 检查通过；生产构建通过（保留现有大包体积提示）。Chrome 检查了桌面和 390px 手机尺寸的余额弹窗、发送成功/冷却、无邮箱错误提示，以及 HTML 邮件正文与两个充值超链接。使用本地模拟数据及 SMTP 替身，未进行真实邮件投递。
