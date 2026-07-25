# GateRank 定时日志维护设计

## 目标

将 GateRank 生产日志策略纳入仓库，提供可重复安装、可验证、可回滚的宿主机维护能力，避免 OpenResty 或 Docker 日志再次占满 50GB 根盘。

## 边界

- 管理 `/opt/1panel/www/sites/gaterank/log/access.log`、`error.log`。
- 管理 `gaterank-web`、`gaterank-api` 的 Docker `json-file` 参数。
- 不清理 MySQL binlog、上传文件、镜像、构建缓存、journal 或其他业务日志。
- 不增加数据库、HTTP API、管理后台或外部告警凭证。

## 架构

`scripts/gaterank-log-maintenance.sh` 是唯一运维入口，提供 `install`、`check`、`run`、`uninstall` 和 `install --dry-run`。安装程序将仓库模板原子写入宿主机，使用独立 systemd timer 每小时执行 `run`。

OpenResty 日志使用专用 logrotate 配置和状态文件，达到 100MB 时轮转，保留 14 份并压缩。Web/API 容器通过 Compose override 使用 Docker 原生 `json-file max-size=100m max-file=3`；禁止从宿主机截断 Docker JSON 日志。

## 安全与失败行为

- 安装前验证 root 权限、固定生产路径、Compose 服务名、模板和依赖命令。
- 未知或无管理标记的配置一律拒绝覆盖/删除；已知旧 GateRank logrotate 规则迁入时间戳备份。
- Compose override 写入前执行合并配置校验；安装后只重建 Web/API。
- 容器、日志读取或 HTTP 健康检查失败时恢复旧配置并再次重建回滚。
- 每小时任务使用独占锁；锁忙时记录跳过并返回成功。
- 轮转后磁盘仍达到 80%，或 Docker 参数漂移时返回运行失败；仅写入 journal，不扩大清理范围。

## 验收

自动测试覆盖 dry-run 零写入、幂等安装、冲突拒绝、并发锁、磁盘阈值、配置漂移、回滚和卸载所有权。生产验收要求 timer 启用、7 个容器运行、Web/API 轮转参数生效、`docker logs --tail` 可用、本机和公网接口正常，并在 24 小时后复查磁盘与任务记录。
