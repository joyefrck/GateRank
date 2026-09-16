# News 与 iOS 下载标题修复计划

目标：落实用户指定的 News H2/H3 层级，并确保下载页提供 iOS 官方下载区块。
方案：沿用现有版式。News 文章标题统一 H3，首页结构为精选文章、专题、最新文章、机场月度报告、科学上网教程；后两项复用现有报告和教程入口。下载页共享 iOS 官方入口目录，按已有 iOS 工具去重；不依赖后台安装包数量。SSR 与 React 同步输出。

- [x] 在 newsPublicRoutes.test.ts 和 publicPageRoutes.test.ts 复现文章 H2、无 iOS 数据时区块缺失。
- [x] 修改 newsPageRenderer.ts 的头条、列表、侧栏标题及首页栏目。
- [x] shared/toolDownloads.ts 定义 iOS 官方入口与缺失入口筛选；publicPageRenderer.ts、src/App.tsx 接入并对齐下载说明 H2/H3。
- [x] 验证空列表、已有 iOS 工具、平台过滤、文章标题与栏目层级。
- [x] 运行相关测试、前后端类型检查、隔离目录生产构建；浏览器检查桌面与手机宽度。

范围：当前分支修复并提交 GitHub；保留工作区已有改动，生产部署不在本次范围。

最终实现：六款 iOS 应用直达 App Store，使用对应的站内图标资源；下载主按钮复用 macOS 样式；iOS 标题旁补充非中国大陆 Apple ID 提示和生产 News 注册教程链接。

验证结果：95 项相关测试通过；前后端 TypeScript 检查通过；生产构建通过。Chrome 检查了 SSR 与前端接管后的标题、App Store 链接、图标加载、下载主按钮样式，以及手机 390px 和桌面布局；生产教程页面返回成功且标题、canonical 匹配。
