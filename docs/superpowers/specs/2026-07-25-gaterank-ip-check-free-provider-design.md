# GateRank IP 检测免费数据源切换设计

## 背景与决策

GateRank `/tools/ip-check` 已完成 ip-api Pro 适配，但生产服务器没有商业 API
Key。为避免订阅成本，同时保留旧站的城市、经纬度、地图、时区、ISP、组织和 ASN
字段，数据源改为 `ipwho.is` 免费 HTTPS 端点。

选择依据：

- 免费端点允许商业使用；
- 无需注册、API Key 或付款；
- 支持 IPv4、IPv6、域名、城市、经纬度、时区和网络字段；
- 每个调用来源限制 1,000 次/日，且不提供 SLA；
- 免费端点不提供 VPN、代理、Tor 等安全字段，而当前 GateRank 页面也不展示这些字段。

不采用 IPinfo Lite，因为其免费版只提供国家、洲和基本 ASN，会造成城市、地图、
邮编、时区等现有功能缩水。不在本阶段引入 GeoLite2 自托管数据库，以免增加数据库
下载、许可、定期更新和部署维护成本。

## 实现

保留现有 GateRank 后端代理与共享响应契约。`IpGeolocationService` 改为请求：

```text
https://ipwho.is/{query}
```

服务端继续执行公网 IP/域名验证、5 秒超时和标准错误映射。上游字段转换如下：

| GateRank 字段 | ipwho.is 字段 |
| --- | --- |
| `ip` | `ip` |
| `country` | `country` |
| `country_code` | `country_code` |
| `region` | `region_code` |
| `region_name` | `region` |
| `city` | `city` |
| `postal_code` | `postal` |
| `latitude` | `latitude` |
| `longitude` | `longitude` |
| `timezone` | `timezone.id` |
| `isp` | `connection.isp` |
| `organization` | `connection.org` |
| `asn` | `connection.asn`，标准化为 `AS<number>` |

运行时只保留可选的 `IP_CHECK_UPSTREAM_BASE_URL` 和
`IP_CHECK_UPSTREAM_TIMEOUT_MS`，不再要求 `IP_API_PRO_KEY`。

## 配额与缓存

在服务进程内增加有界 TTL 缓存：

- 成功结果缓存 24 小时；
- 最多保存 2,000 个结果，超出时淘汰最早条目；
- 不缓存失败响应；
- 缓存不写磁盘或数据库，进程重启即清空；
- API 响应仍使用 `private, no-store`，浏览器和 CDN 不缓存结果。

该缓存用于减少相同公共 DNS、代理出口和重复手动查询消耗的免费额度。它不保证
1,000 个以上唯一目标/日仍可用。上游返回 HTTP 429 时，转换为现有
`IP_CHECK_RATE_LIMITED`，页面展示明确的稍后重试提示。

## 隐私与页面文案

页面数据源改为 `ipwho.is`，并保留 OpenStreetMap/CARTO 地图署名。隐私文案说明：

- GateRank 不把查询历史写入数据库或业务日志；
- 为节省免费额度，结果会在 API 进程内存中临时缓存最多 24 小时；
- `ipwho.is` 会处理查询目标，其数据处理受供应商政策约束。

SSR、客户端翻译和结构化页面文案必须同步更新，不能继续出现 ip-api Pro。

## 错误与测试

- `success: false` 映射为 `IP_CHECK_LOOKUP_FAILED`；
- HTTP 429 映射为 `IP_CHECK_RATE_LIMITED`；
- 其他非 2xx、无效 JSON 或无效字段映射为 `IP_CHECK_UPSTREAM_ERROR`；
- 超时映射为 `IP_CHECK_UPSTREAM_TIMEOUT`；
- 删除缺少 Key 的 `IP_CHECK_NOT_CONFIGURED` 运行路径，但暂时保留共享错误码以兼容
  已发布前端。

测试覆盖成功字段转换、ASN 标准化、嵌套字段缺失、429、业务失败、无效响应、超时、
缓存命中、缓存过期和文案更新。完成后运行聚焦测试、完整后端测试、lint、构建和
现有服务器类型检查，并明确区分仓库已有的类型债务。

## 发布与下线

新镜像部署后先验证 `/tools/ip-check` 的自动检测、IPv4、IPv6、域名、地图和双语。
确认线上查询可用后，才停止旧 `ip-check` 容器，并将 `ipcha.org` 的 HTTP/HTTPS
站点固定为 `410 Gone`。任何线上验证失败都保持旧站运行。
