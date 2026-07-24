# GateRank IP 检测迁移设计

## 背景

`https://ipcha.org/` 当前由生产服务器 `8.217.193.194` 上的独立
Next.js 16 容器 `ip-check` 提供服务。源码位于
`/opt/1panel/apps/ip-check`，线上版本为提交 `2ee0dc5`。该应用没有数据库，
主要能力是：

- 自动识别访问者出口 IP；
- 查询 IPv4、IPv6 或域名；
- 展示国家/地区、城市、邮编、经纬度、时区、ISP、组织和 ASN；
- 使用 Leaflet 与 CARTO Voyager 展示地图；
- 提供中英文切换、复制字段和 ElephantRoute VPN 横幅。

GateRank 已经预留 `/tools/ip-check`，但当前仅渲染“即将上线”占位页。
本次迁移将旧站能力原生整合进 GateRank，并在新页面生产验收通过后停止旧站。

## 已批准决策

- 新页面固定使用 `https://gate-rank.com/tools/ip-check`。
- 页面外壳参考 `/tools/streaming-check`：使用 GateRank 导航、SSR、SEO 和页脚。
- 工具主体保留旧站的紫色视觉、查询交互、地图、双语、复制和 VPN 横幅。
- 采用 GateRank 原生 React/Vite/Express 实现，不保留独立 Next.js 子应用或 iframe。
- IP 数据源使用 ip-api Pro，API Key 仅注入 GateRank 后端。
- `ipcha.org` 下线后不跳转，HTTP 与 HTTPS 均固定返回 `410 Gone`。
- 不立即删除旧源码、镜像、证书和配置备份，以便短期回滚。

## 目标

1. 在 GateRank 工具模块完整提供旧站的可见功能和视觉体验。
2. 复用 GateRank 的公共导航、SSR、SEO、错误格式、限流和部署链路。
3. 隐藏商业 API 密钥，不在 GateRank 数据库或业务日志中保存查询历史。
4. 在新页面完成生产验收后安全停止旧容器，不影响 GateRank 其他页面和 API。
5. 保留可验证、可快速恢复的旧站回滚材料。

## 非目标

- 不保留旧站 Next.js 运行时或独立发布流程。
- 不建立 IP 查询历史、分享链接、后台管理页或查询统计表。
- 不增加 VPN/代理/Tor 检测字段；页面继续呈现旧站已有字段。
- 不迁移旧站独立 Google Analytics。
- 不迁移旧站缺乏事实依据的 `4.8/1000` 聚合评分结构化数据。
- 不把 `ipcha.org` 重定向到 GateRank。

## 系统边界

### 前端

新增聚焦的 `IPCheckPage` 页面模块，负责：

- 首次进入时自动检测当前出口 IP；
- 接受 IPv4、IPv6 或域名；
- 展示加载、成功、输入错误、限流、超时和服务错误状态；
- 渲染地图、信息卡片、复制反馈、中英文切换和 VPN 横幅；
- 保留手动查询文本，不使用解析出的 IP 覆盖用户输入。

页面使用 `PageFrame active="tools"`。GateRank 导航和页脚保持中文，IP 检测主体
在中文和英文之间切换。SSR 首屏渲染页面结构与等待状态，个性化 IP 数据只在
浏览器加载后请求。

### 共享契约

共享模块定义稳定的 API 请求、响应、翻译和展示类型，避免前后端直接依赖
ip-api Pro 的字段名。

标准成功响应字段：

| 字段 | 含义 |
| --- | --- |
| `ip` | 查询或解析后的公网 IP |
| `country` | 国家或地区名称 |
| `country_code` | ISO 3166-1 alpha-2 国家代码 |
| `region` | 州或省代码 |
| `region_name` | 州或省名称 |
| `city` | 城市 |
| `postal_code` | 邮编 |
| `latitude` | 纬度 |
| `longitude` | 经度 |
| `timezone` | IANA 时区 |
| `isp` | ISP 名称 |
| `organization` | 组织名称 |
| `asn` | ASN 与组织描述 |

空缺字段标准化为空字符串；经纬度必须是有限数值，否则整个上游响应视为无效。

### 后端路由

新增：

```text
POST /api/v1/tools/ip-check
Content-Type: application/json

{ "query": "8.8.8.8" }
```

`query` 可省略。省略时，后端使用 GateRank 已有的可信代理解析顺序读取访问者 IP：

1. `CF-Connecting-IP`
2. `X-Forwarded-For` 的第一项
3. `X-Real-IP`
4. Express `req.ip`

如果生产请求仍无法得到公网 IP，响应返回可识别错误；浏览器随后可以使用
`https://api64.ipify.org?format=json` 获取当前出口 IP，再作为普通查询提交给
GateRank。手动输入查询始终只提交 GateRank 后端。

### ip-api Pro 适配器

新增 `IpGeolocationProvider` 接口和 ip-api Pro 实现。上游请求使用：

