# DNS Leak Test Resolver Evidence UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the DNS resolver evidence understandable to ordinary Chinese users by adding deterministic evidence ordering, localized network terminology, a professional desktop table, and a no-horizontal-scroll mobile layout.

**Architecture:** Keep the public DNS Leak Test API unchanged. Put deterministic query-type and resolver ordering in the shared contract module so the API and frontend use one rule; put Chinese presentation formatting in the page state module so the visual table and copied result share one representation; render the same prepared rows through breakpoint-specific semantic desktop and mobile structures.

**Tech Stack:** TypeScript 5.8, React 19, Tailwind CSS 3, Express 4, Node test runner, Vite 6

---

### Task 1: Make resolver and query evidence ordering deterministic

**Files:**
- Modify: `shared/dnsLeakTest.ts`
- Modify: `backend/src/services/dnsLeakTestService.ts`
- Modify: `backend/tests/dnsLeakTestShared.test.ts`
- Modify: `backend/tests/dnsLeakTestService.test.ts`

- [ ] **Step 1: Add failing shared ordering tests**

Extend `backend/tests/dnsLeakTestShared.test.ts` to import
`compareDnsLeakResolvers` and `sortDnsQueryTypes`, then add:

```ts
test('DNS resolver evidence sorts by probe hits and then by IP', () => {
  const values = [
    { ip: '8.8.8.8', observation_count: 2 },
    { ip: '1.1.1.1', observation_count: 5 },
    { ip: '9.9.9.9', observation_count: 2 },
  ];

  assert.deepEqual(
    [...values].sort(compareDnsLeakResolvers).map((value) => value.ip),
    ['1.1.1.1', '8.8.8.8', '9.9.9.9'],
  );
});

test('DNS query types use semantic order and remove duplicates', () => {
  assert.deepEqual(
    sortDnsQueryTypes(['HTTPS', 'AAAA', 'TXT', 'A', 'AAAA', 'MX']),
    ['A', 'AAAA', 'HTTPS', 'MX', 'TXT'],
  );
});
```

- [ ] **Step 2: Run the shared tests and verify failure**

Run:

```bash
npx tsx --test backend/tests/dnsLeakTestShared.test.ts
```

Expected: FAIL because the two ordering helpers do not exist.

- [ ] **Step 3: Implement shared ordering helpers**

Add the following exports to `shared/dnsLeakTest.ts`:

```ts
const DNS_QUERY_TYPE_PRIORITY: Readonly<Record<string, number>> = {
  A: 0,
  AAAA: 1,
  HTTPS: 2,
};

export function sortDnsQueryTypes(values: ReadonlyArray<string>): string[] {
  return [...new Set(
    values
      .map((value) => String(value || '').trim().toUpperCase())
      .filter(Boolean),
  )].sort((left, right) => (
    (DNS_QUERY_TYPE_PRIORITY[left] ?? Number.MAX_SAFE_INTEGER)
    - (DNS_QUERY_TYPE_PRIORITY[right] ?? Number.MAX_SAFE_INTEGER)
    || left.localeCompare(right)
  ));
}

export function compareDnsLeakResolvers(
  left: Pick<DnsLeakResolverInfo, 'ip' | 'observation_count'>,
  right: Pick<DnsLeakResolverInfo, 'ip' | 'observation_count'>,
): number {
  return right.observation_count - left.observation_count
    || left.ip.localeCompare(right.ip);
}
```

The helpers must not mutate their inputs. Unknown query types remain visible and
sort alphabetically after `A`, `AAAA`, and `HTTPS`.

- [ ] **Step 4: Update the service integration test before changing the service**

In `backend/tests/dnsLeakTestService.test.ts`, extend `observation` with an
optional query type:

```ts
function observation(
  eventId: string,
  probeIndex: number,
  resolverIp: string,
  dnssecOk: boolean,
  queryType = 'A',
): DnsLeakObservation {
  return {
    event_id: eventId,
    session_id: SESSION_ID,
    probe_index: probeIndex,
    resolver_ip: resolverIp,
    query_type: queryType,
    dnssec_ok: dnssecOk,
    observed_at: new Date(NOW).toISOString(),
  };
}
```

