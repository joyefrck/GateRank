# 月报机器可读数据修复

目标：按用户已给定的字段方案修复 JSON、Markdown、llms-full.txt，使其引用已发布月报正文。

设计：统一解析已存储 Markdown 的章节、表格与摘要；兼容旧模板和仅有 HTML 的历史记录。保留 url/topics，新增 summary/risk_observations/new_airports/abnormal_airports/report_url/generated_at。不重新计算历史排名；Top 优先采用原文执行摘要。无法提取的样本数用 null，避免伪造 0。

- [x] 使用 2026-08 真实正文复现失败（0 !== 11），覆盖三个 HTTP 入口。
- [x] 在独立 monthlyReportSummary.ts 中实现提取，machineReadableRenderer.ts 统一生成结构化字段和 Markdown 摘要。
- [x] llms-full.txt 路由加载相同月报数据并输出相同摘要。
- [x] 检验旧模板、HTML 回退、空章节、表格回退和生成器输出；19 项相关测试与后端类型检查通过。
- [x] 使用线上 4—8 月公开正文离线验收修复结果：样本数分别为 16、54、61、60、11，每份均有 Top 3；月报 Markdown 无“未收录”。保留原有工作区改动。

范围：代码修复与验证；不包含 Git 推送或生产部署。
