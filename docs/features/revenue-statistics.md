# 收入统计

后台入口：营销模块下方的独立菜单 `/admin/revenue`。

## 口径

经营收入 = 成功支付入驻订单 + 点击实际扣费 + 广告购买、续费实际扣费。
实际收款 = 成功支付入驻订单 + 成功充值订单。两者不能相加。

后台手动加款、钱包 adjustment、人工标记付款、未成功支付订单不进入任一口径及其明细。
统计按记录类型排除手动加款，沿用确认方案统计后续实际业务扣费；本功能不对钱包余额进行资金来源拆分。
广告按每笔扣费发生时计入，不读取广告累计 billed_amount，也不按投放月份摊销。
系统人民币金额转换为整数分聚合，前端统一展示两位小数。支付渠道不代表另一种金额币种。

时间使用现有数据库的北京时间 DATETIME 约定。支付订单以 paid_at、扣费流水以 created_at 为准，范围为开始日零点至结束日次日零点（不含）。周一为周起点，跨边界的周/月只计筛选范围内交易。上期为紧邻的相同天数区间；含今日时今日数据尚未完整。
缺失付款时间的成功订单不推测日期，概览提示当前机场范围内全部历史缺失数量。

按记录机场 ID 优先关联，缺失时通过申请/钱包补充；尚未关联机场的付费申请和历史下架机场均保留。
点击缺失关联归入未知位置；已关联且标明免费/重复等非 billed 状态的点击不计入。
历史广告流水没有可靠 campaign ID，首版不按广告位置分收入，不从当前广告记录反推历史。

## 接口

均为管理员鉴权 GET、`Cache-Control: no-store`：

- `/api/v1/admin/revenue/overview`：指标、上期、零填充趋势、构成、渠道/点击来源、前十排行、缺失时间提示。
- `/api/v1/admin/revenue/airports`：机场/申请汇总分页。
- `/api/v1/admin/revenue/periods`：日期汇总分页，包括零收入周期。
- `/api/v1/admin/revenue/transactions`：统一业务交易明细分页。
- `/api/v1/admin/revenue/filters`：当前日期/口径有记录的机场或申请选项，不受已选机场限制。

共享参数见 `shared/revenue.ts`。默认最近一个月，日粒度，经营收入，按金额降序，每页 20 条。
快捷日期支持今日、昨日、近 7 天、最近一个月、最近 3 个月、最近半年、年初至今、本月、上月。最近一个月/3 个月/半年按北京时间向前回溯相应日历月，起止日期均包含；目标月份没有对应日期时取月末。年初至今从当年 1 月 1 日开始。
`entity` 为 `airport:ID` / `application:ID` / `account:ID`，空表示全部。
日期接受 2000 年起至今日，`page_size` 为 1–100。`sort` 支持 amount/name/time，`order` 支持 asc/desc。
接口不返回网关回调、联系方式、支付凭据等数据。金额字段均以 `_cents` 后缀标记。

每个接口在只读 REPEATABLE READ 快照中计算，概览各部分保持同一快照；不同请求可能因新交易存在时间差。服务启动幂等补充三项索引：两种订单的 status/paid_at，以及钱包流水 transaction_type/created_at。没有后台统计调度或缓存任务。

## 验证

```sh
npx tsx --test backend/tests/revenue.test.ts
npm run lint
npm run server:typecheck
npm run build -- --outDir /tmp/gaterank-revenue-build
```

真实 MySQL 集成测试仅连接显式指定的本机专用临时实例，不读取项目数据库凭据。测试自动创建并清理独立数据库；不要传入业务数据库实例端口。

```sh
docker run --rm -d --name gaterank-revenue-test-local -p 127.0.0.1:33319:3306 --tmpfs /var/lib/mysql -e MYSQL_ALLOW_EMPTY_PASSWORD=yes mysql:8.0 --default-time-zone=+08:00
# 等待 mysqladmin ping 返回 mysqld is alive。
docker exec gaterank-revenue-test-local mysqladmin ping
GATERANK_REVENUE_TEST_PORT=33319 npx tsx --test backend/tests/revenue.test.ts backend/tests/revenue.integration.test.ts
docker stop gaterank-revenue-test-local
```

覆盖手动金额/人工标记排除、订单与充值流水防重、续费分日、零点边界、空日期、历史不同排序规则、未关联/下架机场、分页、各维度金额对账及管理员接口鉴权。