Add unique probe observations for `8.8.8.8` with `HTTPS` and `AAAA`, then assert:

```ts
assert.deepEqual(result.resolvers.map((resolver) => resolver.ip), [
  '8.8.8.8',
  '1.1.1.1',
]);
assert.deepEqual(result.resolvers[0]?.query_types, ['A', 'AAAA', 'HTTPS']);
assert.equal(result.resolvers[0]?.observation_count, 3);
```

Keep the existing duplicate-probe assertion so repeated events for the same
resolver and `probe_index` still count once.

- [ ] **Step 5: Run the service test and verify the old ordering fails**

Run:

```bash
npx tsx --test backend/tests/dnsLeakTestService.test.ts
```

Expected: FAIL because the service still sorts query types and resolver IPs
lexically without using observation count.

- [ ] **Step 6: Apply the shared rules in the session service**

Import the helpers in `backend/src/services/dnsLeakTestService.ts`, replace the
current query type expression with:

```ts
query_types: sortDnsQueryTypes(items.map((item) => item.query_type)),
```

and replace the resolver sort with:

```ts
resolvers.sort(compareDnsLeakResolvers);
```

Do not change session grouping, unique `probe_index` counting, DNSSEC
aggregation, API fields, or verdict calculation.

- [ ] **Step 7: Run the focused ordering tests**

Run:

```bash
npx tsx --test \
  backend/tests/dnsLeakTestShared.test.ts \
  backend/tests/dnsLeakTestService.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit deterministic evidence ordering**

```bash
git add \
  shared/dnsLeakTest.ts \
  backend/src/services/dnsLeakTestService.ts \
  backend/tests/dnsLeakTestShared.test.ts \
  backend/tests/dnsLeakTestService.test.ts
git commit -m "feat: order DNS resolver evidence"
```

### Task 2: Create one Chinese presentation model for the page and copied result

**Files:**
- Modify: `src/pages/dnsLeakTest/dnsLeakTestState.ts`
- Modify: `backend/tests/dnsLeakTestState.test.ts`

- [ ] **Step 1: Add failing formatter and copy tests**

Extend `backend/tests/dnsLeakTestState.test.ts` to import:

```ts
import {
  buildDnsResolverEvidenceRows,
  formatDnsAsnLabel,
  formatDnsCountryName,
  formatDnsLeakTestCopy,
  formatDnsQueryTypeLabel,
  resolveDnsLeakErrorMessage,
} from '../../src/pages/dnsLeakTest/dnsLeakTestState';
```

Add assertions covering localized and missing values:

```ts
test('DNS resolver presentation localizes country, ASN, hits, and query types', () => {
  assert.equal(formatDnsCountryName('JP', 'Japan'), '日本');
  assert.equal(formatDnsCountryName('', 'Atlantis'), 'Atlantis');
  assert.equal(formatDnsCountryName('', ''), '地区未知');
  assert.equal(formatDnsAsnLabel('AS15169'), '自治系统编号 AS15169');
  assert.equal(formatDnsAsnLabel(''), '自治系统编号未知');
  assert.equal(formatDnsQueryTypeLabel('A'), 'A · IPv4 地址查询');
  assert.equal(formatDnsQueryTypeLabel('AAAA'), 'AAAA · IPv6 地址查询');
  assert.equal(formatDnsQueryTypeLabel('HTTPS'), 'HTTPS · HTTPS 服务参数查询');
  assert.equal(formatDnsQueryTypeLabel('TXT'), 'TXT · 其他 DNS 查询');
});
```

Build two resolver fixtures in reverse priority order and assert that
`buildDnsResolverEvidenceRows(resolvers, 10)` returns the higher-hit resolver
first with:

```ts
{
  location: '日本',
  network: 'Google LLC',
  asn: '自治系统编号 AS15169',
  observation: '命中 3/10 个测试域名',
  queryTypes: [
    'A · IPv4 地址查询',
    'AAAA · IPv6 地址查询',
    'HTTPS · HTTPS 服务参数查询',
  ],
}
```

Update the existing copied-result test to require:

```ts
assert.match(text, /8\.8\.8\.8 · 美国 · Google Public DNS · 自治系统编号 AS15169/);
assert.match(text, /命中 10\/10 个测试域名/);
assert.match(text, /A · IPv4 地址查询/);
assert.match(text, /AAAA · IPv6 地址查询/);
```

- [ ] **Step 2: Run the state tests and verify failure**

Run:

```bash
npx tsx --test backend/tests/dnsLeakTestState.test.ts
```

Expected: FAIL because the Chinese presentation helpers and new copied format
are absent.

- [ ] **Step 3: Implement safe country, ASN, and query labels**

In `src/pages/dnsLeakTest/dnsLeakTestState.ts`, import
`compareDnsLeakResolvers`, `normalizeCountryCode`, `sortDnsQueryTypes`, and
`DnsLeakResolverInfo`. Create one reusable region formatter:

```ts
const zhRegionNames = new Intl.DisplayNames(['zh-Hans'], { type: 'region' });
```

Implement:

```ts
export function formatDnsCountryName(countryCode: string, fallback: string): string {
  const code = normalizeCountryCode(countryCode);
  const localized = code ? zhRegionNames.of(code) : '';
  return localized && localized !== code
    ? localized
    : String(fallback || '').trim() || '地区未知';
}

