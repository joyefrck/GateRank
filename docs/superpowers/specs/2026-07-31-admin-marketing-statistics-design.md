# 系统后台营销统计设计

## 背景与目标

系统管理后台当前以单个“营销模块”菜单承载营销配置。申请人后台已经能够按单条广告投放查看每日曝光、外链点击和点击率，但系统管理员缺少覆盖全部机场和全部历史投放的统一视图。

本次改造保留左侧单个“营销模块”菜单，在模块内增加“营销设置”和“营销统计”两个 Tab。当前配置页面归入“营销设置”；“营销统计”按单条广告投放列出机场、投放位置、申请有效期、状态和累计访问表现，并提供与申请人后台同口径的每日统计弹窗。

## 已确认范围

- 左侧导航仍只显示一个“营销模块”，不拆成两个菜单。
- 模块内部使用“营销设置 / 营销统计”两个 Tab。
- 当前营销配置页面属于“营销设置”。
- 统计以单条 `airport_ad_campaigns` 记录为单位，同一机场的不同投放不能合并。
- 统计覆盖投放中、已到期、已下架的全部历史投放，默认按最新投放倒序。
- 每条投放展示机场名称、投放位置、优惠码、申请有效期、购买月数、状态、累计曝光、累计点击和 CTR。
- “申请有效期”展示 `starts_at` 至 `ends_at`，并同时展示 `purchased_months`。
- 每日统计口径与申请人后台一致，按自然日倒序、每页固定 30 天。
- 首页广告位与活动优惠页继续按同一 `campaign_id` 归属到单条投放；首页投放的指标包含首页广告位与活动优惠页产生的该投放事件，普通优惠活动只包含活动优惠页事件。
- 上线前无法归属到单条投放的事件不回填、不猜算。

## 方案选择

采用“单条广告投放列表 + 共用聚合逻辑 + 管理员每日详情”的方案。

相比按机场汇总，该方案能准确对应每次投放的价格、位置、有效期和统计周期；相比把功能并入现有“访问记录”，它不会将全站 PV/UV 与付费广告效果混为一谈。系统后台与申请人后台共用统计聚合函数，避免同一广告在两个后台出现不同结果。

## 页面结构与路由

保留现有营销设置地址，并新增统计地址：

- `/admin/marketing-settings`：营销设置。
- `/admin/marketing-statistics`：营销统计。

左侧“营销模块”在两个地址下都保持选中。两个页面顶部使用同一个 Tab 组件导航；Tab 使用真实 URL，刷新、直接访问、浏览器前进和后退均能恢复当前页面。

营销统计的筛选和分页也写入 URL 查询参数：

```text
/admin/marketing-statistics?page=1&q=YH&status=active&placement=home_1
```

支持的状态筛选为：

- `all`：全部。
- `active`：投放中。
- `expired`：已到期。
- `canceled`：已下架。

支持的投放位置筛选为：

- `all`：全部。
- `deal`：普通优惠活动。
- `home_1` 至 `home_4`：首页 1 至 4 号位。

页面首次进入使用 `page=1`、全部状态、全部位置和空关键词。修改搜索条件或筛选条件时回到第 1 页；翻页、刷新和历史导航保留筛选状态。

## 列表界面

列表固定每页 20 条，默认按 `airport_ad_campaigns.created_at DESC, id DESC` 排序。搜索匹配机场名称或优惠码。

表格列为：

1. 机场 / 优惠码。
2. 投放位置。
3. 申请有效期。
4. 状态。
5. 累计曝光。
6. 累计点击。
7. CTR。
8. 操作。

投放位置显示规则：

- `home_slot` 为空：显示“普通优惠活动”。
- `home_slot` 为 1 至 4：显示“首页 N 号位”，并以次级文案提示“含活动优惠页”。

申请有效期以北京时间展示开始和结束日期，并在下一行展示“累计 N 个月”。状态按查询时刻计算：数据库状态为 `canceled` 时显示“已下架”；否则 `ends_at` 晚于当前时间显示“投放中”，其余显示“已到期”。

累计指标覆盖该投放的全部可精确统计日期。曝光为零时 CTR 返回 `null`，界面显示 `—`，不显示误导性的 `0%`。

## 每日统计弹窗

每行提供“每日统计”操作。弹窗沿用申请人后台的结构和统计口径，并在标题区额外显示：

- 机场名称。
- 投放位置。
- 优惠码。
- 申请有效期和购买月数。
- 精确统计开始日期。

顶部指标卡显示累计曝光、累计点击和总体 CTR。每日表格显示日期、曝光、点击和 CTR，按日期倒序，每页固定 30 天。切页只刷新每日明细，累计指标保持不变。

`tracking_started_at` 为空时显示“暂无精确访问数据”，不生成虚假的零值日期；存在精确统计起点但某天没有事件时，该天显示真实的曝光 0、点击 0 和 CTR `—`。

## 后端接口

新增管理员投放统计列表接口：

```text
GET /api/v1/admin/marketing/ad-campaigns?page=1&q=&status=all&placement=all
```

服务端固定 `page_size = 20`。响应包含：

