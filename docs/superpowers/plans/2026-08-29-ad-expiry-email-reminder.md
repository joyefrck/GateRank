# 广告到期邮件提醒 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在广告到期前第 3、2、1 天北京时间 09:00，向申请人发送按账号合并、可配置的 HTML 续费提醒邮件。

**Architecture:** 扩展现有后台调度任务枚举并新增独立提醒服务。广告仓储提供临期数据，发送记录仓储提供按申请人和日期的幂等状态，提醒服务负责分组与逐收件人容错，邮件服务负责安全渲染 HTML 和纯文本双正文。

**Tech Stack:** TypeScript、Node.js、MySQL、Nodemailer、React、Vite、Node test runner

---

## 文件结构

- 创建 `backend/src/repositories/adExpiryReminderRepository.ts`：临期广告查询与每日发送记录。
- 创建 `backend/src/services/adExpiryReminderService.ts`：按申请人聚合、去重、发送与结果汇总。
- 创建 `backend/tests/adExpiryReminderRepository.test.ts`：Schema、查询边界和状态写入测试。
- 创建 `backend/tests/adExpiryReminderService.test.ts`：聚合、成功跳过、失败重试测试。
- 修改 `backend/src/services/smtpSettingsService.ts`：新增模板键、默认 HTML 模板与旧配置补齐。
- 修改 `backend/src/services/mailService.ts`：新增 HTML/纯文本双正文发送方法和安全变量渲染。
- 修改 `backend/src/types/domain.ts`、`backend/src/repositories/schedulerTaskRepository.ts`、`backend/src/services/adminSchedulerService.ts`、`backend/src/services/schedulerTaskExecutor.ts`：接入独立 09:00 调度任务。
- 修改 `backend/src/app.ts`：创建仓储与服务并注入调度执行器。
- 修改 `src/admin/AdminApp.tsx`：增加模板场景、任务标签和 HTML 编辑提示/安全预览。
- 修改对应后端与管理端静态测试。

### Task 1: 临期广告与发送记录仓储

**Files:**
- Create: `backend/src/repositories/adExpiryReminderRepository.ts`
- Create: `backend/tests/adExpiryReminderRepository.test.ts`

- [ ] **Step 1: 写失败测试**

测试 `ensureSchema()` 创建 `ad_expiry_reminder_deliveries`，唯一键为 `(applicant_account_id, reminder_date)`；测试 `listDueCampaigns('2026-08-29')` 使用北京时间日期范围并只查询 `active` 广告；测试 `getDelivery()`、`markSucceeded()`、`markFailed()` 保存状态但不保存正文。

- [ ] **Step 2: 运行红灯测试**

Run: `npx tsx --test backend/tests/adExpiryReminderRepository.test.ts`

Expected: FAIL，提示仓储模块不存在。

- [ ] **Step 3: 实现最小仓储**

核心接口：

```ts
export interface DueAdCampaign {
  campaign_id: number;
  applicant_account_id: number;
  applicant_email: string;
  airport_name: string;
  placement_label: string;
  ends_at: string;
  days_remaining: 1 | 2 | 3;
}

export class AdExpiryReminderRepository {
  async ensureSchema(): Promise<void>;
  async listDueCampaigns(reminderDate: string): Promise<DueAdCampaign[]>;
  async getDelivery(applicantAccountId: number, reminderDate: string): Promise<AdExpiryReminderDelivery | null>;
  async markSucceeded(input: DeliveryWriteInput): Promise<void>;
  async markFailed(input: DeliveryWriteInput & { error: string }): Promise<void>;
}
```

