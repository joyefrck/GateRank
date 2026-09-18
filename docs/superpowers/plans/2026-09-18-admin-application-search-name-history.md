# 入驻申请 ID 搜索与机场名称历史

目标：复用入驻申请搜索框支持申请 ID，并在机场基本信息旁展示持久化名称历史。

实现：数字关键词兼容现有文本查询，`#136` 精确查询申请 ID；保留审核、支付状态与分页。机场名称变化由仓储层使用行锁和事务记录旧名称、新名称及数据库时间，原名称不变不记历史。后台新增只读历史接口，名称旁的次要按钮打开原生模态对话框，倒序展示记录、加载、失败重试和空状态。历史从启用后累积，不虚构已有改名时间。

技术：React / TypeScript、Express、MySQL；复用后台 apiFetch、日期格式与中性配色。

- [x] 在 airportApplicationRepository.test.ts 覆盖纯数字、井号 ID、普通关键词、状态筛选及分页查询。
- [x] 在 airportRepository.test.ts 覆盖改名、未改名、写入失败回滚、机场不存在以及历史读取；adminRoutes.test.ts 覆盖历史接口。
- [x] 修改 airportApplicationRepository.ts 与 AdminApp.tsx 的搜索提示。
- [x] 在 airportRepository.ts 和 backend/sql/schema.sql 定义历史表，同事务保存改名与历史；shared/airportNameHistory.ts 定义返回类型。
- [x] 在 adminRoutes.ts 添加 GET /airports/:id/name-history；在独立 AirportNameHistoryButton.tsx 实现查看入口，并接入现有名称表单。
- [x] 运行定向测试、前后端类型检查、隔离目录构建及 Chrome 桌面/移动预览；检查差异，保留已有工作区更改。

范围：当前 main 分支实现，不包含提交、推送或生产部署。

验证结果：新增回归在实现前 8 项失败，实现后定向 132 项通过。全量后端 1,087 项，其中 1,082 通过、5 跳过、0 失败；npm run lint、npm run server:typecheck、隔离目录 Vite 构建及 git diff --check 通过。Chrome 使用本地隔离模拟 API 验证实际生产构建界面：数字与 #ID 查询、回车/按钮提交、改名保存后查看原名称和修改后名称及北京时间、错误重试、空状态、Escape 关闭与焦点归还；桌面及 390px 手机布局检查通过。仓储事务由单元测试模拟连接验证，未对真实数据库执行迁移或改名；未提交、推送或部署。
