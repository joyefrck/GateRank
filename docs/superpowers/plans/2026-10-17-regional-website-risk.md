# 官网风险异地复核实施计划

**Goal:** 中心点异常时以广州、上海的实测页面结果复核，保留全部诊断证据。
**Architecture:** 现有风险服务调用异地任务队列；两地独立 Python worker 使用既有探针 API 身份，独立轮询，不占性能任务。管理页展示各地结果。
**Tech Stack:** TypeScript、Express、MySQL、Python 标准库、systemd。

- [x] 增加风险服务回归用例：中心418/大陆200恢复；全部异常保留失败；无回传不覆盖；中心正常不派发；配置错误不派发。
- [x] 实现异地结果选择、JSON诊断类型及UI展示；运行 `npx tsx --test backend/tests/regionalWebsiteRisk.test.ts`。
- [x] 实现独立队列与认证路由；验证跨探针提交、过期提交、重复提交、字段校验及URL脱敏。
- [x] 实现公网固定地址的 Python 官网探测和独立worker/timer；先运行失败测试，再实现并运行 `python3 -m unittest scripts.test_website_probe_runner`。
- [x] 接入启动schema与风险服务；运行风险/探针相关测试、类型检查、构建。
- [ ] 验证生产访问权限和两地实测，按发布流程备份、发布、安装worker，重测云图。若访问被阻，保留已验证代码并明确生产状态。

验证：后端 1227 通过、8 跳过；Python 8 通过；前后端类型检查与生产构建通过。独立审查反馈的418正文超时、证书来源保留、慢地点证据与判定语义均已修复并复核。生产发布与复测尚待执行。