```text
items[].campaign_id
items[].airport_id
items[].airport_name
items[].airport_slug
items[].coupon_code
items[].home_slot
items[].starts_at
items[].ends_at
items[].purchased_months
items[].status
items[].tracking_started_on
items[].summary.impressions
items[].summary.clicks
items[].summary.ctr
pagination.page
pagination.page_size
pagination.total
pagination.total_pages
```

列表仓储查询一次完成当前页投放、机场关联和累计指标聚合，避免逐行查询造成 N+1。累计事件只接受当前 `campaign_id`、精确统计起点之后且不晚于投放统计结束日的 `airport_impression` 与 `outbound_click`。

新增管理员单条每日统计接口：

```text
GET /api/v1/admin/marketing/ad-campaigns/:campaignId/stats?page=1
```

`campaignId` 和 `page` 必须是正整数。接口返回机场和投放元数据，以及与申请人接口一致的：

```text
tracking_started_on
summary.impressions
summary.clicks
summary.ctr
daily[].date
daily[].impressions
daily[].clicks
daily[].ctr
pagination.page
pagination.page_size
pagination.total
pagination.total_pages
```

申请人接口继续执行账号、申请和机场归属校验；管理员接口只接受管理员鉴权。两者在完成各自权限查询后调用同一个内部统计聚合函数，统一日期边界、补零、分页和 CTR 计算。

## 数据模型与统计口径

本功能复用现有投放级埋点字段，不新增业务表：

- `marketing_events.campaign_id` 负责将事件归属到单条广告投放。
- `airport_ad_campaigns.tracking_started_at` 负责标记可精确统计的起点。

不以机场 ID、投放位置、链接或日期猜测历史事件归属。统计日期使用 GateRank 当前业务时区。累计和每日明细只统计：

- `event_type = airport_impression`
- `event_type = outbound_click`
- `campaign_id` 等于目标投放 ID
- 日期不早于 `tracking_started_at` 所在自然日
- 日期不晚于当前日期与广告有效统计结束日中的较早者

CTR 统一为 `clicks / impressions`；曝光为零时返回 `null`。

## 加载、空态与错误处理

- 首次加载显示列表骨架或明确的“加载中”。
- 筛选无结果时显示“没有符合条件的投放记录”。
- 列表加载失败时保留 URL 中的筛选和页码，显示错误信息与“重新加载”。
- 打开每日统计弹窗后先显示加载态；失败时保留投放上下文，显示错误信息与“重新加载”。
- 每日明细翻页期间禁用重复翻页操作，不清空顶部累计指标。
- 请求页码超过总页数时，前端使用接口返回的分页信息回到最后一个有效页并同步 URL。

## 组件与职责边界

- `MarketingModuleTabs`：只负责两个 Tab 的展示和导航。
- `MarketingSettingsPage`：保留当前配置读取、编辑和保存职责。
- `MarketingStatisticsPage`：负责 URL 筛选状态、列表加载、分页和打开每日统计。
- `AdminMarketingStatsDialog`：负责单条广告元数据、累计指标、每日明细、分页、空态和重试。
- `AirportAdCampaignRepository`：负责管理员列表查询、权限范围内的目标投放查询，以及申请人/管理员共用的统计聚合。
- 管理员路由：负责参数校验、管理员鉴权和响应映射，不复制聚合 SQL。

不在本功能中拆分其他大型后台页面或重构现有全站“访问记录”。

## 测试与验收

后端聚焦测试覆盖：

- 管理员列表同时返回投放中、已到期和已下架记录，并按最新投放倒序。
- 机场名称、优惠码、首页位置、开始时间、结束时间和购买月数映射正确。
- 关键词、状态、位置和分页筛选正确，固定每页 20 条。
- 累计曝光、累计点击和 CTR 仅聚合目标 `campaign_id` 的精确统计区间。
- 无 `tracking_started_at` 的历史投放返回无精确数据，而非虚假零值。
- 管理员每日统计与申请人每日统计对同一投放返回相同累计值、每日值、补零和分页结果。
- 非法广告 ID 和页码返回 HTTP 400；不存在的投放返回明确的 404 业务错误。
- 申请人统计接口原有归属校验继续生效。

前端聚焦测试覆盖：

- 左侧仍只有一个“营销模块”，两个地址均保持菜单选中。
- Tab 点击、刷新、直接访问和浏览器历史能恢复正确页面。
- 搜索、状态、位置和页码写入 URL，并在条件变化时回到第 1 页。
- 三种状态、普通优惠活动和首页位置文案正确。
- 有效期和累计月数正确展示。
- 每日统计弹窗正确展示管理员额外元数据、累计指标、30 天分页、无数据空态、错误与重试。

完成后运行相关后端测试、相关前端测试、TypeScript 类型检查和生产构建。若仓库存在与本功能无关的既有全量基线问题，应与本次聚焦回归结果分开报告。

## 非目标

- 不修改现有全站“访问记录”的 PV、UV、来源、国家或机场转化统计。
- 不新增 CSV 导出、任意日期范围、渠道拆分、访客明细或定时汇总表。
- 不允许系统管理员在统计页修改、延期、下架或删除广告。
- 不回填无法精确归属到单条广告的历史营销事件。