export function formatDnsAsnLabel(asn: string): string {
  const value = String(asn || '').trim().toUpperCase();
  return value ? `自治系统编号 ${value}` : '自治系统编号未知';
}

export function formatDnsQueryTypeLabel(queryType: string): string {
  const value = String(queryType || '').trim().toUpperCase();
  if (value === 'A') return 'A · IPv4 地址查询';
  if (value === 'AAAA') return 'AAAA · IPv6 地址查询';
  if (value === 'HTTPS') return 'HTTPS · HTTPS 服务参数查询';
  return `${value || '未知类型'} · 其他 DNS 查询`;
}
```

Do not infer a city, data center, DoH, DoT, leak verdict, or risk from these
labels.

- [ ] **Step 4: Build a shared resolver row model**

Add this view-model shape and builder:

```ts
export interface DnsResolverEvidenceRow {
  ip: string;
  location: string;
  network: string;
  asn: string;
  observation: string;
  queryTypes: string[];
}

export function buildDnsResolverEvidenceRows(
  resolvers: ReadonlyArray<DnsLeakResolverInfo>,
  totalProbes: number,
): DnsResolverEvidenceRow[] {
  return [...resolvers]
    .sort(compareDnsLeakResolvers)
    .map((resolver) => ({
      ip: resolver.ip,
      location: formatDnsCountryName(resolver.country_code, resolver.country),
      network: resolver.organization || resolver.isp || '所属网络未知',
      asn: formatDnsAsnLabel(resolver.asn),
      observation: `命中 ${resolver.observation_count}/${totalProbes} 个测试域名`,
      queryTypes: sortDnsQueryTypes(resolver.query_types).map(formatDnsQueryTypeLabel),
    }));
}
```

This is the only resolver evidence formatter used by both visual output and
clipboard output.

- [ ] **Step 5: Rewrite copied output with the shared row model**

In `formatDnsLeakTestCopy`, build rows with:

```ts
const resolverRows = buildDnsResolverEvidenceRows(
  result.resolvers,
  result.total_probes,
);
```

For each row, output the first line as:

```ts
`${index + 1}. ${row.ip} · ${row.location} · ${row.network} · ${row.asn}`
```

and a second indented line as:

```ts
`   ${row.observation} · ${row.queryTypes.join('；')}`
```

Use `formatDnsCountryName` for the current exit network as well. Preserve the
existing risk, country consistency, DNSSEC, DoH/DoT, and capability-boundary
copy.

- [ ] **Step 6: Run the presentation tests**

Run:

```bash
npx tsx --test backend/tests/dnsLeakTestState.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the shared presentation model**

```bash
git add \
  src/pages/dnsLeakTest/dnsLeakTestState.ts \
  backend/tests/dnsLeakTestState.test.ts
git commit -m "feat: explain DNS resolver evidence in Chinese"
```

### Task 3: Replace the desktop resolver list with a professional evidence table

