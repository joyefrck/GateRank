# 首页指定轮换名单 Implementation Plan

**Goal:** 让管理员选择机场参与首页公平轮换，并将大象网络加入配置。

**Architecture:** marketing_billing 保存 home_rotation_airport_ids。管理接口验证并提供精简机场选项，首页服务将配置传入轮换服务，按上架状态合并候选。

**Tech Stack:** React、TypeScript、Express、MySQL、node:test。

- [x] 配置：修改 marketingSettingsService.ts 与 adminRoutes.ts；接受去重的正整数 ID 数组，空数组清空，省略保留，非法 ID 拒绝，复用审计及首页缓存失效。
- [x] 候选：修改 homeAirportRotationService.ts 与 publicViewService.ts；独立查询指定机场，避免付费 INNER JOIN 排除无钱包机场；仅合并已上架 normal/risk，交给既有公平轮换算法。
- [x] 界面：新增 HomeRotationAirportPicker.tsx，通过精简接口加载机场，搜索、勾选及移除，复用首页展示保存按钮；更新公开规则说明。
- [x] 测试：配置保存/清空/兼容/非法输入，管理 API 传递及审计，首页传递，真实 MySQL 验证无钱包等豁免及下架/停运排除、移除、去重和轮换公平。
- [x] 验收：npm run lint、npm run server:typecheck、针对性测试及生产构建，Chrome 桌面/手机验证；真实 MySQL 验证大象网络初始化；本地现有测试机场验证配置到首页返回（本地无大象网络记录）。

- [x] 新增 backend/src/db/migrations/homeRotationAirportOverrides.ts 并接入 app.ts 启动；解析大象网络唯一真实记录，旧配置初始化，保留现有名单及管理员清空操作。
