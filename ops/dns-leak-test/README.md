# GateRank DNS Leak Test 探针部署

本目录只负责独立权威 DNS 探针。探针必须运行在与 GateRank Web/API 不同的公网 IPv4 主机上，避免将站点源站 IP 暴露为权威 DNS 地址。v1 使用单节点、单 NS；节点不可用时页面会在 8 秒后显示“无法判定”。

## 网络边界

- 入站仅开放 `53/udp` 与 `53/tcp`。
- 出站仅需访问 GateRank API 的 `443/tcp`。
- 不开放管理 API；健康检查在容器内通过 UDP 查询 SOA。
- 容器内以非 root 用户监听 `5353/udp`、`5353/tcp`，由 Docker 映射公网 53。
- 回调必须使用 HTTPS；只有本地开发的 `localhost`/`127.0.0.1` 可使用 HTTP。

## 1. 配置主 API

GateRank API 与 DNS 探针必须使用相同的两个密钥，但两个密钥彼此必须不同：

```dotenv
DNS_LEAK_TEST_ZONE=dns-test.gate-rank.com
DNS_PROBE_SESSION_SECRET=<64_HEX_CHARACTERS>
DNS_PROBE_CALLBACK_SECRET=<A_DIFFERENT_64_HEX_CHARACTERS>
DNS_LEAK_TEST_MAX_SESSIONS=5000
```

分别生成密钥：

```bash
openssl rand -hex 32
openssl rand -hex 32
```

配置缺失或密钥短于 32 个字符时，公开开始接口会明确返回 `503`，而不会生成不可用的测试会话。

## 2. 配置独立 DNS 主机

先确认公网 53 端口未被系统 DNS 服务占用：

```bash
sudo ss -lntup '( sport = :53 )'
```

复制示例环境文件并填写独立主机的公网 IPv4、两个密钥和生产 API 地址：

```bash
cd ops/dns-leak-test
cp .env.example .env
chmod 600 .env
docker compose build
docker compose up -d
docker compose ps
```

查看聚合健康与错误日志：

```bash
docker compose logs --tail=100 gaterank-dns-probe
```

探针日志不会输出完整测试域名或解析器 IP。

## 3. Cloudflare 记录（仅操作说明）

在 Cloudflare 中添加以下记录；两条记录都不能经过 Cloudflare 代理：

| 类型 | 名称 | 内容 | 代理状态 |
| --- | --- | --- | --- |
| A | `ns1.dns-test` | `<DNS_PROBE_PUBLIC_IPV4>` | DNS only |
| NS | `dns-test` | `ns1.dns-test.gate-rank.com` | DNS only |

本仓库不会自动创建或修改这些记录。委派生效后可检查：

```bash
dig +short ns1.dns-test.gate-rank.com A
dig +short dns-test.gate-rank.com NS
dig @<DNS_PROBE_PUBLIC_IPV4> dns-test.gate-rank.com SOA +norecurse
dig @<DNS_PROBE_PUBLIC_IPV4> dns-test.gate-rank.com SOA +tcp +norecurse
```

直连 UDP/TCP 响应都应包含权威应答标志；对 zone 外域名的查询应返回 `REFUSED`，且响应不应宣告递归可用。

## 4. 联调与验收

完成 DNS 委派和 API 配置后：

1. 打开 `/tools/dns-leak-test` 并开始检测。
2. 确认进度从 `1/10` 到 `10/10`，最长约 8 秒。
3. 确认出口 IP、解析器 IP/地区/运营商/ASN 和风险结论出现。
4. 使用浏览器开发者工具确认 `start`、`result` 响应均为 `Cache-Control: private, no-store`。
5. 检查探针只记录计数/错误，不记录完整查询名或解析器 IP。

若递归解析器缓存或浏览器调度导致只观察到部分序号，页面会展示已有证据；没有观察或国家信息不完整时结果保持“无法判定”。

## 回滚

1. 删除 `dns-test` 的 NS 委派，再删除 `ns1.dns-test` A 记录。
2. 在独立主机执行 `docker compose down`。
3. 从主 API 移除三项 DNS Leak Test 配置并重启 API，开始接口将回到明确的 `503` 未配置状态。

会话只存在主 API 进程内，2 分钟后删除；不新增数据库表。IP 地理元数据仍遵循现有服务的内存缓存策略。
