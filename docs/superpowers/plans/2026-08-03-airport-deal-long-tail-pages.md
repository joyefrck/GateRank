# Airport Deal Long-Tail Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为每个公开机场生成唯一、永久、服务端可抓取的 `/deals/:airport_slug` 优惠长尾页，并把同一机场的全部有效活动汇总到该页面。

**Architecture:** 新建一个只输出公开安全字段的 `AirportDealDetailService`，HTML 路由与 JSON API 通过相同的 slug 缓存键复用该视图。共享 SEO 构造器保证 SSR 与 React 使用相同的 title、canonical、FAQ 和结构化数据；标准 sitemap 从现有公开报告 URL 派生一条单机场优惠 URL，并用广告活动真实更新时间补充 `lastmod`。

**Tech Stack:** TypeScript 5.8、React 19、Express 4、MySQL 8、Vite 6、Node test runner、Nginx

---

## 不可破坏的页面身份规则

- 一个机场只对应一个优惠页面，页面身份只使用 `airport_slug`。
- 多个同机场活动必须汇总为同一个 `/deals/:airport_slug` 页面中的多张活动卡。
- `campaign_id` 只用于活动卡、曝光和点击统计，不能进入详情 URL、canonical 或 sitemap。

## 文件结构

- `shared/airportAds.ts`：定义单机场优惠页的公开数据契约、活动排序器和 URL 构造器。
- `shared/publicSeo.ts`：生成单机场优惠页 SEO、FAQ 与 JSON-LD。
- `backend/src/services/airportDealDetailService.ts`：按机场 slug 读取公开机场并汇总全部有效活动，不暴露机场账号、订阅或测试凭据。
- `backend/src/services/publicPageRenderer.ts`：输出可直接被 Google 抓取的详情 HTML。
- `backend/src/routes/publicRoutes.ts`：提供 `/api/v1/pages/deals/:slug`。
- `backend/src/routes/publicPageRoutes.ts`：提供 `/deals/:slug`，并与 API 共用 `deal-detail:<slug>` 缓存键。
- `src/pages/deals/DealCard.tsx`：聚合页和详情页共享的活动卡，保留 campaign 级曝光和点击统计。
- `src/pages/deals/DealDetailPage.tsx`：React 详情页。
- `src/pages/deals/dealDetailInitialData.ts`：读取 SSR 注入数据并决定是否回退请求 API。
- `src/App.tsx`、`src/site/publicSite.tsx`、`src/site/marketingRoutes.ts`：识别详情路由、生成链接并将详情页统计归入 `deals`。
- `backend/src/repositories/airportAdCampaignRepository.ts`：暴露活动真实更新时间以及 sitemap 更新摘要。
- `backend/src/routes/newsPublicRoutes.ts`：向标准 sitemap 加入每个公开机场唯一的优惠详情 URL。
- `nginx.conf`：把 `/deals/<slug>` 转发到后端 prerender 路由。
- `backend/tests/*.test.ts`、`src/pages/deals/*.test.ts`：覆盖汇总、SSR/React 一致性、sitemap 唯一性、Nginx 和结构化数据。

### Task 1: 建立共享详情契约、唯一 URL 与 SEO 构造器

**Files:**
- Modify: `shared/airportAds.ts`
- Modify: `shared/publicSeo.ts`
- Test: `backend/tests/publicSiteSeo.test.ts`

- [ ] **Step 1: 写入失败的共享 SEO 测试**

在 `backend/tests/publicSiteSeo.test.ts` 增加导入和测试，明确同一机场两个活动仍只有一个页面 URL：