**Files:**
- Modify: `src/pages/dnsLeakTest/DNSLeakTestPage.tsx`
- Create: `backend/tests/dnsLeakTestPageSource.test.ts`

- [ ] **Step 1: Add a failing page-structure test**

Create `backend/tests/dnsLeakTestPageSource.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageSource = readFileSync(
  resolve(process.cwd(), 'src/pages/dnsLeakTest/DNSLeakTestPage.tsx'),
  'utf8',
);

test('DNS resolver desktop evidence uses a semantic table and persistent help', () => {
  assert.match(pageSource, /<table/);
  assert.match(pageSource, /<thead/);
  assert.match(pageSource, /<tbody/);
  for (const heading of ['解析器 IP', '位置', '所属网络', '查询证据']) {
    assert.match(pageSource, new RegExp(heading));
  }
  assert.match(pageSource, /每一行代表一个实际访问 GateRank 权威探针/);
  assert.match(pageSource, /相同运营商的多行记录不一定是重复或异常/);
  assert.match(pageSource, /不能据此判断 DoH 或 DoT/);
  assert.doesNotMatch(pageSource, /<Server/);
});
```

- [ ] **Step 2: Run the source test and verify failure**

Run:

```bash
npx tsx --test backend/tests/dnsLeakTestPageSource.test.ts
```

Expected: FAIL because the page still renders an icon-based free-form grid with
no table headings or persistent explanation.

- [ ] **Step 3: Prepare resolver rows once in the page**

Import `buildDnsResolverEvidenceRows` and `formatDnsCountryName` from
`dnsLeakTestState.ts`, remove the `Server` icon import, and derive:

```ts
const resolverRows = result
  ? buildDnsResolverEvidenceRows(result.resolvers, result.total_probes)
  : [];
```

Use `formatDnsCountryName` in the current-exit summary so the page does not mix
English resolver countries with Chinese explanatory copy.

- [ ] **Step 4: Add the persistent explanation block**

Below the section title, add always-visible copy that states:

```text
每一行代表一个实际访问 GateRank 权威探针的递归 DNS 服务器 IP。同一家公共 DNS 可能使用多个服务器 IP，因此相同运营商的多行记录不一定是重复或异常。
```

Also show these definitions in compact neutral text:

```text
AS 编号：IP 所属互联网网络的自治系统编号，不是风险等级。
命中测试域名：该解析器处理了本轮 10 个测试域名中的几个。
A / AAAA / HTTPS：IPv4、IPv6 和 HTTPS 服务参数查询，不能据此判断 DoH 或 DoT。
```

When results exist, add:

```text
本轮观察到 X 个不同解析器来源 IP，不代表 X 家 DNS 服务商。按本轮命中测试域名数量从多到少排列；数量相同时按 IP 排序。
```

When `result.status === 'running'` and at least one row exists, identify the list
as current partial evidence.

- [ ] **Step 5: Render the desktop semantic table**

For `md` and larger breakpoints, render:

