# 独立 SEO 专题

入口：`/admin/topics`。专题拥有独立数据，不属于 News 分类或新闻专题。

## 编辑与发布

- 使用大尺寸单栏 Markdown 正文编辑器，工具栏可插入图片、表格、链接和标题。“上传图片”会选择本地 jpg、png、webp、gif 或 avif 文件，等比例缩放到最大宽度 1200px（不放大小图）、转换为 WebP，上传到本站 `/uploads/news` 并在当前光标处插入带空行的 Markdown；单张原文件大小沿用 `NEWS_IMAGE_MAX_BYTES`（默认 8 MiB）。公开正文图片按最大 840px 宽度居中展示并保持原始宽高比。
- 机场名单由管理员选择并排序，推荐理由仅用于当前专题。公开数据中已不可见的机场会被排除，后台显示提醒。隐藏评分不会通过专题输出。
- 月付价格只使用机场档案中明确支持月付的 `lowest_monthly_price`；不使用年付折算价格。
- 新建默认为草稿。发布要求正文、SEO Title 和 Description 完整。保存已发布专题立即更新线上内容；下线后公开路径与历史路径均返回 404。
- URL 为规范化的英文站内路径，不允许占用系统命名空间。已公开地址改名后保留 301，所有历史地址直接指向最终地址。未公开草稿改址不保留旧地址。
- 综合入口模板自动列出全部已发布的普通专题。若有多个已发布综合入口，站点“机场推荐”入口使用展示顺序最小的一项，同顺序按 ID。
- 年份为普通编辑内容，不自动滚动。

## 数据与接入

MySQL 表为 `seo_topics`、`seo_topic_paths`、`seo_topic_airports`、`seo_topic_related`。路径唯一索引、事务及外键保证冲突和失败回滚。种子标识独立保存，草稿改址后也不会被重复初始化。

管理 API：`GET/POST /api/v1/admin/topics`、`GET/PUT /api/v1/admin/topics/:id`、`GET /api/v1/admin/topics/:id/preview`、`GET /api/v1/admin/topics/airports`、`POST /api/v1/admin/topics/render`。接口使用现有管理员认证、审计与禁止缓存响应。

公开 API 仅提供 `/api/v1/topics/navigation` 的已发布综合入口地址。专题 HTML 在后端精确查询，Nginx 对未命中其他 location 的路径转发后端，未找到则正常返回 404；开发服务器也代理这类路径。专题 HTML 不加载 React 入口。导航中的专题链接为普通锚点。

所有专题及 sitemap 使用 `no-store`，公开导航占位由请求时的发布状态填入，React 导航独立读取同一个公开入口 API。管理保存清理现有公开页面缓存。

## 初始化与验证

本地后端启动后运行 `npm run topics:seed`。该命令仅允许本地数据库与本地 API，创建 5 个完整草稿；重复执行不会覆盖已有专题。候选机场来自本地公开榜单和机场档案，数据不足时允许少于 5 个。

验证命令：

```sh
TOPIC_TEST_MYSQL=1 npx tsx --test backend/tests/seoTopics.test.ts backend/tests/seoTopicRepository.integration.test.ts backend/tests/nginxConfig.test.ts
npm run lint
npm run server:typecheck
npm run test:backend
npm run build -- --outDir /tmp/gaterank-topics-build --emptyOutDir
```

MySQL 集成测试在本地新建临时数据库，验证事务回滚、路径冲突与并发、历史跳转目标、关联顺序、月付口径、重复种子和管理员内容保留，结束后删除该测试库。普通后端测试不启用 MySQL 集成测试。

浏览器验收：桌面及 390px 手机视口下检查后台字段、未保存提示、正文编辑器与专题模板。首批草稿保持未发布。生产上线需 API 与 Web 一起更新，应用最新 Nginx 配置后再由管理员审核发布。
