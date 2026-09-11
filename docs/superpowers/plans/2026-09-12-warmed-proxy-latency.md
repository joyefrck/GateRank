# 代理延迟预热与统一采样实施计划

**Goal:** 避免最初请求的连接开销直接进入正式延迟评分，统一中心与地区探针的统计口径。

**Architecture:** 继续通过 sing-box 请求既有 HTTPS 测试目标。每节点固定预热 2 次，随后采样 5 次；正式成功样本至少 3 个才输出中位数。每节点只贡献一个代表值，地区对节点代表值取中位数，现有两地区评分平均保持不变。通过已有 diagnostics JSON 保留预热、正式样本、时间、失败次数和测量版本，不新增数据库字段。

**Tech Stack:** Python unittest、TypeScript node:test、MySQL JSON。

## 设计与边界

- 用户已要求修改上文诊断出的延迟测试逻辑；在当前分支实施。
- 采用预热后中位数：比最小值更能反映持续体验，同时排除最初两次请求。直接改为 TCP Ping 无法测完整代理链路；只放宽评分阈值无法解决初始请求污染，因此不采用。
- 正式采样不足时不给出延迟代表值，也不回退到预热、TCP 或零延迟。保留原有独立请求失败率测试。
- 诊断只保存节点名称/地区及数值，不复制订阅或节点认证配置。
- 发布需要同步中心 API 内脚本与两个独立地区 worker；仅改本地代码不会改变现有生产记录。新数据采用新的测量版本，不改历史记录、评分权重及阈值。

## 执行

- [x] 在 `scripts/test_monitor_performance.py` 添加慢预热排除、正常样本尖峰、失败不足及预热失败后恢复测试；更新中心采集为中位数的预期。
- [x] 在 `scripts/test_performance_probe_runner.py` 添加地区调用同一测量函数、节点等权聚合和诊断上报测试。先运行两组测试确认旧实现失败。
- [x] 修改 `scripts/monitor_performance.py`：预热 2 次、采样 5 次、成功门槛 3；写入传入诊断字典；共享每节点中位数处理；中心输出留存诊断。
- [x] 修改 `scripts/performance_probe_runner.py`：采用相同节点代表值与 diagnostics 协议；每节点保留正式样本，采样失败节点不给低延迟假值。
- [x] 增加后端 diagnostics 透传回归，确认版本和原始证据不会在入库前丢失。
- [x] 运行 Python 性能相关测试、后端地区采集/聚合回归与 `git diff --check`，检查差异仅涉及本任务源码、测试和计划。

验证命令：

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest scripts.test_monitor_performance scripts.test_performance_probe_runner
node --import tsx --test backend/tests/performanceProbeJobService.test.ts backend/tests/performanceRegionScoring.test.ts backend/tests/aggregationService.test.ts
git diff --check
```

## 验证结果

- 旧实现回归：56 项中 2 项失败、4 项错误，覆盖旧最小值及缺少预热证据接口。
- 修改后全部 Python 脚本测试：68/68 通过。
- 地区上报、评分、记录仓储及日聚合回归：26/26 通过；diagnostics 中测量版本和嵌套原始证据完整传入仓储。
- 源码自查确认聚合要求地区延迟为有限数值，缺失延迟不会被 `Number(null)` 当成 0ms 参与评分。
- 本次未发布生产，也未重跑生产测速或重算历史分数。正式发布需同步 API 镜像脚本与上海、广州 worker 的两个 Python 文件，然后用新 run 的 `diagnostics.latency_measurement` 验收。
- 后端 TypeScript 类型检查通过；`git diff --check` 通过。
