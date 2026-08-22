# 逐星提交与变更台账

> 状态日期：2026-08-21  
> 记录范围：影响产品、数据、部署、测试体系或项目跟踪的主干提交。  
> 规则：PR 合并后记录 Squash/Merge SHA；分支中的未合并工作放在“进行中”表。

## 1. 已进入 main

| 日期 | 工作包 | PR / Commit | 本次解决什么 | 主要修改 | 验证与边界 |
| --- | --- | --- | --- | --- | --- |
| 2026-08-19 | DOC-README-001 | PR #8 / [`c16804b4`](https://github.com/Jovifei/Star_photo_addr/commit/c16804b4bdb687308ad64eb734f045a9ecd6f4b0) | README 缺少图形界面、完整使用与部署说明 | 生产截图、截图脚本、数据语义、Docker/阿里云指南 | quality、live-data、desktop/mobile E2E；截图数据不代表实时结论 |
| 2026-08-20 | DATA-HARDEN-001 | PR #9 / [`2910b236`](https://github.com/Jovifei/Star_photo_addr/commit/2910b2369beb9163e7efbdbf4d59f7f064e9ac56) | 云量刷新、卫星、光污染、快照和部署链路存在竞态/保护不足 | 云量保留旧画布、卫星产品隔离、GIBS 原生缩放、光污染模板、刷新冷却 | 154 unit、34 E2E、live smoke、Docker；VIIRS 不等于 Bortle/SQM |
| 2026-08-20 | DATA-AUDIT-002A | Direct / [`3ca93736`](https://github.com/Jovifei/Star_photo_addr/commit/3ca9373690b1e75785a63d9c85f3bbec6ccbd83a) | 统一坐标输入、GIBS 缓存和数据源 TTL | 坐标解析、共享 GIBS、冷缓存保护、自定义光污染署名 | 提交后发现时间轴实验性改动不应保留，见下一条纠偏 |
| 2026-08-20 | DATA-AUDIT-002B | Direct / [`02281ce7`](https://github.com/Jovifei/Star_photo_addr/commit/02281ce71ab7b8a911eb289a2a5ad17b94e7c683) | 恢复已验证时间轴，移除未完整落地的辅助重构 | 保留数据加固，恢复稳定 CloudTimeline 与既有 E2E | 纠偏提交；证明重要改动应在完整门禁后再报告完成 |
| 2026-08-20 | UX-VIEWPORT-001 | PR #10 / [`94043d87`](https://github.com/Jovifei/Star_photo_addr/commit/94043d8715faefd79306c77998741cad44425da9) | 首页缺少省域/当前视野推荐和清晰排行 | 1–12 编号标记、推荐卡、视野筛选、移动端层级、Leaflet SSR | audit、lint、TS、168 unit、live/container、desktop/mobile E2E |
| 2026-08-20 | QA-PLAN-001 | PR #11 / [`18e03cdf`](https://github.com/Jovifei/Star_photo_addr/commit/18e03cdf82f0e3154664a4e96543f0a45e81444d) | 测试缺少统一方案、状态和发布门禁 | TEST_PLAN_V1、初始状态、工程修改记录 | 文档基线；不等同于测试已实施 |
| 2026-08-20 | QA-AUTO-001 | PR #12 / [`50496e61`](https://github.com/Jovifei/Star_photo_addr/commit/50496e61f0be1cb666f344f36d832029df2e988e) | 契约/API/故障/跨浏览器盲区，以及移动端刷新竞态 | contract/integration、503 故障注入、焦点、Firefox/WebKit、artifact | 28 files/186 Vitest、54+4 browser PASS、live/container PASS；真机/阿里云/性能未覆盖 |

## 2. 当前进行中

| 工作包 | 分支 | 目标 | 预期文件 | 完成后记录 |
| --- | --- | --- | --- | --- |
| TRACK-001 | `test/ux-research-quality-v2-20260820` | 将剩余测试升级为详细任务卡，并建立项目状态、提交台账和 Codex 接力规则 | `docs/project-tracking/*`、`docs/testing/TEST_STATUS.md`、工程修改记录 | 合并后把最终 PR 和 main SHA 移入上表 |

## 3. 以后每条台账必须回答的问题

1. 为什么要改；
2. 解决了哪个 Bug、风险或用户问题；
3. 修改了哪些模块；
4. 执行了哪些验证，精确结果是什么；
5. 哪些环境或科学结论仍未验证；
6. 如何回滚；
7. 关联的工程修改记录在哪里。

## 4. 新条目模板

```markdown
| YYYY-MM-DD | WORK-PACKAGE-ID | PR #N / `sha` | 问题与目的 | 主要修改 | 验证、未覆盖边界 |
```

如果一次直接提交随后被纠偏，两条都必须保留，不能只记录最终看起来正确的提交。
