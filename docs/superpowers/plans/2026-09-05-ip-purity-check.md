# IP Purity Check Implementation Plan

**Goal:** 新增真实数据驱动的 IP 纯净度检测和可管理 SEO。

**Architecture:** shared 契约与 SEO 构造函数；独立后端风险服务及设置服务；公共与管理路由接入现有鉴权；React 页面与服务端静态页面使用相同文案和设置。

**Tech Stack:** TypeScript、Express、React、现有 MySQL settings、Node test、Vite。

## 1. 契约、服务和测试
- [x] 创建 `shared/ipPurity.ts`：结果、空值语义、默认 SEO、FAQ 和共享 SEO 构造器。
- [x] 创建 `backend/src/services/ipPurityService.ts`：并行读取基础地理信息及风险，公网输入验证、1 小时缓存、100 次默认日预算、5 秒超时、不记录目标。
- [x] 创建 `backend/src/services/ipPuritySettingsService.ts`：复用 SystemSettingRepository 的 getByKey/upsert，验证字段长度和分享图路径。
- [x] 用 `npx tsx --test backend/tests/ipPurity*.test.ts` 验证失败路径和契约。

## 2. 路由和 SEO
- [x] 添加 POST `/api/v1/tools/ip-purity-check`、GET `/api/v1/tools/ip-purity-page` 及管理员 GET/PATCH `/api/v1/admin/tools/ip-purity-page`。
- [x] `backend/src/app.ts` 注入服务，SSR `/tools/ip-purity-check` 读取设置并注入配置；不包含查询结果。
- [x] 更新 `shared/publicTools.ts`、`shared/publicSeo.ts`、站点地图及 `src/App.tsx` 路由。验证 canonical、结构化数据和恶意 SEO 字符转义。

## 3. 页面和管理
- [x] 创建 `src/pages/ipPurity/IpPurityPage.tsx`：自动/手动查询、加载/错误/部分结果、风险仪表、依据和隐私说明、FAQ。
- [x] 创建 `src/admin/IpPurityAdminPage.tsx` 并注册管理导航；API Key 只通过服务器环境变量管理。
- [x] 默认 OG 使用现有工具分享图；可配置独立 HTTPS 或站内图片。

## 4. 验证
- [x] `npm run test:backend`、`npm run lint`、`npm run server:typecheck`、`npm run build`，区分已有问题。
- [x] Chrome 验证真实查询、错误恢复、导航、桌面与移动端；验证 SSR 和客户端 SEO 一致。
- [x] 记录运行方法、免费额度和部署环境变量。保留工作区已有改动，不自动提交和发布。

## 5. 原生 IP 数据接入（用户追加要求）
- [x] 核实 IPOK nativeType 与 RIPE NCC RIR lod=2 实际响应、限额及引用要求。
- [x] 新建 shared/nativeIp.ts 和 backend/src/services/nativeIpService.ts，保留来源、网段、注册国、时间、缓存及失败状态；接入原有并行检测。
- [x] 更新 React/SSR/FAQ 隐私说明；用 backend/tests/nativeIp.test.ts 覆盖直接标签、倾向、冲突、IPv6 网段、缓存、配额和独立降级。
- [x] 全量测试、类型检查与生产构建通过；真实 AT&T 样本验证注册国家 US 与定位国家 US 一致。

## 2026-09-05 历史记录调整

用户指定删除风险评分卡、检测依据、共享人数；保留网络档案和原生标签。
- [x] 增加 `IpHistoryService`，并行读取 RIPE routing-history、whois、allocation-history；响应独立降级，限制并发、缓存及条数，验证网段包含目标 IP。
- [x] 接入查询响应；表格显示 ASN 历史、企业登记记录、注册地历史。WHOIS 非完整企业历史，日期按实际字段命名。
- [x] 执行 `npx tsx --test backend/tests/ipHistoryService.test.ts backend/tests/ipPurity*.test.ts backend/tests/nativeIp.test.ts`、类型检查、构建、真实 API 与浏览器验收。