```text
https://pro.ip-api.com/json/{query}
```

请求参数包含 API Key 和精确字段列表。运行时配置：

```text
IP_API_PRO_KEY=<secret>
IP_API_PRO_BASE_URL=https://pro.ip-api.com
IP_CHECK_UPSTREAM_TIMEOUT_MS=5000
IP_CHECK_RATE_WINDOW_MS=60000
IP_CHECK_RATE_MAX=10
```

`IP_API_PRO_KEY` 不允许使用 `VITE_` 前缀，不进入前端产物、响应或日志。生产可在
ip-api Pro 控制台将 Key 限制为 GateRank 服务器出口 IP。

适配器使用 `AbortController` 执行 5 秒超时。日志不得输出含 Key 的完整请求 URL。
供应商错误被转换为 GateRank 稳定错误码，前端不直接展示供应商原始错误。

## 输入验证

- 去除首尾空白后长度必须在 1 到 253 个字符之间。
- IPv4 和 IPv6 使用 Node.js `net.isIP()` 判断。
- 域名使用 `domainToASCII()` 规范化，拒绝空标签、端口、路径、协议和无效标签。
- 拒绝回环、链路本地、私网、文档保留、组播、未指定地址和其他非公网 IP。
- 拒绝 `localhost`、`.local` 及单标签主机名。
- GateRank 不主动连接用户提交的域名；域名仅作为字符串提交给 ip-api Pro，避免
  形成 SSRF 通道。

## 数据流

### 自动检测

1. SSR 返回 GateRank 页面外壳和等待状态。
2. React 启动后向 `/api/v1/tools/ip-check` 发送无 `query` 的 POST。
3. GateRank 从可信代理头解析公网 IP。
4. ip-api Pro 返回地理与网络信息。
5. 适配器转换为共享响应，前端渲染地图和字段。
6. 如果服务端无法确定公网 IP，浏览器通过 ipify 获取 IP 后重试一次。

### 手动查询

1. 用户输入 IPv4、IPv6 或域名并提交。
2. 前端执行基础验证，后端再次执行完整验证。
3. GateRank 后端调用 ip-api Pro。
4. 成功时更新地图和信息卡片；搜索框继续显示用户原始输入。

## 页面设计

### 桌面端

- GateRank 顶部导航与流媒体检测页保持一致。
- 主体使用旧站的深色紫色渐变背景和装饰光晕。
- 标题、说明、双语切换和搜索栏位于工具主体顶部。
- 结果区域使用五列网格：地图占三列，信息面板占两列。
- VPN 横幅位于结果下方，GateRank 页脚位于工具主体之后。

### 移动端

- 使用 GateRank 现有移动导航。
- 搜索输入和按钮纵向排列，按钮占满可用宽度。
- 地图、主要信息卡片、详细信息和 VPN 横幅依次纵向排列。
- 地图保持可操作且不产生横向溢出。
- 复制按钮必须可通过键盘和触控访问，不能只依赖 hover。

### 地图

- 使用 Leaflet 动态加载，避免 SSR 访问浏览器对象。
- 使用 CARTO Voyager 瓦片。
- 保留 OpenStreetMap 与 CARTO attribution。
- 查询变化时销毁旧实例并创建新实例，页面卸载时清理地图。
- 地图失败不阻止文本结果显示；地图区域单独显示可恢复错误。

### SEO 与导航

- 将 `/tools/ip-check` 加入前端构建 sitemap 和后端动态 sitemap。
- canonical 固定为 `https://gate-rank.com/tools/ip-check`。
- 添加 WebApplication、BreadcrumbList 和 FAQPage JSON-LD。
- 添加 GateRank IP 检测 Open Graph 图片映射。
- 从公共导航中移除 IP 检测的“即将上线”徽标。
- 将页面纳入 GateRank 的机器可读页面与工具导航清单。
- SSR HTML 必须包含有效 H1、说明、等待状态、导航和页脚。

## 隐私

GateRank 不将查询或结果写入数据库、业务日志、分析事件或持久缓存。响应设置：

```text
Cache-Control: private, no-store
Pragma: no-cache
```

服务端日志只记录：

- request ID；
- 总耗时和上游耗时；
- HTTP 状态；
- GateRank 错误类别。

页面隐私说明应明确区分 GateRank 与供应商：GateRank 不保存查询历史，但
ip-api Pro 会处理查询 IP 或域名。根据供应商当前政策，其故障排查访问日志可能
保留最多 24 小时。该事实不能被“不会保存 IP”之类的绝对文案掩盖。

## 限流与错误

每个访问者默认每 60 秒最多 10 次请求，使用 `express-rate-limit` 和
`ipKeyGenerator(resolveVisitorIp(req))`。

