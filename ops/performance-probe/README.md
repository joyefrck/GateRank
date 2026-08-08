# GateRank 大陆性能探针部署

本目录用于上海、广州 Debian 12 探针。每台主机只使用自己的 bearer token，服务以锁定的 `gaterank-probe` 非 root 用户运行；安装不会自动启用定时器。

## 1. 上线前检查

1. 先验证 SSH 密钥登录可独立成功，并保留一个已登录的恢复会话。只有密钥登录验证完成后，才能轮换或关闭密码登录。
2. 检查 Debian 12、磁盘、内存、时间同步和到 `https://gate-rank.com` 的 HTTPS 连通性。
3. 后端必须已部署 restricted probe API，并完成数据库 schema 初始化。
4. 在仓库根目录执行测试：

   ```bash
   npx tsx --test backend/tests/performanceProbeOps.test.ts
   bash -n ops/performance-probe/install.sh
   ```

## 2. 一次性签发 token

在 GateRank 后端主机的仓库目录执行。命令不接收 token 参数，只把新 token 输出一次：

```bash
PROBE_ID=cn-shanghai PROBE_ACTION=issue-token npx tsx scripts/manage_performance_probe.ts
PROBE_ID=cn-guangzhou PROBE_ACTION=issue-token npx tsx scripts/manage_performance_probe.ts
```

不要把输出粘贴到聊天、命令行参数、仓库文件或工单。直接把对应值写入目标主机的 `/etc/gaterank-probe.env`。

## 3. 安装但不启用定时器

将仓库中的 `ops/performance-probe`、`scripts/performance_probe_runner.py` 和 `scripts/monitor_performance.py` 保持原相对目录复制到探针主机，然后执行：

```bash
sudo bash ops/performance-probe/install.sh
sudo install -o gaterank-probe -g gaterank-probe -m 0600 \
  ops/performance-probe/gaterank-probe.env.example /etc/gaterank-probe.env
sudoedit /etc/gaterank-probe.env
```

为每台主机填写独立 `PROBE_API_TOKEN` 和唯一 `PROBE_WORKER_ID`。确认权限与 unit：

```bash
sudo stat -c '%U %G %a %n' /etc/gaterank-probe.env
sudo systemd-analyze verify /etc/systemd/system/gaterank-probe.service /etc/systemd/system/gaterank-probe.timer
sudo systemctl is-enabled gaterank-probe.timer || true
```

预期环境文件为 `gaterank-probe gaterank-probe 600`，timer 为 disabled。

## 4. 空队列试运行与日志脱敏检查

后端未给该机场启用大陆测试时，先启用探针全局状态，再做一次空队列执行：

```bash
PROBE_ID=cn-shanghai PROBE_ACTION=enable npx tsx scripts/manage_performance_probe.ts
sudo systemctl start gaterank-probe.service
sudo systemctl status gaterank-probe.service --no-pager
sudo journalctl -u gaterank-probe.service --since '10 minutes ago' --no-pager
```

输出应为 `idle`，日志不得出现 bearer token、订阅地址、节点密码、完整节点 URI 或数据库凭据。确认后才启用轮询：

```bash
sudo systemctl enable --now gaterank-probe.timer
sudo systemctl list-timers gaterank-probe.timer --all
```

## 5. token 轮换

1. 停止目标主机 timer：`sudo systemctl disable --now gaterank-probe.timer`。
2. 在后端用相同 `PROBE_ID` 再执行 `PROBE_ACTION=issue-token`。
3. 用 `sudoedit /etc/gaterank-probe.env` 替换值，保持 owner 和 `0600`。
4. 手动启动 service 验证，再执行 `sudo systemctl enable --now gaterank-probe.timer`。
5. 新 token 写入数据库时旧 token 已立即失效，无需保留旧值。

## 6. 停用、撤销与回滚

先停止远端工作，再关闭后端探针状态：

```bash
sudo systemctl disable --now gaterank-probe.timer
PROBE_ID=cn-shanghai PROBE_ACTION=disable npx tsx scripts/manage_performance_probe.ts
PROBE_ID=cn-shanghai PROBE_ACTION=revoke-token npx tsx scripts/manage_performance_probe.ts
```

机场配置回滚为大陆地区 `test_enabled=false`、`include_in_result=false`，旧中心保持 `true/true`。该操作不会改写历史报告。

如需完整移除，先确认 timer 已停止、token 已撤销，再执行：

```bash
sudo systemctl disable --now gaterank-probe.timer
sudo rm -f /etc/systemd/system/gaterank-probe.service /etc/systemd/system/gaterank-probe.timer
sudo systemctl daemon-reload
sudo rm -f /etc/gaterank-probe.env /etc/gaterank-probe.env.example
sudo rm -rf /opt/gaterank-probe
sudo userdel gaterank-probe
```

保留 `/var/lib/gaterank-probe` 直到确认不再需要本机运行证据，再按运维保留策略处理。不要用未解析变量或宽泛路径执行递归删除。
