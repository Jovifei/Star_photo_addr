# 逐星提交与变更台账

> 状态日期：2026-08-22  
> 记录范围：影响产品、数据、部署、测试体系或项目跟踪的主干提交。  
> 规则：PR 合并后记录最终主干 SHA；未完成验证的直接提交必须明确标记，不得用旧绿灯代替。

## 1. 已进入 main

| 日期 | 工作包 | PR / Commit | 本次解决什么 | 主要修改 | 验证与边界 |
| --- | --- | --- | --- | --- | --- |
| 2026-08-19 | DOC-README-001 | PR #8 / [`c16804b4`](https://github.com/Jovifei/Star_photo_addr/commit/c16804b4bdb687308ad64eb734f045a9ecd6f4b0) | README 缺少图形界面、完整使用和部署说明 | 生产截图、截图脚本、数据语义、Docker/阿里云指南 | quality、live-data、desktop/mobile E2E；截图数据不代表实时结论 |
| 2026-08-20 | DATA-HARDEN-001 | PR #9 / [`2910b236`](https://github.com/Jovifei/Star_photo_addr/commit/2910b2369beb9163e7efbdbf4d59f7f064e9ac56) | 云量刷新、卫星、光污染、快照和部署链路存在竞态/保护不足 | 云量保留旧画布、卫星产品隔离、GIBS 原生缩放、光污染模板、刷新冷却 | 154 unit、34 E2E、live smoke、Docker；VIIRS 不等于 Bortle/SQM |
| 2026-08-20 | DATA-AUDIT-002A | Direct / [`3ca93736`](https://github.com/Jovifei/Star_photo_addr/commit/3ca9373690b1e75785a63d9c85f3bbec6ccbd83a) | 统一坐标输入、GIBS 缓存和数据源 TTL | 坐标解析、共享 GIBS、冷缓存保护、自定义光污染署名 | 提交后发现时间轴实验性改动不应保留，见下一条纠偏 |
| 2026-08-20 | DATA-AUDIT-002B | Direct / [`02281ce7`](https://github.com/Jovifei/Star_photo_addr/commit/02281ce71ab7b8a911eb289a2a5ad17b94e7c683) | 恢复已验证时间轴，移除未完整落地的辅助重构 | 保留数据加固，恢复稳定 CloudTimeline 与既有 E2E | 纠偏提交；证明重要改动应在完整门禁后再报告完成 |
| 2026-08-20 | UX-VIEWPORT-001 | PR #10 / [`94043d87`](https://github.com/Jovifei/Star_photo_addr/commit/94043d8715faefd79306c77998741cad44425da9) | 首页缺少省域/当前视野推荐和清晰排行 | 1–12 编号标记、推荐卡、视野筛选、移动端层级、Leaflet SSR | audit、lint、TS、168 unit、live/container、desktop/mobile E2E |
| 2026-08-20 | QA-PLAN-001 | PR #11 / [`18e03cdf`](https://github.com/Jovifei/Star_photo_addr/commit/18e03cdf82f0e3154664a4e96543f0a45e81444d) | 测试缺少统一方案、状态和发布门禁 | TEST_PLAN_V1、初始状态、工程修改记录 | 文档基线；不等同于测试已实施 |
| 2026-08-20 | QA-AUTO-001 | PR #12 / [`50496e61`](https://github.com/Jovifei/Star_photo_addr/commit/50496e61f0be1cb666f344f36d832029df2e988e) | 契约/API/故障/跨浏览器盲区，以及移动端刷新竞态 | contract/integration、503 故障注入、焦点、Firefox/WebKit、artifact | 28 files/186 Vitest、54+4 browser PASS、live/container PASS；真机/阿里云/性能未覆盖 |
| 2026-08-22 | TRACK-001 | PR #13 / [`3a461c09`](https://github.com/Jovifei/Star_photo_addr/commit/3a461c09a2cb450de710f87490ff9317b2d81a8e) | 未完成测试散落在聊天和简表中，旧分支状态难以判断 | 项目状态、剩余测试任务卡、提交台账、Codex 接力、分支规则；修复评分档位 E2E 的日期依赖 | quality、live-data、container、Chromium、Firefox/WebKit 全部通过；真机、ECS、TLS、性能和科学真值仍未覆盖 |
| 2026-08-22 | UX-MAP-002A | Direct / [`1edbdbe2`](https://github.com/Jovifei/Star_photo_addr/commit/1edbdbe2bb58910c1593564c5f4af492a023d44c) | 截图中地图面板字体小、遮挡、云通道难比较，计划页缺少附近排行 | 可拖动/缩放面板、云量百分比条、暗夜安装说明、天地图境界入口、区域取样点、海拔保护、附近排行 | 新增 unit/E2E 与工程文档；后续两个提交继续加固客户端边界和产品语义 |
| 2026-08-22 | UX-MAP-002B | Direct / [`4c6349cb`](https://github.com/Jovifei/Star_photo_addr/commit/4c6349cb8b0457f3cd2f6be24b27d2e7ccaa23bf) | localStorage/请求状态需要避免 SSR 与旧结果污染 | 面板管理器改为纯客户端动态边界；附近排行按请求键隔离；E2E 日期动态化 | 静态代码复核完成；完整 main push CI 需由 Actions 页面或本地命令确认 |
| 2026-08-22 | UX-MAP-002C | Direct / [`3fc11fcb`](https://github.com/Jovifei/Star_photo_addr/commit/3fc11fcb00151b3ab8e80239137728132f51407e) | “无数据”含义不清、三级边界层次弱、两个地图工作区同质化 | 侧栏未安装/无覆盖状态、海拔统一显示、国家/省/市虚线层级、暗夜选址独立标题、星空/云海/晚霞规划 | 代码和回归测试已提交；直接推送的 Actions Check Run 当前连接器不可见，工作包暂不标 PASS |

## 2. 当前进行中

| 工作包 | 目标 | 已完成 | 剩余门禁 |
| --- | --- | --- | --- |
| UX-MAP-002 | 地图可读性、暗夜说明、行政边界和附近排行 | 所有可远端实现代码、测试和文档已进入 main | `npm run check`、Chromium E2E、桌面视觉验收；需要天地图令牌/栅格的能力单独保持 BLOCKED |

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