```ts
import {
  buildAirportDealDetailPath,
  type AirportDealDetailView,
} from '../../shared/airportAds';
import {
  buildAirportDealDetailSeo,
  buildAirportDealDetailStructuredData,
  getPublicOgImageForPath as resolvePageOgImageMeta,
} from '../../shared/publicSeo';

const airportDealDetailView: AirportDealDetailView = {
  airport: {
    id: 1,
    slug: 'elphantroute',
    name: '大象网络',
    website: 'https://www.elephant-ipcheck.com/',
    status: 'normal',
    plan_price_month: 12,
    has_trial: true,
    payment_methods: ['alipay', 'usdt_trc20'],
    airport_intro: '专注稳定高速网络服务。',
    tags: ['支持试用'],
  },
  active_deals: [
    {
      campaign_id: 6,
      airport_id: 1,
      airport_name: '大象网络',
      airport_slug: 'elphantroute',
      website: 'https://www.elephant-ipcheck.com/',
      report_url: '/airports/elphantroute',
      coupon_code: 'ABIDTEF',
      discount_title: '新老用户九折',
      discount_description: '新老用户一律九折优惠',
      applicable_plan: '季付 / 半年付',
      starts_at: '2026-07-25T19:29:52+08:00',
      ends_at: '2026-10-25T19:29:52+08:00',
      purchased_months: 3,
      billed_amount: 3000,
      is_stackable: false,
      refund_supported: true,
      supports_trial: true,
      supports_usdt: true,
      supports_streaming: true,
      supports_ai: true,
      low_price_plan: true,
      discount_percent: 10,
      created_at: '2026-07-25T19:29:52+08:00',
    },
    {
      campaign_id: 8,
      airport_id: 1,
      airport_name: '大象网络',
      airport_slug: 'elphantroute',
      website: 'https://www.elephant-ipcheck.com/',
      report_url: '/airports/elphantroute',
      coupon_code: 'ELEPHANT20',
      discount_title: '月付套餐优惠',
      discount_description: '指定月付套餐可用',
      applicable_plan: '月付',
      starts_at: '2026-08-01T00:02:02+08:00',
      ends_at: '2026-09-01T00:02:02+08:00',
      purchased_months: 1,
      billed_amount: 1000,
      is_stackable: false,
      refund_supported: false,
      supports_trial: true,
      supports_usdt: true,
      supports_streaming: true,
      supports_ai: true,
      low_price_plan: true,
      discount_percent: 20,
      created_at: '2026-08-01T00:02:02+08:00',
    },
  ],
  generated_at: '2026-08-03T10:00:00+08:00',
};

test('airport deal detail SEO keeps multiple campaigns on one airport URL', () => {
  const path = buildAirportDealDetailPath('elphantroute');
  const seo = buildAirportDealDetailSeo(airportDealDetailView, 2026);
  const jsonLd = buildAirportDealDetailStructuredData(
    'https://gate-rank.com',
    airportDealDetailView,
    2026,
  );

  assert.equal(path, '/deals/elphantroute');
  assert.match(seo.title, /^大象网络优惠码 2026/);
  assert.match(seo.description, /2 个有效优惠活动/);
  assert.equal(JSON.stringify(jsonLd).match(/\/deals\/elphantroute/g)?.length >= 1, true);
  assert.equal(JSON.stringify(jsonLd).match(/ABIDTEF/g)?.length, 1);
  assert.equal(JSON.stringify(jsonLd).match(/ELEPHANT20/g)?.length, 1);
});

test('airport deal detail SEO remains truthful without an active campaign', () => {
  const seo = buildAirportDealDetailSeo({
    ...airportDealDetailView,
    active_deals: [],
  }, 2026);

  assert.match(seo.description, /当前暂无有效优惠码/);
  assert.doesNotMatch(seo.description, /2 个有效优惠活动/);
});

test('airport deal detail paths reuse the deals OG image', () => {
  assert.deepEqual(resolvePageOgImageMeta('/deals/elphantroute'), {
    path: '/og/deals-coupons.png',
    alt: 'GateRank 机场优惠码大全分享图',
    width: 1200,
    height: 630,
    type: 'image/png',
  });
});
```

- [ ] **Step 2: 运行测试并确认因共享函数不存在而失败**

Run:

```bash
npx tsx --test backend/tests/publicSiteSeo.test.ts
```

Expected: FAIL，错误指向 `buildAirportDealDetailPath`、`buildAirportDealDetailSeo` 或 `buildAirportDealDetailStructuredData` 尚未导出。

- [ ] **Step 3: 在 `shared/airportAds.ts` 增加公开数据契约和稳定排序**

增加以下类型与函数；`payment_methods` 只包含公开枚举字符串，不能复用完整 `Airport` 实体：

```ts
export interface AirportDealDetailAirport {
  id: number;
  slug: string;
  name: string;
  website: string;
  status: 'normal' | 'risk' | 'down';
  plan_price_month: number;
  has_trial: boolean;
  payment_methods: string[];
  airport_intro: string;
  tags: string[];
}

export interface AirportDealDetailView {
  airport: AirportDealDetailAirport;
  active_deals: AirportDealView[];
  generated_at: string;
}

export interface AirportDealSitemapUpdate {
  airport_slug: string;
  updated_at: string;
}

export function buildAirportDealDetailPath(slug: string): string {
  return `/deals/${encodeURIComponent(slug)}`;
}

export function sortAirportDealViews(deals: AirportDealView[]): AirportDealView[] {
  return [...deals].sort((left, right) =>
    left.ends_at.localeCompare(right.ends_at)
      || left.starts_at.localeCompare(right.starts_at)
      || left.campaign_id - right.campaign_id,
  );
}
```

同时给 `AirportDealView` 增加可选的真实更新时间字段，避免立刻要求所有旧测试 fixture 补字段：

```ts
updated_at?: string;
```

- [ ] **Step 4: 在 `shared/publicSeo.ts` 增加详情 SEO、FAQ 和 JSON-LD**

实现并导出：

```ts
export function buildAirportDealDetailSeo(
  view: AirportDealDetailView,
  currentYear: number,
): PublicSeoText {
  const count = view.active_deals.length;
  const statusText = count > 0
    ? `当前汇总 ${formatCount(count)} 个有效优惠活动，包含优惠码、适用套餐、活动期限、叠加与退款规则。`
    : '当前暂无有效优惠码，页面将持续更新该机场的活动折扣，并提供价格、试用、支付方式与测评入口。';
  return {
    title: `${view.airport.name}优惠码 ${currentYear}｜最新优惠、折扣活动与使用说明 | ${PUBLIC_SITE_BRAND_NAME}`,
    description: `查询${view.airport.name}最新优惠码和折扣活动。${statusText}优惠信息不影响 GateRank Score。`,
    keywords: `${view.airport.name}优惠码,${view.airport.name}优惠,${view.airport.name}折扣,${view.airport.name}活动,机场优惠码,${PUBLIC_SITE_BRAND_NAME}`,
  };
}

export function buildAirportDealDetailFaqItems(view: AirportDealDetailView) {
  const airportName = view.airport.name;
  const activeAnswer = view.active_deals.length > 0
    ? `${airportName}当前有 ${view.active_deals.length} 个有效优惠活动，具体优惠码、适用套餐和截止时间以本页活动卡及服务商结算页面为准。`
    : `${airportName}当前暂无有效优惠码。本页会保留并在新活动生效后自动更新。`;
  return [
    { question: `${airportName}现在有可用优惠码吗？`, answer: activeAnswer },
    { question: `${airportName}优惠码会影响 GateRank 排名吗？`, answer: '不会。优惠活动、广告投放和优惠码不进入 GateRank Score，也不改变榜单排序。' },
    { question: `${airportName}优惠码过期了怎么办？`, answer: '过期优惠码不会继续展示为有效活动。购买前应再次核对服务商结算页中的价格、套餐和有效期。' },
  ];
}
```