```tsx
<table className="hidden w-full table-fixed border-collapse md:table">
  <thead className="bg-neutral-50 text-left text-[11px] font-black uppercase tracking-[0.12em] text-neutral-500">
    <tr>
      <th scope="col" className="w-[24%] px-4 py-3">解析器 IP</th>
      <th scope="col" className="w-[18%] px-4 py-3">位置</th>
      <th scope="col" className="w-[27%] px-4 py-3">所属网络</th>
      <th scope="col" className="w-[31%] px-4 py-3 text-right">查询证据</th>
    </tr>
  </thead>
  <tbody className="divide-y divide-neutral-200">
    {resolverRows.map((row, index) => (
      <tr
        key={row.ip}
        className="animate-[dns-resolver-in_.3s_ease-out_both] align-top motion-reduce:animate-none"
        style={{ animationDelay: `${index * 50}ms` }}
      >
        <td className="px-4 py-5">
          <span className="break-all font-mono text-sm font-black text-neutral-950">
            {row.ip}
          </span>
        </td>
        <td className="px-4 py-5">
          <span className="text-sm font-black text-neutral-800">{row.location}</span>
          <span className="mt-1 block text-xs leading-5 text-neutral-500">
            IP 数据库估算的网络注册地区
          </span>
        </td>
        <td className="px-4 py-5">
          <span className="text-sm font-black text-neutral-800">{row.network}</span>
          <span className="mt-1 block text-xs leading-5 text-neutral-500">{row.asn}</span>
        </td>
        <td className="px-4 py-5 text-right">
          <strong className="text-xs text-neutral-700">{row.observation}</strong>
          <div className="mt-2 flex flex-wrap justify-end gap-1.5">
            {row.queryTypes.map((queryType) => (
              <span
                key={queryType}
                className="rounded-md bg-neutral-100 px-2 py-1 text-[11px] font-bold text-neutral-600"
              >
                {queryType}
              </span>
            ))}
          </div>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

Each desktop row must:

- use `break-all font-mono` for the complete IPv4 or IPv6 address;
- show the localized country with “IP 数据库估算的网络注册地区” beneath it;
- show organization/ISP with the full “自治系统编号” label beneath it;
- right-align the hit label and wrap neutral query-type chips below it;
- keep row separators only, with no per-row card, shadow, server icon, or
  red/green evidence chip.

- [ ] **Step 6: Run the desktop structure test**

Run:

```bash
npx tsx --test backend/tests/dnsLeakTestPageSource.test.ts
```

Expected: PASS for table semantics, headings, persistent help, and icon removal.

### Task 4: Add the confirmed B1 mobile evidence layout and public-page coverage

**Files:**
- Modify: `src/pages/dnsLeakTest/DNSLeakTestPage.tsx`
- Modify: `backend/tests/dnsLeakTestPageSource.test.ts`
- Modify: `backend/tests/publicPageRoutes.test.ts`

- [ ] **Step 1: Add failing mobile and SSR assertions**

Extend `backend/tests/dnsLeakTestPageSource.test.ts`:

```ts
test('DNS resolver mobile evidence uses labeled rows without horizontal scrolling', () => {
  assert.match(pageSource, /md:hidden/);
  for (const label of ['位置', '所属网络', '自治系统编号', '查询类型']) {
    assert.match(pageSource, new RegExp(label));
  }
  assert.match(pageSource, /break-all/);
  assert.doesNotMatch(pageSource, /overflow-x-auto/);
});
```

In the existing DNS Leak Test block in
`backend/tests/publicPageRoutes.test.ts`, add:

```ts
assert.match(dnsLeakHtml, /每一行代表一个实际访问 GateRank 权威探针/);
assert.match(dnsLeakHtml, /AS 编号/);
assert.match(dnsLeakHtml, /不能据此判断 DoH 或 DoT/);
```

- [ ] **Step 2: Run the page tests and verify the mobile test fails**

Run:

```bash
npx tsx --test \
  backend/tests/dnsLeakTestPageSource.test.ts \
  backend/tests/publicPageRoutes.test.ts
```

Expected: FAIL until the B1 structure exists. Static explainer assertions may
already pass after Task 3.

- [ ] **Step 3: Render the B1 mobile list**

For widths below `md`, render a `md:hidden` section for each prepared row:

```tsx
<article className="border-b border-neutral-200 py-5">
  <div className="flex items-start justify-between gap-4">
    <p className="min-w-0 break-all font-mono text-sm font-black text-neutral-950">
      {row.ip}
    </p>
    <strong className="shrink-0 text-right text-xs text-neutral-700">
      {row.observation}
    </strong>
  </div>
  <dl className="mt-4 grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-3 text-sm">
    <dt className="text-xs font-bold text-neutral-400">位置</dt>
    <dd className="min-w-0 text-neutral-700">
      {row.location}
      <span className="mt-1 block text-xs leading-5 text-neutral-400">
        IP 数据库估算的网络注册地区
      </span>
    </dd>
    <dt className="text-xs font-bold text-neutral-400">所属网络</dt>
    <dd className="min-w-0 break-words text-neutral-700">{row.network}</dd>
    <dt className="text-xs font-bold text-neutral-400">自治系统编号</dt>
    <dd className="min-w-0 break-words text-neutral-700">{row.asn}</dd>
    <dt className="text-xs font-bold text-neutral-400">查询类型</dt>
    <dd className="flex min-w-0 flex-wrap gap-1.5">
      {row.queryTypes.map((queryType) => (
        <span
          key={queryType}
          className="rounded-md bg-neutral-100 px-2 py-1 text-[11px] font-bold text-neutral-600"
        >
          {queryType}
        </span>
      ))}
    </dd>
  </dl>
