# Portal Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the applicant portal into a more polished blue-green external-facing experience with branded payment cards and clearer hierarchy, without changing portal business behavior.

**Architecture:** Keep the implementation inside `src/App.tsx`, because the existing portal page and its helper components already live there. Reshape the portal into reusable visual sections in-place: hero/header, progress overview, branded payment methods, and a more structured application details block. Preserve login, password change, payment creation, and edit/read-only rules exactly as they work now.

**Tech Stack:** React, TypeScript, Tailwind utility classes, Lucide icons, existing portal API helpers

---

### Task 1: Refresh Portal Shell And Status Hierarchy

**Files:**
- Modify: `src/App.tsx`
- Test: visual verification via local build

- [ ] **Step 1: Add new portal visual helpers near the existing portal helpers**

Insert focused helpers close to `StatusPill` / portal helpers so the main page render stays readable:

```tsx
function PortalInfoCard({
  eyebrow,
  title,
  value,
  tone = 'neutral',
}: {
  eyebrow: string;
  title: string;
  value: string;
  tone?: 'neutral' | 'blue' | 'green' | 'amber';
}) {
  const toneMap = {
    neutral: 'border-white/70 bg-white/80 text-slate-900',
    blue: 'border-sky-100 bg-sky-50 text-sky-950',
    green: 'border-emerald-100 bg-emerald-50 text-emerald-950',
    amber: 'border-amber-100 bg-amber-50 text-amber-950',
  };

  return (
    <div className={`rounded-[24px] border px-5 py-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] ${toneMap[tone]}`}>
      <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">{eyebrow}</div>
      <div className="mt-3 text-sm font-medium text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</div>
    </div>
  );
}

function PortalSectionCard({
  title,
  description,
  aside,
  children,
}: {
  title: string;
  description: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white/90 p-5 md:p-7 shadow-[0_24px_80px_rgba(15,23,42,0.06)] backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.24em] text-cyan-700">Applicant Portal</div>
          <h2 className="mt-3 text-xl md:text-2xl font-black tracking-tight text-slate-950">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">{description}</p>
        </div>
        {aside}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}
```

- [ ] **Step 2: Replace the plain portal page frame with the new blue-green shell**

Update the `return` block of `PortalPage()` from the current plain white wrapper to a layered background + richer hero:

```tsx
return (
  <div className="min-h-screen bg-[linear-gradient(180deg,#f4fbff_0%,#ffffff_42%,#f4fff8_100%)] font-sans relative overflow-hidden">
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute left-[-120px] top-[-80px] h-72 w-72 rounded-full bg-sky-200/35 blur-3xl" />
      <div className="absolute right-[-120px] top-20 h-80 w-80 rounded-full bg-emerald-200/35 blur-3xl" />
      <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(#0f172a 1px, transparent 1px), linear-gradient(90deg, #0f172a 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
    </div>

    <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 md:py-12">
      ...
    </div>
  </div>
);
```

- [ ] **Step 3: Upgrade the top header into a branded hero**

Replace the current header block with:

```tsx
<div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
  <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white/85 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-700 shadow-sm">
    {PUBLIC_SITE_BRAND_NAME} Portal
  </div>
  <div className="flex items-center gap-3">
    <a href="/" className="text-[11px] md:text-xs font-black uppercase tracking-[0.18em] text-slate-500 hover:text-slate-900">
      返回首页
    </a>
    {view && (
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm"
        onClick={logout}
      >
        <LogOut className="h-4 w-4" />
        退出
      </button>
    )}
  </div>
</div>

<header className="mb-8 rounded-[32px] border border-white/70 bg-white/70 px-6 py-8 md:px-8 md:py-10 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
  <div className="text-xs font-black uppercase tracking-[0.24em] text-cyan-700">Application Dashboard</div>
  <h1 className="mt-4 text-4xl md:text-6xl font-black tracking-tight text-slate-950">申请人后台</h1>
  <p className="mt-4 max-w-3xl text-sm md:text-base leading-7 text-slate-600">
    使用申请邮箱登录，首次登录修改密码，完成支付后自动进入待审批状态。这里会同步展示你的机场资料、进度和支付入口。
  </p>
  {view && (
    <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
      <PortalInfoCard eyebrow="Application" title="申请编号" value={`#${view.application.id}`} tone="blue" />
      <PortalInfoCard eyebrow="Current Stage" title="审批状态" value={formatPortalReviewStatus(view.application.review_status)} tone="neutral" />
      <PortalInfoCard eyebrow="Payment" title="支付状态" value={formatPortalPaymentStatus(view.application.payment_status)} tone="green" />
      <PortalInfoCard eyebrow="Editable" title="资料状态" value={view.application.payment_status === 'paid' ? '已锁定' : '可修改'} tone={view.application.payment_status === 'paid' ? 'neutral' : 'amber'} />
    </div>
  )}