`buildAirportDealDetailStructuredData()` 必须输出一个自引用 `WebPage`、一个 `BreadcrumbList`、一个以机场服务为主体并含多个 `Offer` 的 `Service`，以及与页面可见问题完全一致的 `FAQPage`。每个 `Offer.url` 都使用 `buildAirportDealDetailPath(view.airport.slug)`，不得使用 campaign ID 或报告 URL；不输出缺失的 `price` 和 `priceCurrency`。

同时把详情路径复用现有优惠分享图：

```ts
if (pathname === PUBLIC_SEO_PATHS.deals || pathname.startsWith(`${PUBLIC_SEO_PATHS.deals}/`)) {
  return PUBLIC_CORE_OG_IMAGES.deals;
}
```

- [ ] **Step 5: 运行共享 SEO 测试并确认通过**

Run:

```bash
npx tsx --test backend/tests/publicSiteSeo.test.ts
```

Expected: PASS，新增两个测试均通过。

- [ ] **Step 6: 提交共享契约与 SEO**

```bash
git add shared/airportAds.ts shared/publicSeo.ts backend/tests/publicSiteSeo.test.ts
git commit -m "feat: add airport deal detail SEO contract"
```

### Task 2: 用独立服务按机场汇总有效活动

**Files:**
- Create: `backend/src/services/airportDealDetailService.ts`
- Test: `backend/tests/airportDealDetailService.test.ts`

- [ ] **Step 1: 写入失败的服务测试**

创建 `backend/tests/airportDealDetailService.test.ts`，覆盖两个同机场活动、其他机场活动过滤、稳定排序、无活动和未公开机场：

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { AirportDealDetailService } from '../src/services/airportDealDetailService';
import type { AirportDealView } from '../../shared/airportAds';

const deals = [
  createDeal(8, 1, 'elphantroute', '2026-09-01T00:02:02+08:00'),
  createDeal(6, 1, 'elphantroute', '2026-10-25T19:29:52+08:00'),
  createDeal(9, 2, 'aurora', '2026-08-30T00:00:00+08:00'),
];

test('AirportDealDetailService groups every active campaign under one airport slug', async () => {
  const service = new AirportDealDetailService({
    airportRepository: {
      getBySlug: async () => ({
        id: 1,
        slug: 'elphantroute',
        name: '大象网络',
        website: 'https://www.elephant-ipcheck.com/',
        status: 'normal',
        is_listed: true,
        plan_price_month: 12,
        has_trial: true,
        payment_methods: ['alipay', 'usdt_trc20'],
        airport_intro: '专注稳定高速网络服务。',
        tags: ['支持试用'],
        created_at: '2026-03-21T21:01:54+08:00',
      }),
    },
    airportAdCampaignRepository: {
      listActiveDeals: async () => deals,
    },
  });

  const view = await service.getBySlug('elphantroute', new Date('2026-08-03T10:00:00+08:00'));
  assert.equal(view?.airport.slug, 'elphantroute');
  assert.deepEqual(view?.active_deals.map((deal) => deal.campaign_id), [8, 6]);
  assert.equal(view?.generated_at, '2026-08-03T10:00:00+08:00');
});

test('AirportDealDetailService keeps a listed airport page when no deal is active', async () => {
  const service = createService({ is_listed: true }, []);
  const view = await service.getBySlug('elphantroute');
  assert.deepEqual(view?.active_deals, []);
});

test('AirportDealDetailService hides unknown and unlisted airports', async () => {
  assert.equal(await createService(null, []).getBySlug('missing'), null);
  assert.equal(await createService({ is_listed: false }, []).getBySlug('hidden'), null);
});

test('AirportDealDetailService rejects a malformed active campaign', async () => {
  const malformed = createDeal(6, 1, 'elphantroute', '2026-10-25T19:29:52+08:00');
  malformed.coupon_code = '';
  await assert.rejects(
    createService({ is_listed: true }, [malformed]).getBySlug('elphantroute'),
    /invalid active airport deal 6: coupon_code/,
  );
});
```

在同一测试文件内提供 `createDeal()` 和 `createService()` fixture，字段与 `AirportDealView`、`Airport` 类型一致；`createService()` 应合并传入的机场覆盖字段后调用真实构造函数，不使用 `as never` 绕过核心断言。

- [ ] **Step 2: 运行测试并确认服务尚不存在**

Run:

```bash
npx tsx --test backend/tests/airportDealDetailService.test.ts
```

Expected: FAIL with module-not-found for `airportDealDetailService`。

- [ ] **Step 3: 创建只映射公开字段的详情服务**

创建 `backend/src/services/airportDealDetailService.ts`：

```ts
import type { Airport } from '../types/domain';
import type { AirportDealDetailView, AirportDealView } from '../../../shared/airportAds';
import { sortAirportDealViews } from '../../../shared/airportAds';
import { formatDateTimeInTimezoneIso } from '../utils/time';