| HTTP 状态 | 错误码 | 场景 |
| --- | --- | --- |
| `400` | `IP_CHECK_INVALID_QUERY` | 输入为空、格式错误或不是公网目标 |
| `422` | `IP_CHECK_LOOKUP_FAILED` | 上游无法解析合法 IP 或域名 |
| `429` | `IP_CHECK_RATE_LIMITED` | 访问者超过查询频率 |
| `502` | `IP_CHECK_UPSTREAM_ERROR` | 上游协议、状态或响应无效 |
| `503` | `IP_CHECK_NOT_CONFIGURED` | 生产环境缺少 API Key |
| `504` | `IP_CHECK_UPSTREAM_TIMEOUT` | 上游超过超时时间 |

所有错误使用 GateRank 现有 `sendError` 结构。前端提供对应中英文消息和重试按钮，
不展示栈信息、API Key 或供应商原始正文。

## 测试策略

### 共享与后端测试

- IPv4、IPv6、IDN/ASCII 域名规范化。
- URL、端口、路径、单标签域名、私网、回环和保留地址拒绝。
- ip-api Pro 成功字段映射和缺失字段处理。
- 上游失败、无效 JSON、无效坐标、超时和缺少 Key。
- 当前访客 IP 的 Cloudflare、Nginx 和 Express 解析顺序。
- 路由成功响应、`private, no-store`、标准错误和 10 次/分钟限流。
- 日志结构不包含查询值或 API Key。

### SSR 与前端测试

- SSR HTML 包含页面标题、导航、页脚、canonical、JSON-LD 和等待状态。
- 公共导航不再显示“即将上线”。
- sitemap、Nginx 和机器可读清单包含 `/tools/ip-check`。
- 前端状态转换覆盖自动检测、ipify 回退、手动查询、重试和语言切换。
- 手动域名查询后输入框不被解析 IP 覆盖。
- 地图错误与文本结果相互隔离。

### 发布前命令

执行项目现有的前端类型检查、后端类型检查、生产构建和后端完整测试；新增聚焦测试
必须单独通过。现有无关的类型检查或生成产物债务不得被本任务静默改写。

## 生产发布

### 第一阶段：GateRank 上线

1. 在 `gaterank-api` 生产环境配置 `IP_API_PRO_KEY`，并限制 Key 的调用来源。
2. 发布新的 `gaterank-web` 和 `gaterank-api` 镜像。
3. 验证容器健康、SSR 页面、API 和静态资源。
4. 验证当前出口 IP、`8.8.8.8`、一个 IPv6 地址和一个域名。
5. 验证地图、复制、中英文、移动端、限流、错误和隐私响应头。
6. 回归首页、排行榜、流媒体检测、下载页和 `/api/v1`。

旧站在第一阶段保持运行。

### 第二阶段：旧站下线

仅在第一阶段全部通过后执行：

1. 记录旧站 Git 提交 `2ee0dc5`、Compose 路径、镜像摘要和容器健康状态。
2. 备份 `/opt/1panel/apps/ip-check/docker-compose.yml`、
   `/opt/1panel/www/conf.d/ipcha.org.conf` 和站点代理配置。
3. 停止 `ip-check` 容器，不删除镜像与源码。
4. 确认主机 3000 端口不再监听。
5. 将 `ipcha.org` 的 HTTP/HTTPS server block 改为固定返回 `410 Gone`。
6. 校验 OpenResty 配置后平滑重载，不重启 GateRank 容器。
7. 验证 `http://ipcha.org/` 和 `https://ipcha.org/` 均返回 `410`，且没有
   `Location` 重定向头。
8. 再次验证 GateRank 首页、IP 检测、流媒体检测和 API。

Cloudflare DNS 和 TLS 可以暂时保留，使访问者得到明确、可控的 `410`，而不是
Cloudflare 错误页。旧站页面和应用已不可访问，且没有跳转。

## 回滚

如果 GateRank IP 检测在旧站停止后出现生产故障：

1. 恢复备份的 `ipcha.org` Nginx 代理配置。
2. 使用原 Compose 与镜像重新启动 `ip-check`。
3. 验证容器健康、3000 端口和旧站查询。
4. 校验并平滑重载 OpenResty。
5. 在 GateRank 导航中临时恢复“即将上线”或关闭新入口。

回滚不要求重建旧镜像或恢复数据库。

## 验收标准

- `/tools/ip-check` 在桌面与移动端使用 GateRank 外壳并呈现旧站核心视觉。
- 自动检测和 IPv4、IPv6、域名查询均可用。
- 所有旧站可见字段、地图、复制和中英文切换正常。
- API Key 不出现在前端、日志、响应或 Git 历史。
- GateRank 不持久保存查询 IP、域名或结果。
- SSR、canonical、JSON-LD、sitemap、导航和机器可读入口正确。
- 聚焦测试、完整后端测试、前后端类型检查和生产构建通过，或明确区分已有债务。
- GateRank 生产回归通过后，旧容器停止且 3000 端口关闭。
- `ipcha.org` HTTP/HTTPS 均返回 `410 Gone`，不重定向。
- 回滚材料完整且恢复步骤经过配置层验证。