查询使用 `DATE(campaign.ends_at) IN (DATE_ADD(?, INTERVAL 1 DAY), DATE_ADD(?, INTERVAL 2 DAY), DATE_ADD(?, INTERVAL 3 DAY))`，并通过 `DATEDIFF(DATE(campaign.ends_at), ?)` 产生剩余天数。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx tsx --test backend/tests/adExpiryReminderRepository.test.ts`

Expected: PASS。

### Task 2: HTML 邮件模板与发送

**Files:**
- Modify: `backend/src/services/smtpSettingsService.ts`
- Modify: `backend/src/services/mailService.ts`
- Modify: `backend/tests/smtpSettingsService.test.ts`
- Modify: `backend/tests/mailService.test.ts`

- [ ] **Step 1: 写失败测试**

断言旧 SMTP 配置自动获得启用的 `ad_expiry_reminder`；断言默认模板包含 `{{campaign_items}}` 和 `{{portal_login_url}}`；断言 `sendAdExpiryReminderEmail()` 向 Nodemailer 同时传入 `html` 与 `text`，转义机场名等动态值，并保留后台按钮和续费步骤。

- [ ] **Step 2: 运行红灯测试**

Run: `npx tsx --test backend/tests/smtpSettingsService.test.ts backend/tests/mailService.test.ts`

Expected: FAIL，提示模板键或发送方法不存在。

- [ ] **Step 3: 扩展模板配置**

向 `SmtpTemplateKey` 和 `SmtpTemplateConfig` 增加：

```ts
ad_expiry_reminder: SmtpTemplateConfigItem;
```

默认主题使用 `GateRank 广告即将到期提醒（共 {{campaign_count}} 项）`，默认正文使用邮件客户端兼容的内联 CSS、表格布局和 `/portal` 主按钮。`normalizeTemplates()` 对旧配置自动补齐，不覆盖其他模板。

- [ ] **Step 4: 实现双正文发送**

增加：

```ts
async sendAdExpiryReminderEmail(input: {
  to: string;
  portalLoginUrl: string;
  campaigns: Array<{
    airportName: string;
    placementLabel: string;
    endsAt: string;
    daysRemaining: 1 | 2 | 3;
  }>;
}): Promise<'sent' | 'disabled'>;
```

普通变量使用 HTML 转义；`campaign_items` 只注入由服务端 helper 生成的行。纯文本正文逐项列出剩余天数、到期时间、登录地址和三步续费指引。

- [ ] **Step 5: 运行测试确认通过**

Run: `npx tsx --test backend/tests/smtpSettingsService.test.ts backend/tests/mailService.test.ts`

Expected: PASS。

### Task 3: 聚合提醒服务与每日幂等

**Files:**
- Create: `backend/src/services/adExpiryReminderService.ts`
- Create: `backend/tests/adExpiryReminderService.test.ts`

- [ ] **Step 1: 写失败测试**

覆盖同一账号的多条广告只调用一次邮件服务；不同账号分别发送；已有 `succeeded` 记录跳过；`failed` 记录当天重试；单个收件人失败后继续处理其他收件人；模板关闭返回跳过且不记失败。

- [ ] **Step 2: 运行红灯测试**

Run: `npx tsx --test backend/tests/adExpiryReminderService.test.ts`

Expected: FAIL，提示服务模块不存在。

- [ ] **Step 3: 实现服务**

```ts
export interface AdExpiryReminderRunResult {
  candidate_campaign_count: number;
  applicant_count: number;
  success_count: number;
  failure_count: number;
  skipped_count: number;
  failures: Array<{ applicant_account_id: number; applicant_email: string; error: string }>;
}

async run(reminderDate: string, portalLoginUrl: string): Promise<AdExpiryReminderRunResult>;
```

先按 `applicant_account_id` 分组，再按剩余天数、到期时间和广告 ID 稳定排序。成功后写 `succeeded`，异常写清理后的 `failed`；已成功项跳过。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx tsx --test backend/tests/adExpiryReminderService.test.ts`

Expected: PASS。

### Task 4: 接入 09:00 调度

**Files:**
- Modify: `backend/src/types/domain.ts`
- Modify: `backend/src/repositories/schedulerTaskRepository.ts`
- Modify: `backend/src/services/adminSchedulerService.ts`
- Modify: `backend/src/services/schedulerTaskExecutor.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/tests/schedulerTaskRepository.test.ts`
- Modify: `backend/tests/schedulerTaskExecutor.test.ts`
- Modify: `backend/tests/adminSchedulerService.test.ts`

- [ ] **Step 1: 写失败测试**

断言任务仓储创建第 9 个默认任务 `ad_expiry_reminder`，时间为 `09:00`；断言执行器把运行日期和 `getSiteOrigin({}) + '/portal'` 传给提醒服务，并将汇总映射为调度详情；断言任务描述存在。

