# 首页排行榜计费与榜单曝光设计

## 目标

修复新版公开首页排行榜“官网”按钮绕过点击计费的问题，并让主排行榜与四个摘要榜单中的每一个可见机场条目都进入现有营销曝光统计。

## 已确认口径

- 主排行榜“官网”链接必须走 `/api/v1/outbound/airports/:airportId?target=website&placement=home_card`。
- 点击仍通过 `createTrackedOutboundClickHandler()` 写入 `marketing_events`，计费重定向通过 `processOutboundClick()` 写入 `outbound_click_records` 并按实时排名费率扣减钱包；两条记录用途不同，不构成重复扣费。
- 主排行榜中的每一行在至少 45% 可见时记录一次 `airport_impression`。
- 四个摘要榜单中的每一个机场条目在至少 45% 可见时记录一次 `airport_impression`。
- 同一机场在主排行榜和摘要榜单中出现时按展示位置分别统计；同一位置在单次页面生命周期中只统计一次。
- 曝光与点击统一使用现有 `home_card` placement，保持后台“首页卡片”聚合口径，不新增后端枚举或迁移。
- 首页商业合作专区现有 `deal_card` 曝光和点击逻辑保持不变。

## 实现设计

在 `src/pages/home/HomePageV3.tsx` 内增加本页使用的计费链接构造函数。`RankingTableRow` 使用计费链接作为官网 `href`，同时保留首页营销点击处理器，目标 URL 仍传机场真实官网，以便统计展示实际去向。

为主排行榜行和摘要榜单条目增加小型、局部的可见性包装组件。包装组件持有独立 `ref` 并调用现有 `useMarketingImpression()`：

- 主排行榜去重键：`home|ranking|<airportId>`
- 摘要榜单去重键：`home|summary|<sectionKey>|<airportId>`

去重键包含模块或摘要板块，因此相同机场跨模块出现会分别计数。组件继续使用营销模块默认的 45% 可见阈值，不改变全站公共统计行为。

## 错误与安全边界

- 计费排名查询失败时沿用现有服务端行为：请求失败且不扣费，避免使用错误费率。
- 余额不足、重复点击、无钱包等状态继续由现有 `ApplicantBillingRepository.processOutboundClick()` 处理。
- 生产验收不真实点击官网，避免对客户钱包产生测试扣款；只检查生产 DOM 的 `href`、已部署资源中的曝光去重键、API/容器健康。

## 测试与验收

1. 先扩展 `backend/tests/frontendCrawlableLinks.test.ts`，证明旧代码仍使用官网直链且缺少主榜/摘要曝光。
2. 修改首页后让测试通过，断言计费 `href`、点击处理器、主排行榜曝光键、四榜曝光键均存在，并禁止排行榜官网恢复为 `item.website` 直链。
3. 运行首页相关测试、营销事件/计费路由测试、lint、后端类型检查、完整后端测试和前端构建。
4. 推送 `main`，等待 `Publish Docker Images` 完成后，在生产编排目录同时拉取并替换 Web/API。
5. 只读验证首页、健康接口、容器状态、新版资源以及排行榜官网计费链接。

## 回滚

若生产验收失败，回退本次功能提交并重新执行同一镜像发布和 Compose 更新流程。数据库结构和配置不发生变化，因此无需数据库回滚。