interface AirportDealDetailServiceDeps {
  airportRepository: {
    getBySlug(slug: string): Promise<Airport | null>;
  };
  airportAdCampaignRepository: {
    listActiveDeals(now?: Date): Promise<AirportDealView[]>;
  };
}

export class AirportDealDetailService {
  constructor(private readonly deps: AirportDealDetailServiceDeps) {}

  async getBySlug(slug: string, now: Date = new Date()): Promise<AirportDealDetailView | null> {
    const airport = await this.deps.airportRepository.getBySlug(slug);
    if (!airport || !airport.is_listed || !airport.slug) {
      return null;
    }
    const deals = await this.deps.airportAdCampaignRepository.listActiveDeals(now);
    const airportDeals = deals.filter((deal) => deal.airport_id === airport.id);
    airportDeals.forEach(assertRenderableAirportDeal);
    return {
      airport: {
        id: airport.id,
        slug: airport.slug,
        name: airport.name,
        website: airport.website,
        status: airport.status,
        plan_price_month: Number(airport.plan_price_month || 0),
        has_trial: Boolean(airport.has_trial),
        payment_methods: airport.payment_methods || [],
        airport_intro: airport.airport_intro || '',
        tags: airport.tags || [],
      },
      active_deals: sortAirportDealViews(airportDeals),
      generated_at: formatDateTimeInTimezoneIso(now),
    };
  }
}