</article>
```

Use visible `<dt>` labels and `<dd>` values for:

- `位置`
- `所属网络`
- `自治系统编号`
- `查询类型`

Query type chips may wrap within the value cell. Do not add a horizontally
scrollable wrapper. The desktop table is `hidden` below `md`, and the mobile
list is `hidden` from `md` upward, so assistive technology does not encounter
both representations at the same active breakpoint.

- [ ] **Step 4: Preserve all result states**

Keep one shared state branch around both responsive representations:

- no result: “开始检测后……”;
- running with no observations: waiting copy;
- running with rows: show partial-evidence notice plus rows;
- completed with no rows: “本轮未发现解析器，结果无法判定。”;
- unknown country/network/ASN/type: show the presentation-model fallbacks.

Retain resolver entrance animation only where it does not obscure reading, and
keep `motion-reduce:animate-none`.

- [ ] **Step 5: Run focused DNS Leak Test tests**

Run:

```bash
npx tsx --test \
  backend/tests/dnsLeakTestShared.test.ts \
  backend/tests/dnsLeakTestService.test.ts \
  backend/tests/dnsLeakTestState.test.ts \
  backend/tests/dnsLeakTestPageSource.test.ts \
  backend/tests/publicPageRoutes.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the responsive evidence UI**

```bash
git add \
  src/pages/dnsLeakTest/DNSLeakTestPage.tsx \
  backend/tests/dnsLeakTestPageSource.test.ts \
  backend/tests/publicPageRoutes.test.ts
git commit -m "feat: redesign DNS resolver evidence UI"
```

### Task 5: Verify regression safety and prepare the implementation handoff

**Files:**
- Verify only; modify implementation files only if a failure is caused by this feature

- [ ] **Step 1: Run the full backend suite**

Run:

```bash
npm run test:backend
```

Expected: PASS. If an unrelated pre-existing failure appears, record its exact
test name and error separately; do not weaken a test to make the suite green.

- [ ] **Step 2: Run frontend and backend type checks**

Run:

```bash
npm run lint
npm run server:typecheck
```

Expected: both commands PASS with no DNS Leak Test type errors.

- [ ] **Step 3: Build the production frontend**

Run:

```bash
npm run build
```

Expected: PASS and emit the production bundle under `dist/`.

- [ ] **Step 4: Inspect the final diff and repository scope**

Run:

```bash
git diff --check
git status --short
git log --oneline -5
```

Expected:

- no whitespace errors;
- only the planned DNS Leak Test source, test, design, and plan files are in
  feature commits;
- existing `node_modules/.package-lock.json`, `node_modules/dns2/`, and
  `.superpowers/brainstorm/26926-1784960468/` artifacts remain uncommitted;
- no API schema, database, DNS probe, Cloudflare, Nginx, or deployment file is
  changed.

- [ ] **Step 5: Perform a local browser acceptance pass**

Start the API and frontend using the repository's existing local workflow, open
`/tools/dns-leak-test`, and verify:

1. desktop table alignment and four headers;
2. sorting by hit count, then IP;
3. Chinese country, full ASN wording, and query-type chips;
4. long IPv6 wrapping;
5. mobile B1 labels with no horizontal scroll;
6. partial, empty, and complete states;
7. copied result matches visible ordering and terminology;
8. red/green remains reserved for the actual leak verdict.

Capture the viewport sizes and observed result in the implementation handoff.
Do not deploy production, change Cloudflare records, or modify the DNS host as
part of this plan.

- [ ] **Step 6: Report verification evidence**

The completion report must list:

- focused test command and result;
- full backend test result;
- frontend and backend type-check results;
- production build result;
- desktop and mobile browser acceptance result;
- commits created;
- any pre-existing unrelated dirty files or failures;
- explicit confirmation that production deployment was not performed.