- [ ] **Step 2: 运行红灯测试**

Run: `npx tsx --test backend/tests/schedulerTaskRepository.test.ts backend/tests/schedulerTaskExecutor.test.ts backend/tests/adminSchedulerService.test.ts`

Expected: FAIL，提示新任务类型或分派不存在。

- [ ] **Step 3: 实现任务接线**

把 `ad_expiry_reminder` 加入任务联合类型、MySQL ENUM、排序和默认任务；在执行器中独立分派：

```ts
if (taskKey === 'ad_expiry_reminder') {
  return this.runAdExpiryReminder(date);
}
```

有失败项时返回 `failed`，否则返回 `succeeded`；详情包含候选、申请人、成功、失败、跳过计数和失败列表。`app.ts` 在 Schema 初始化阶段创建仓储，并把提醒服务注入执行器。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx tsx --test backend/tests/schedulerTaskRepository.test.ts backend/tests/schedulerTaskExecutor.test.ts backend/tests/adminSchedulerService.test.ts`

Expected: PASS。

### Task 5: 管理端邮件场景和 HTML 预览

**Files:**
- Modify: `src/admin/AdminApp.tsx`
- Create: `backend/tests/adminSettingsUi.test.ts`

- [ ] **Step 1: 写失败静态测试**

断言 `SmtpTemplateKey`、`SMTP_TEMPLATE_ORDER`、场景标题、触发说明、HTML 提示、`campaign_items` 示例与任务标签包含新场景。

- [ ] **Step 2: 运行红灯测试**

Run: `npx tsx --test backend/tests/adminSettingsUi.test.ts`

Expected: FAIL，提示广告到期场景缺失。

- [ ] **Step 3: 实现管理端展示**

增加场景：

```ts
ad_expiry_reminder: {
  title: '广告到期提醒邮件',
  trigger: '广告到期前第 3、2、1 天，北京时间上午 9 点按申请人合并发送。',
  description: '提醒申请人及时登录后台续费即将到期的广告。',
  variables: ['{{campaign_count}}', '{{campaign_items}}', '{{portal_login_url}}', '{{applicant_email}}', '{{site_name}}'],
}
```

该场景的编辑提示改为“HTML 模板”，预览使用不带 `allow-scripts` 权限的 `iframe sandbox srcDoc` 展示；其他模板继续显示纯文本预览。任务标签增加“广告到期提醒”。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx tsx --test backend/tests/adminSettingsUi.test.ts`

Expected: PASS。

### Task 6: 回归与可视验收

**Files:**
- Verify only: no planned source changes

- [ ] **Step 1: 运行聚焦测试**

Run: `npx tsx --test backend/tests/adExpiryReminderRepository.test.ts backend/tests/adExpiryReminderService.test.ts backend/tests/smtpSettingsService.test.ts backend/tests/mailService.test.ts backend/tests/schedulerTaskRepository.test.ts backend/tests/schedulerTaskExecutor.test.ts backend/tests/adminSchedulerService.test.ts backend/tests/adminSettingsUi.test.ts`

Expected: 所有测试通过，0 failures。

- [ ] **Step 2: 运行类型检查**

Run: `npm run server:typecheck && npm run lint`

Expected: 两个命令退出码均为 0。

- [ ] **Step 3: 运行完整后端测试**

Run: `npm run test:backend`

Expected: 0 failures。

- [ ] **Step 4: 运行生产构建**

Run: `npm run build`

Expected: Vite build 退出码为 0。构建会更新已存在的 `dist` 工作区改动，最终交付中需单独说明而不擅自清理。

- [ ] **Step 5: 浏览器验收**

启动本地应用后检查桌面和移动宽度：邮件场景表格包含新行；设置弹窗显示 HTML 提示、变量和安全预览；任务调度页显示 09:00 新任务。若本地数据库或登录态阻止页面运行，保留构建与静态测试证据并明确说明未完成的浏览器门槛。

- [ ] **Step 6: 检查范围**

Run: `git diff --check && git status --short && git diff --stat HEAD`

Expected: 无空白错误；仅包含本功能源码、测试、文档，以及执行构建前已存在或明确产生的生成物。