function assertRenderableAirportDeal(deal: AirportDealView): void {
  for (const [field, value] of [
    ['coupon_code', deal.coupon_code],
    ['discount_title', deal.discount_title],
    ['discount_description', deal.discount_description],
    ['applicable_plan', deal.applicable_plan],
    ['starts_at', deal.starts_at],
    ['ends_at', deal.ends_at],
  ] as const) {
    if (!String(value || '').trim()) {
      throw new Error(`invalid active airport deal ${deal.campaign_id}: ${field}`);
    }
  }
}
```

- [ ] **Step 4: 运行服务测试并确认通过**

Run:

```bash
npx tsx --test backend/tests/airportDealDetailService.test.ts
```

Expected: PASS，4 tests passed。

- [ ] **Step 5: 提交聚合服务**

```bash
git add backend/src/services/airportDealDetailService.ts backend/tests/airportDealDetailService.test.ts
git commit -m "feat: aggregate airport deal detail views"
```

### Task 3: 增加 JSON API、SSR 详情路由和共享缓存

**Files:**
- Modify: `backend/src/app.ts`
- Modify: `backend/src/routes/publicRoutes.ts`
- Modify: `backend/src/routes/publicPageRoutes.ts`
- Modify: `backend/src/services/publicPageRenderer.ts`
- Test: `backend/tests/publicPageRoutes.test.ts`
- Test: `backend/tests/publicRoutes.test.ts`
- Test: `backend/tests/appPublicCacheWiring.test.ts`

- [ ] **Step 1: 写入失败的 HTML/API 汇总测试**

在 `backend/tests/publicPageRoutes.test.ts` 增加测试，使用同一个 `pageCache` 和一个记录调用次数的 `airportDealDetailService`：

```ts
test('GET deal detail HTML and API share one slug view with multiple campaign cards', async () => {
  let detailCalls = 0;
  const detailView = createAirportDealDetailView([createDealView(1), {
    ...createDealView(1),
    campaign_id: 8,
    coupon_code: 'SECOND20',
  }]);
  const airportDealDetailService = {
    getBySlug: async () => {
      detailCalls += 1;
      return detailView;
    },
  };
  const pageCache = createTimedPromiseCache(60_000);
  const app = express();
  app.use('/api/v1', createPublicRoutes(createPublicRouteDeps({
    airportDealDetailService,
    pageCache,
  })));
  app.use(createPublicPageRoutes({
    publicViewService: createPublicViewServiceStub(),
    airportDealDetailService,
    pageCache,
    frontendAssets: TEST_FRONTEND_ASSETS,
  }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const htmlResponse = await fetch(`http://127.0.0.1:${port}/deals/elphantroute`);
    const apiResponse = await fetch(`http://127.0.0.1:${port}/api/v1/pages/deals/elphantroute`);
    const html = await htmlResponse.text();
    const payload = await apiResponse.json() as AirportDealDetailView;

    assert.equal(htmlResponse.status, 200);
    assert.equal(apiResponse.status, 200);
    assert.equal(detailCalls, 1);
    assert.match(html, /<h1>大象网络优惠码与最新优惠活动<\/h1>/);
    assert.match(html, /ABIDTEF/);
    assert.match(html, /SECOND20/);
    assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
    assert.deepEqual(payload.active_deals.map((deal) => deal.campaign_id), [1, 8]);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
```

再增加未知 slug 的 HTML `404` 与 API `404` 测试，以及无活动机场仍返回 `200` 且正文包含“当前暂无有效优惠码”的测试。

- [ ] **Step 2: 运行路由测试并确认详情依赖尚未接入**

Run:

```bash
npx tsx --test backend/tests/publicPageRoutes.test.ts backend/tests/publicRoutes.test.ts backend/tests/appPublicCacheWiring.test.ts
```

Expected: FAIL，类型错误或断言显示详情服务、路由和 renderer 尚不存在。

- [ ] **Step 3: 在 `backend/src/app.ts` 创建并注入单例详情服务**

在仓库实例创建之后增加：

```ts
const airportDealDetailService = new AirportDealDetailService({
  airportRepository,
  airportAdCampaignRepository,
});
```

把同一实例传给 `createPublicRoutes()` 和 `createPublicPageRoutes()`。两套路由继续接收同一个 `publicPageCache`，保证 HTML 与 API 的 `deal-detail:<slug>` 键命中同一个 Promise。

- [ ] **Step 4: 增加 API 路由**

在 `PublicDeps` 中加入：

```ts
airportDealDetailService?: {
  getBySlug(slug: string): Promise<AirportDealDetailView | null>;
};
```

在现有精确 `/pages/deals` 路由之后增加：

```ts
router.get('/pages/deals/:slug', async (req, res, next) => {
  try {
    if (!deps.airportDealDetailService) {
      throw new Error('airportDealDetailService is not configured');
    }
    const slug = String(req.params.slug || '');
    const view = await pageCache.getOrLoad(
      `deal-detail:${slug}`,
      () => deps.airportDealDetailService!.getBySlug(slug),
    );
    if (!view) {
      throw new HttpError(404, 'AIRPORT_DEAL_PAGE_NOT_FOUND', `airport deal page not found: ${slug}`);
    }
    setPublicCacheHeaders(res);
    res.json(view);
  } catch (error) {
    next(error);
  }
});
```

- [ ] **Step 5: 增加 SSR renderer 和 HTML 路由**

`renderAirportDealDetailPublicPage()` 使用共享 SEO、结构化数据和当前上海年份，向 `renderPublicDocument()` 传入：

```ts
initialData: {
  kind: 'deal_detail',
  params: { slug: view.airport.slug },
  payload: view,
}
```

年份必须从同一个 `view.generated_at` 读取，避免 SSR 和 React 跨年时产生不同 head：

```ts
const currentYear = Number(view.generated_at.slice(0, 4));
const seo = buildAirportDealDetailSeo(view, currentYear);
```

正文必须包含：面包屑、唯一 H1、状态提示、风险提示、全部活动卡、无活动状态、月付价格、试用、支付方式、机场介绍、测评链接、带 `sponsored nofollow noreferrer noopener` 的官网链接、可见 FAQ。活动卡继续保留 `campaign_id` 数据属性，页面 URL 不使用该 ID。先通过现有 `normalizeExternalHref()` 处理官网；结果为 `#` 时不渲染官网 `<a>`，只保留测评入口。

在精确 `/deals` 路由之后增加：

```ts
router.get('/deals/:slug', async (req, res) => {
  const siteUrl = getSiteOrigin(req);
  const slug = String(req.params.slug || '');
  try {
    if (!deps.airportDealDetailService) {
      throw new Error('airportDealDetailService is not configured');
    }
    const view = await pageCache.getOrLoad(
      `deal-detail:${slug}`,
      () => deps.airportDealDetailService!.getBySlug(slug),
    );
    if (!view) {
      res.status(404).type('html').send(renderPublicHtmlError(siteUrl, 404, '机场优惠页面不存在', frontendAssets));
      return;
    }
    setPublicCacheHeaders(res);
    res.status(200).type('html').send(renderAirportDealDetailPublicPage(siteUrl, view, frontendAssets));
  } catch (error) {
    console.error('[public-page] failed to render airport deal page', { error, requestId: req.requestId || 'unknown' });
    res.status(500).type('html').send(renderPublicHtmlError(siteUrl, 500, '机场优惠页面加载失败', frontendAssets));
  }
});
```

- [ ] **Step 6: 运行后端详情路由测试**

Run:

```bash
npx tsx --test backend/tests/publicPageRoutes.test.ts backend/tests/publicRoutes.test.ts backend/tests/appPublicCacheWiring.test.ts
```

Expected: PASS，且同一 slug 的 HTML/API 请求只调用详情服务一次。

- [ ] **Step 7: 提交后端详情路由**

```bash
git add backend/src/app.ts backend/src/routes/publicRoutes.ts backend/src/routes/publicPageRoutes.ts backend/src/services/publicPageRenderer.ts backend/tests/publicPageRoutes.test.ts backend/tests/publicRoutes.test.ts backend/tests/appPublicCacheWiring.test.ts
git commit -m "feat: serve airport deal detail pages"
```

### Task 4: 增加 React 详情页并保持 hydration 一致

**Files:**
- Create: `src/pages/deals/DealCard.tsx`
- Create: `src/pages/deals/DealDetailPage.tsx`
- Create: `src/pages/deals/dealDetailInitialData.ts`
- Create: `src/pages/deals/dealDetailInitialData.test.ts`
- Modify: `src/pages/deals/DealsPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/site/publicSite.tsx`
- Modify: `src/site/marketingRoutes.ts`
- Test: `backend/tests/frontendCrawlableLinks.test.ts`
- Test: `backend/tests/marketingPageKinds.test.ts`

- [ ] **Step 1: 写入失败的初始数据和路由分类测试**

`src/pages/deals/dealDetailInitialData.test.ts` 使用带有两个活动的 SSR envelope：

```ts
test('readDealDetailInitialData accepts the matching slug and prevents refetch', () => {
  const documentRef = documentWithInitialData({
    kind: 'deal_detail',
    params: { slug: 'elphantroute' },
    payload: detailView,
  });
  const initial = readDealDetailInitialData('elphantroute', documentRef);
  assert.deepEqual(initial, detailView);
  assert.equal(shouldFetchDealDetailData(initial), false);
});

test('readDealDetailInitialData rejects another airport slug', () => {
  const documentRef = documentWithInitialData({
    kind: 'deal_detail',
    params: { slug: 'aurora' },
    payload: detailView,
  });
  assert.equal(readDealDetailInitialData('elphantroute', documentRef), null);
});
```

在 `backend/tests/marketingPageKinds.test.ts` 的期望映射中加入：

```ts
deal_detail: 'deals',
```

在 `backend/tests/frontendCrawlableLinks.test.ts` 增加源码断言：详情路由正则出现在聚合路由判断之前；详情页调用共享 SEO、遍历 `active_deals`、输出风险提示和无优惠状态。

- [ ] **Step 2: 运行测试并确认详情前端模块尚不存在**

Run:

```bash
npx tsx --test src/pages/deals/dealDetailInitialData.test.ts backend/tests/marketingPageKinds.test.ts backend/tests/frontendCrawlableLinks.test.ts
```

Expected: FAIL with missing detail initial-data module and route mapping mismatch。

- [ ] **Step 3: 提取共享 `DealCard`**

把现有 `DealsPage.tsx` 中活动卡抽到 `src/pages/deals/DealCard.tsx`。组件 props 固定为：

```ts
interface DealCardProps {
  deal: AirportDealView;
  tone: string;
  pagePath: string;
  detailHref: string;
}
```

组件内部管理复制状态；`useMarketingImpression()` 和官网点击继续使用当前 `campaign_id`，但 `pagePath` 由调用方传入。机场名称和“查看优惠详情”使用普通可抓取 `<a href={detailHref}>`；查看测评仍链接 `deal.report_url`。官网链接改为 `rel="sponsored nofollow noreferrer noopener"`，且 `normalizeExternalHref(deal.website) === '#'` 时不渲染官网按钮。

聚合页传入：

```tsx
<DealCard
  deal={deal}
  tone={tone}
  pagePath={buildDealsHref()}
  detailHref={buildAirportDealDetailHref(deal.airport_slug)}
/>
```

- [ ] **Step 4: 实现详情初始数据读取器**

`dealDetailInitialData.ts` 只接受 kind 与 slug 都匹配的数据：

```ts
export function readDealDetailInitialData(
  slug: string,
  documentRef: Document | null = getBrowserDocument(),
): AirportDealDetailView | null {
  const element = documentRef?.getElementById('__GATERANK_INITIAL_DATA__');
  if (!element?.textContent) return null;
  try {
    const envelope = JSON.parse(element.textContent) as DealDetailInitialDataEnvelope;
    return envelope.kind === 'deal_detail'
      && envelope.params?.slug === slug
      && envelope.payload
      ? envelope.payload
      : null;
  } catch {
    return null;
  }
}

export function shouldFetchDealDetailData(initialData: AirportDealDetailView | null): boolean {
  return !initialData;
}
```

- [ ] **Step 5: 实现 `DealDetailPage`**

组件先读 SSR 数据；只有初始数据缺失时才请求：

```ts
fetch(`/api/v1/pages/deals/${encodeURIComponent(slug)}`)
```

使用 `buildAirportDealDetailSeo(data, Number(data.generated_at.slice(0, 4)))`、`buildAirportDealDetailStructuredData()` 和自引用 `buildAirportDealDetailHref(slug)` 设置 head。页面顺序必须与 SSR 相同，并按 `data.active_deals.map()` 渲染共享 `DealCard`；空数组显示“当前暂无有效优惠码”。`risk` 和 `down` 状态分别输出清晰警告，且警告位于活动卡之前。

- [ ] **Step 6: 注册路径、链接和统计映射**

在 `src/site/publicSite.tsx` 增加：

```ts
export function buildAirportDealDetailHref(slug: string): string {
  return buildAirportDealDetailPath(slug);
}
```

在 `src/App.tsx` 中先匹配详情、再匹配聚合页：

```ts
const dealDetailMatch = path.match(/^\/deals\/([a-z0-9-]+)\/?$/);
const dealsMatch = path.match(/^\/deals\/?$/);

if (dealDetailMatch) {
  return { kind: 'deal_detail', airportSlug: dealDetailMatch[1] };
}
```

在渲染分支中加入：

```tsx
if (route.kind === 'deal_detail') {
  return <DealDetailPage slug={route.airportSlug || ''} />;
}
```

把 `deal_detail` 加入 `AppRouteKind` 和 `InitialPublicDataKind`，并在 `MARKETING_PAGE_KIND_BY_ROUTE` 映射到现有 `deals`，不创建新的计费或分析 page kind。

- [ ] **Step 7: 运行详情前端测试**

Run:

```bash
npx tsx --test src/pages/deals/dealDetailInitialData.test.ts backend/tests/marketingPageKinds.test.ts backend/tests/frontendCrawlableLinks.test.ts
```

Expected: PASS，初始数据 slug 隔离、详情路由顺序和营销分类均正确。

- [ ] **Step 8: 提交 React 详情页**

```bash
git add src/pages/deals/DealCard.tsx src/pages/deals/DealDetailPage.tsx src/pages/deals/dealDetailInitialData.ts src/pages/deals/dealDetailInitialData.test.ts src/pages/deals/DealsPage.tsx src/App.tsx src/site/publicSite.tsx src/site/marketingRoutes.ts backend/tests/frontendCrawlableLinks.test.ts backend/tests/marketingPageKinds.test.ts
git commit -m "feat: add airport deal detail client route"
```

### Task 5: 接入站内链接、标准 sitemap 和生产 Nginx

**Files:**
- Modify: `backend/src/repositories/airportAdCampaignRepository.ts`
- Modify: `backend/src/routes/newsPublicRoutes.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/src/services/publicPageRenderer.ts`
- Modify: `src/App.tsx`
- Modify: `nginx.conf`
- Test: `backend/tests/airportAdCampaignRepository.test.ts`
- Test: `backend/tests/newsPublicRoutes.test.ts`
- Test: `backend/tests/publicPageRoutes.test.ts`
- Test: `backend/tests/frontendCrawlableLinks.test.ts`
- Test: `backend/tests/nginxConfig.test.ts`

- [ ] **Step 1: 写入失败的 sitemap、内链和 Nginx 测试**

在 `backend/tests/airportAdCampaignRepository.test.ts` 增加 `listDealSitemapUpdates()` 测试，断言 SQL 按机场 slug 分组并返回活动最大 `updated_at`。

在 `backend/tests/newsPublicRoutes.test.ts` 的 sitemap fixture 中让报告列表包含一次 `/airports/elphantroute`，活动更新时间服务返回同一 slug 两条活动更新；最终断言：

```ts
assert.equal((xml.match(/\/deals\/elphantroute<\/loc>/g) || []).length, 1);
assert.match(
  xml,
  /\/deals\/elphantroute<\/loc>\n    <lastmod>2026-08-02T12:30:00\+08:00<\/lastmod>/,
);
assert.doesNotMatch(xml, /\/deals\/6/);
assert.doesNotMatch(xml, /\/deals\/8/);
```

在 `backend/tests/publicPageRoutes.test.ts` 和 `backend/tests/frontendCrawlableLinks.test.ts` 断言聚合页与测评页都存在 `/deals/elphantroute` 文本链接。

在 `backend/tests/nginxConfig.test.ts` 增加：

```ts
assert.match(
  getLocationBlock(config, '^~ /deals/'),
  /proxy_pass\s+http:\/\/gaterank-api:8787;/,
);
```

- [ ] **Step 2: 运行测试并确认 sitemap 更新源、内链和代理尚不存在**

Run:

```bash
npx tsx --test backend/tests/airportAdCampaignRepository.test.ts backend/tests/newsPublicRoutes.test.ts backend/tests/publicPageRoutes.test.ts backend/tests/frontendCrawlableLinks.test.ts backend/tests/nginxConfig.test.ts
```

Expected: FAIL，缺少 sitemap repository 方法、详情内链和 `^~ /deals/` Nginx location。

- [ ] **Step 3: 暴露活动真实更新时间和 sitemap 摘要**

给 `CampaignRow`、`selectDealSql()` 和 `toDealView()` 增加 `updated_at`。再新增：

```ts
async listDealSitemapUpdates(): Promise<AirportDealSitemapUpdate[]> {
  const [rows] = await this.pool.query<Array<RowDataPacket & {
    airport_slug: string;
    updated_at: string;
  }>>(
    `SELECT airport.slug AS airport_slug,
            DATE_FORMAT(MAX(campaign.updated_at), '%Y-%m-%d %H:%i:%s') AS updated_at
       FROM airport_ad_campaigns campaign
       JOIN airports airport ON airport.id = campaign.airport_id
      WHERE airport.is_listed = 1
        AND airport.slug IS NOT NULL
        AND airport.slug <> ''
      GROUP BY airport.id, airport.slug`,
  );
  return rows.map((row) => ({
    airport_slug: row.airport_slug,
    updated_at: sqlDateTimeToTimezoneIso(row.updated_at),
  }));
}
```

活动已过期或取消后仍保留其最近真实更新时间，因此 sitemap `lastmod` 不会因为活动刚失效而退回更早日期。

- [ ] **Step 4: 在 sitemap 中按报告 slug 生成唯一优惠 URL**

`NewsPublicDeps` 增加可选的 `airportAdCampaignRepository.listDealSitemapUpdates()`，`backend/src/app.ts` 注入现有仓库。`getAirportDealSitemapEntries()` 先使用 `reportEntries` 作为公开机场白名单，再把每个 `/airports/:slug` 转成 `/deals/:slug`；用同 slug 的最大活动更新时间与报告 `lastmod` 取较新值。返回前按 path 去重。

把结果加入 `urls` 和 `staticLastmodByPath`：

```ts
const airportDealEntries = await getAirportDealSitemapEntries(deps, reportEntries);

const urls = [
  '/',
  '/rankings/all',
  ...airportDealEntries.map((entry) => entry.path),
];

const staticLastmodByPath = {
  '/': dataLastmod,
  ...Object.fromEntries(airportDealEntries.map((entry) => [entry.path, entry.lastmod])),
};
```

保留原数组中的其他现有 URL；上面的代码只表示新增条目的插入位置。不得根据 campaign ID 生成 sitemap URL。

- [ ] **Step 5: 增加聚合页和测评页双向内链**

SSR 聚合卡的机场标题改为详情链接，并保留单独“查看测评”链接：

```ts
const detailPath = buildAirportDealDetailPath(deal.airport_slug);
```

SSR 测评页主操作区增加：

```html
<a href="/deals/{slug}">查看该机场优惠信息</a>
```

React `ReportHeroV2` 增加同一路径的普通 `<a>`。链接文案不能声称当前一定有优惠。

- [ ] **Step 6: 增加生产前缀代理**

在 `nginx.conf` 的精确 `/deals/` location 后增加：

```nginx
location ^~ /deals/ {
  proxy_pass http://gaterank-api:8787;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-Host $host;
}
```

精确 `/deals`、`/deals/` 和 `/deals.md` 规则保持原样。

- [ ] **Step 7: 运行 sitemap、内链和 Nginx 测试**

Run:

```bash
npx tsx --test backend/tests/airportAdCampaignRepository.test.ts backend/tests/newsPublicRoutes.test.ts backend/tests/publicPageRoutes.test.ts backend/tests/frontendCrawlableLinks.test.ts backend/tests/nginxConfig.test.ts
```

Expected: PASS；同一机场 sitemap 只出现一个详情 URL，且生产代理覆盖详情路径。

- [ ] **Step 8: 提交发现链路和生产代理**

```bash
git add backend/src/repositories/airportAdCampaignRepository.ts backend/src/routes/newsPublicRoutes.ts backend/src/app.ts backend/src/services/publicPageRenderer.ts src/App.tsx nginx.conf backend/tests/airportAdCampaignRepository.test.ts backend/tests/newsPublicRoutes.test.ts backend/tests/publicPageRoutes.test.ts backend/tests/frontendCrawlableLinks.test.ts backend/tests/nginxConfig.test.ts
git commit -m "feat: publish airport deal pages in sitemap"
```

### Task 6: 全量验证、构建产物与上线前证据

**Files:**
- Modify: `dist/**`
- Verify: all files changed by Tasks 1-5

- [ ] **Step 1: 运行前端类型检查**

Run:

```bash
npm run lint
```

Expected: exit code 0。若出现与本功能无关的既有错误，记录完整错误并先单独验证所有本功能文件；不得把失败命令描述为通过。

- [ ] **Step 2: 运行后端类型检查**

Run:

```bash
npm run server:typecheck
```

Expected: exit code 0。

- [ ] **Step 3: 运行完整后端测试套件**

Run:

```bash
npm run test:backend
```

Expected: exit code 0，输出中 failed 数量为 0。必须记录实际 tests/pass/fail 数量。

- [ ] **Step 4: 构建前端并刷新受跟踪的 `dist`**

Run:

```bash
npm run build
```

Expected: exit code 0，Vite 输出新的 `dist/assets` 文件清单。

- [ ] **Step 5: 重新运行产物敏感测试**

Run:

```bash
npx tsx --test backend/tests/frontendAssets.test.ts backend/tests/dockerBuildConfig.test.ts backend/tests/nginxConfig.test.ts backend/tests/publicPageRoutes.test.ts
```

Expected: PASS，failed 数量为 0。

- [ ] **Step 6: 检查最终差异和重复 URL 约束**

Run:

```bash
git diff --check
git status --short
rg -n "/deals/.*campaign|/deals/\\$\\{.*campaign|buildAirportDealDetailPath" shared src backend nginx.conf
```

Expected: `git diff --check` exit code 0；不存在以 `campaign_id` 生成详情 URL 的代码；业务代码、测试和构建产物都在预期列表内。

- [ ] **Step 7: 提交构建产物和最终修正**

```bash
git add dist shared src backend nginx.conf
git commit -m "build: refresh airport deal detail assets"
```

- [ ] **Step 8: 部署后进行公网只读验收**

部署不属于本计划的自动执行范围。生产镜像完成并由用户授权部署后，运行：

```bash
curl -sS -I --connect-timeout 10 https://gate-rank.com/deals/elphantroute
curl -sS --connect-timeout 10 https://gate-rank.com/deals/elphantroute | rg '<title>|<h1>|canonical|大象网络|ABIDTEF|application/ld\\+json'
curl -sS --connect-timeout 10 https://gate-rank.com/sitemap.xml | rg -c '<loc>https://gate-rank.com/deals/elphantroute</loc>'
```

Expected:

- 详情页返回 `200`。
- 原始 HTML 包含“大象网络优惠码”、自引用 canonical、全部当前有效活动和 JSON-LD。
- sitemap 中 `/deals/elphantroute` 的计数严格为 `1`。
- 如同一机场有两个活动，HTML 同时包含两个优惠码，但不存在第二个机场详情 URL。