</header>
```

- [ ] **Step 4: Run build after shell changes**

Run: `npm run build`

Expected: Vite build succeeds without portal JSX/type errors.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx docs/superpowers/specs/2026-04-18-portal-visual-refresh-design.md docs/superpowers/plans/2026-04-18-portal-visual-refresh.md
git commit -m "feat: refresh portal shell hierarchy"
```

### Task 2: Add Branded Payment Method Cards With Logos

**Files:**
- Modify: `src/App.tsx`
- Test: visual verification via local build

- [ ] **Step 1: Add inline payment logo helpers**

Add compact SVG helpers near other portal helpers:

```tsx
function AlipayMark({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="2.5" y="2.5" width="19" height="19" rx="6" fill="currentColor" opacity="0.18" />
      <path d="M7.5 8.2h9m-7.8 3h6.6m-7.8 3.2c2.4-.2 4.7-.9 6.9-2.2 1 .7 2.1 1.4 3.1 2.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WechatPayMark({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M9.5 5.5c-3.6 0-6 2.3-6 5.4 0 1.7.8 3.1 2.2 4.1l-.6 2.5 2.8-1.4c.5.1 1 .1 1.6.1 3.5 0 6-2.3 6-5.3s-2.5-5.4-6-5.4Z" fill="currentColor" opacity="0.18" />
      <path d="M16.3 9.5c-2.6 0-4.7 1.7-4.7 4.1 0 2.3 2.1 4 4.7 4 .4 0 .9 0 1.3-.1l2.2 1.1-.5-1.9c1.1-.7 1.8-1.8 1.8-3.1 0-2.4-2-4.1-4.8-4.1Z" fill="currentColor" />
      <circle cx="7.8" cy="10.7" r="0.9" fill="currentColor" />
      <circle cx="11.6" cy="10.7" r="0.9" fill="currentColor" />
      <circle cx="15.4" cy="13.2" r="0.8" fill="#fff" />
      <circle cx="18.1" cy="13.2" r="0.8" fill="#fff" />
    </svg>
  );
}
```

- [ ] **Step 2: Add a branded payment card component**

Create a reusable card in `src/App.tsx`:

```tsx
function PaymentMethodCard({
  title,
  description,
  badge,
  tone,
  icon,
  busy,
  disabled,
  onClick,
}: {
  title: string;
  description: string;
  badge: string;
  tone: 'alipay' | 'wechat';
  icon: React.ReactNode;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const palette = tone === 'alipay'
    ? {
        shell: 'border-sky-200 bg-[linear-gradient(135deg,#1677ff_0%,#1153d4_100%)]',
        soft: 'bg-white/15 text-white/90',
      }
    : {
        shell: 'border-emerald-200 bg-[linear-gradient(135deg,#1aad19_0%,#12954b_100%)]',
        soft: 'bg-white/15 text-white/90',
      };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-[26px] border p-5 text-left text-white shadow-[0_20px_50px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 disabled:opacity-60 ${palette.shell}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
          {icon}
        </div>
        <div className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${palette.soft}`}>
          {badge}
        </div>
      </div>
      <div className="mt-8 text-2xl font-black tracking-tight">{busy ? '创建中...' : title}</div>
      <p className="mt-3 text-sm leading-6 text-white/82">{description}</p>
    </button>
  );
}
```

- [ ] **Step 3: Replace the current unpaid payment stage with the new payment panel**

In the `awaiting_payment` branch, replace the plain white box and buttons with a section like:

```tsx
stageSection = (
  <PortalSectionCard
    title="支付入驻费用"
    description="支付完成并通过网关回调后，申请会自动进入后台待审批列表。你也可以先继续补充资料，再发起支付。"
    aside={<div className="rounded-full border border-amber-100 bg-amber-50 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-amber-700">待支付</div>}
  >
    <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-5">
      <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#f8fcff_0%,#ffffff_100%)] p-5">
        <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-700">Payment Summary</div>
        <div className="mt-4 text-4xl font-black tracking-tight text-slate-950">¥{formatMetric(view.payment_fee_amount)}</div>
        <div className="mt-3 text-sm leading-7 text-slate-600">完成支付后自动进入后台待审批状态，支付结果会同步到当前页面。</div>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <PortalInfoCard eyebrow="Application" title="申请编号" value={`#${view.application.id}`} tone="blue" />
          <PortalInfoCard eyebrow="Current Status" title="当前状态" value="待支付" tone="amber" />
        </div>
        {view.latest_payment_order?.pay_info && (
          <div className="mt-5 rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
            <div className="font-black text-slate-900">最近支付链接</div>
            <a className="mt-2 block break-all text-cyan-700 underline" href={view.latest_payment_order.pay_info} target="_blank" rel="noreferrer">
              {view.latest_payment_order.pay_info}
            </a>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PaymentMethodCard
          title="支付宝支付"
          description="适合网页拉起，创建成功后会打开新的支付页面。"
          badge="Web Jump"
          tone="alipay"
          icon={<AlipayMark className="h-6 w-6" />}
          busy={creatingChannel === 'alipay'}
          disabled={Boolean(creatingChannel)}
          onClick={() => void createPaymentOrder('alipay')}
        />
        <PaymentMethodCard
          title="微信支付"
          description="适合扫码或微信内支付，后续也兼容二维码或跳转结果展示。"
          badge="QR / Jump"
          tone="wechat"
          icon={<WechatPayMark className="h-6 w-6" />}
          busy={creatingChannel === 'wxpay'}
          disabled={Boolean(creatingChannel)}
          onClick={() => void createPaymentOrder('wxpay')}
        />
      </div>
    </div>
  </PortalSectionCard>
);
```

- [ ] **Step 4: Refresh login and password-change stage surfaces to match the new shell**

Convert the login form and first-login password change form to use `PortalSectionCard` and replace `bg-neutral-900` buttons with blue-green accents:

```tsx
className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#0f8db3_0%,#0f766e_100%)] px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white disabled:opacity-50 shadow-[0_14px_32px_rgba(15,118,110,0.18)]"
```

- [ ] **Step 5: Run build after payment section changes**

Run: `npm run build`

Expected: payment cards and new helpers compile cleanly.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add branded portal payment cards"
```

### Task 3: Rework Application Details Into A Richer Portal Information Panel

**Files:**
- Modify: `src/App.tsx`
- Test: `npm run lint`, `npm run build`

- [ ] **Step 1: Add richer field wrappers for portal details**

Add visual helpers near `ReadOnlyPortalField`:

```tsx
function PortalMetricTile({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'blue' | 'green' | 'amber' }) {
  const toneMap = {
    neutral: 'border-slate-200 bg-slate-50',
    blue: 'border-sky-100 bg-sky-50',
    green: 'border-emerald-100 bg-emerald-50',
    amber: 'border-amber-100 bg-amber-50',
  };

  return (
    <div className={`rounded-[22px] border px-4 py-4 ${toneMap[tone]}`}>
      <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-2 text-base font-black tracking-tight text-slate-950">{value}</div>
    </div>
  );
}

function PortalReadOnlyBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-4">
      <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{value || '-'}</div>
    </div>
  );
}
```

- [ ] **Step 2: Rebuild `renderApplicationDetailsSection` with stronger grouping**

Wrap the section with `PortalSectionCard`, keep the edit/read-only business logic, and change the content structure to:

```tsx
<PortalSectionCard
  title="申请资料"
  description={`这里展示你提交给 GateRank 的机场信息。${canEdit ? '支付前可直接修改并保存。' : '支付完成后资料已锁定，如需修改请联系管理员。'}`}
  aside={
    <div className={`rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] ${canEdit ? 'border border-amber-100 bg-amber-50 text-amber-700' : 'border border-slate-200 bg-slate-100 text-slate-500'}`}>
      {canEdit ? '支付前可修改' : '支付后已锁定'}
    </div>
  }
>
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
    <PortalMetricTile label="机场名称" value={portalView.application.name} tone="blue" />
    <PortalMetricTile label="月付价格" value={`¥${formatMetric(portalView.application.plan_price_month)}`} tone="amber" />
    <PortalMetricTile label="试用支持" value={portalView.application.has_trial ? '支持' : '不支持'} tone="green" />
    <PortalMetricTile label="提交时间" value={portalView.application.created_at} />
  </div>
  ...
</PortalSectionCard>
```

Keep the existing form fields and save behavior, but update classes from neutral admin inputs to slightly richer portal inputs:

```tsx
className="w-full rounded-[20px] border border-slate-200 bg-white/95 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-100"
```

- [ ] **Step 3: Upgrade the read-only branch to grouped cards instead of plain label/value rows**

Replace the current `ReadOnlyPortalField` grid with:

```tsx
<div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
  <PortalReadOnlyBlock label="官网列表" value={portalView.application.websites.join('\n')} />
  <PortalReadOnlyBlock label="申请邮箱 / 登录邮箱" value={portalView.application.applicant_email} />
  <PortalReadOnlyBlock label="Telegram" value={portalView.application.applicant_telegram} />
  <PortalReadOnlyBlock label="成立时间" value={formatDateLabel(portalView.application.founded_on)} />
  <PortalReadOnlyBlock label="订阅链接" value={portalView.application.subscription_url || '-'} />
  <PortalReadOnlyBlock label="审核备注" value={portalView.application.review_note || '-'} />
  <PortalReadOnlyBlock label="测试账号" value={portalView.application.test_account} />
  <PortalReadOnlyBlock label="测试密码" value={portalView.application.test_password} />
  <PortalReadOnlyBlock label="支付时间" value={portalView.application.paid_at || '-'} />
  <PortalReadOnlyBlock label="审核时间" value={portalView.application.reviewed_at || '-'} />
  <div className="xl:col-span-2">
    <PortalReadOnlyBlock label="机场简介" value={portalView.application.airport_intro} />
  </div>
</div>
```

- [ ] **Step 4: Run lint and build**

Run: `npm run lint`

Expected: PASS with no new React/TS lint issues.

Run: `npm run build`

Expected: PASS and generate the portal bundle successfully.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: redesign applicant portal details layout"
```
