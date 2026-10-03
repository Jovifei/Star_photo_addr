> **2026-10-03 A11Y-AXE-001 候选**：沿用 PR49 分支，完成时区 `2c143f72` 五项 CI 闭环后加入六项整页 axe 测试与 dev-only 依赖；应用源码不变，首轮 hosted 浏览器验证待执行。[工程记录](../engineering-change-log/2026-10-03-accessibility-gate.md)

> **2026-10-03 依赖边界修复候选**：main `19fcee2` 的 CI 因 shadcn 构建工具链的 braces high 公告失败。本候选保留所有锁定版本，仅纠正开发/生产依赖分类；生产 audit 0、73 文件/421 测试及构建通过，开发 audit 仍有 8 high。精确提交 GitHub 全量 CI 待验证；本地 Chromium 被运行环境 socket 限制阻断，未称全量通过。未合并、未部署，线上视觉验收与远端接力仍待完成。[完整证据](../engineering-change-log/2026-10-03-build-dependency-boundary.md)

> **2026-10-02 当前交付已完成**：PR41/43 已合并并同步原目录 main；部署代码 `4460382fc2991b3af5555816f307c2318f5b962a` / v1.0.23。完整检查72文件414测试、lint/typecheck/build通过；浏览器10PASS6适用性SKIP，最终缺字段提示回归1PASS。真实线上12行84评分，取样点今晚45，BestMatch源抓取2026-10-02T06:23:56.895Z，stale=false；app/worker健康，原卷和回滚镜像保留。ICON缺能见度仍暂缓该模型评分，已明确说明原因。远端真实修复9c249d5已接收验证；旧聊天长度上限，接力聊天待Jovi决定。以下旧候选/失败状态仅为历史。详见[当前交付记录](../engineering-change-log/2026-10-02-branch-consolidation.md)。

# 逐星提交与变更台账

## 当前接力状态：2026-10-02（集成中，尚未最终发布）

最新事实以 [功能分支归并记录](../engineering-change-log/2026-10-02-branch-consolidation.md)、根 `LOCAL_CODEX_HANDOFF.md` 和当前源码/命令证据为准。本节取代下方旧快照中的“当前主线、候选和部署”表述；下方保留内容均为历史记录或仍待重新核验的长期任务。

- 隔离集成分支：`codex/starphoto-main-refresh-20261002@78c107d`，包括候选 Best Match 证据、错误状态、Next 16.3.8、模型能力/压力/worker 修复和本地持久化地点天气水合修复。历史分支按功能保留/替代后已纳入祖先，远端 refs 均为集成历史祖先。
- 原目录 `E:\project\Star_photo_addr`：干净 `main@7a572b538caad9a881066cdd8c301a161c1523d1`；Owner 原修改由 `ef15634` 和独立备份保护。最终功能合并后仍需再次同步原目录。
- 完整本地 `npm run check`：lint/typecheck、71 个测试文件/411 测试和 build PASS。E2E 仍有 2 项桌面 loading 失败，第一轮水合修复后的相关单测通过；最终 UI 门禁保持 `CHANGES_REQUIRED`，不能用完整 check 代替。
- 已有真实单点 Best Match 来源 `sourceFetchedAt=2026-10-02T05:23:26.681Z`、stale=false，两个观测夜评分验证通过；不代表全部候选或生产页面验收。
- 远端实际修复分支 `candidate-pressure-review-followup@c3626d9` 仍在执行，尚未收到最终交接，也未合入最终 main。精确 SHA 的最终远端审核 `PENDING`。
- 生产仍为 `bd23a7c442e1` / v1.0.22。本轮 GitHub main 合并、最终原目录同步、合并 SHA 验证及部署未完成。
- 知识库已增量登记明确项目映射并保留其他 7 个映射及配置备份；安全 tracked 文档镜像待最终文档冻结后执行，不将注册视为镜像完成。

下一步：修复 E2E loading 失败 → 接收远端真实修复与交接 → 对最终提交重跑针对性和完整门禁 → 合并 GitHub main / 同步原目录 → 合并 SHA 测试 → 保留回滚的低内存部署 → 公网数据与页面复核 → 安全知识库同步。

## 以下为历史快照（请勿用作当前发布状态）

> 状态日期：2026-09-27
> 记录范围：影响产品、数据、部署、测试体系或项目跟踪的主干提交。
> 规则：PR 合并后记录最终主干 SHA；未完成验证的直接提交必须明确标记，不得用旧绿灯代替。

## 0.3 v1.0.22 首屏水合热修候选（2026-09-27）

| 日期 | 工作包 | PR / Commit | 候选交付 | 验证与边界 |
| --- | --- | --- | --- | --- |
| 2026-09-27 | RELEASE-HYDRATION-022 | `codex/home-hydration-clock-20260927`；PR 待创建 | 服务端首屏时钟与浏览器水合一致；手机视口改用订阅快照；本机低资源构建可限制 worker | 本地 `check` 64/370、跨两天桌面/手机 2/2、手机地图 12/12；GitHub CI、合并、ECS 更新和公网复核待执行；物理手机 NOT_RUN |

## 0.2 v1.0.21 已合并发布（2026-09-27）

| 日期 | 工作包 | PR / Commit | 候选交付 | 发布前验证与边界 |
| --- | --- | --- | --- | --- |
| 2026-09-27 | RELEASE-MAP-FIRST-021 | PR #36；`main@d75bcffc571c8cfcb31d828d0ab8ca123d1c3c6a` | 地图优先手机/平板布局、共用三态数据面板、地图触摸、专题附近目录点和逐日高分归属 | PR CI 五项 PASS（Chromium 174 passed / 76 skipped）；ECS app/worker healthy、公网身份与数据源 PASS。发布后首页/暗夜选址浏览器暴露 React #418，热修中；物理手机 NOT_RUN |

## 0.1 v1.0.19 发布前候选快照（2026-09-23）

| 日期 | 工作包 | PR / Commit | 候选交付 | 发布前验证与边界 |
| --- | --- | --- | --- | --- |
| 2026-09-23 | RELEASE-MOBILE-DATA-019 | PR pending；`codex/mobile-data-integrity-v1.0.19-20260923` | 修复移动内容流、云海 surface/pressure 覆盖、火烧云逐日/晨昏质量、未知海拔与桌面 modal 语义；更新 v1.0.19 用户记录 | `npm run check` 63/368；Chromium 230/163/67/0；Firefox/WebKit 4/4；live smoke 与依赖审计 PASS；公网 v1.0.18 / `349db7b` 为部署前基线；main merge/ECS 部署尚待执行 |

## 0. 本轮已合并并部署

| 日期 | 工作包 | PR / Commit | 当前交付 | 当前验证与下一步 |
| --- | --- | --- | --- | --- |
| 2026-09-10 | RELEASE-DATA-014 | [`3933849`](https://github.com/Jovifei/Star_photo_addr/commit/39338495db0d22c9ec5afe15763a023c4ba3a06b) | 通用观星目录 257 → 282，覆盖 31 个省级行政区；默认精选 11 → 17，视野候选上限 12 → 20；同步 v1.0.14 版本记录和省级来源/安全边界文档 | `npm run check` 53/308；Chromium E2E 112/34；live smoke/audit；app/worker healthy；公网 `/healthz` v1.0.14 / `39338495db0d`；`check:data-sources` 与太子尖/牵牛岗/九山顶/葛仙村/达瓦更扎搜索通过 |
| 2026-09-10 | RELEASE-UI-013 | [`14ad3a4`](https://github.com/Jovifei/Star_photo_addr/commit/14ad3a49cf11fd103fcb5d5b60759b3fe0bc3a4a) | 本地点位目录优先搜索“太子尖”，远端无结果时仍可返回“临安太子尖”；v1.0.13 版本记录 | `npm run check` 53/306；Chromium E2E 112/34；live smoke/audit；app/worker healthy；公网 `/healthz` v1.0.13 / `14ad3a49cf1`；公网搜索通过 |
| 2026-09-10 | RELEASE-UI-012 | [`1e550cd`](https://github.com/Jovifei/Star_photo_addr/commit/1e550cdc5a15c87fcad3465fecad9e9bfb3da29a)（merge `d640092`） | 顶部评分时间/B1–B4/推荐门槛/推荐开关统一；主页默认云量预报 + 光污染；火烧云/云海 `score >= threshold` 滑块；v1.0.12 记录 | `npm run check` 52/304；Chromium E2E 110/34；live smoke/audit；app/worker healthy；公网 `/healthz` v1.0.12 / `1e550cdc5a15`；`check:data-sources` 通过 |

## 1. 已进入 main

| 日期 | 工作包 | PR / Commit | 本次解决什么 | 主要修改 | 验证与边界 |
| --- | --- | --- | --- | --- | --- |
| 2026-09-10 | RELEASE-UI-011 | Direct merge / [`a66ad04`](https://github.com/Jovifei/Star_photo_addr/commit/a66ad049dfd69a87b0f97b5a5870679163260427) | 首屏评分设置被大面板占用，Bortle 含义不直观，桌面命令栏出现两行 | 顶部直接 B1–B4/评分时间/推荐门槛控件，紧凑搜索，完整 Bortle 文案，v1.0.11 记录与部署经验 | `npm run check`、Chromium 106/34、live smoke、audit、生产 `/healthz`；真机、性能、授权栅格仍未覆盖 |
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

## 2. 2026-09-23 当前发布候选（合并前快照）

| 工作包 | 目标 | 已完成 | 剩余门禁 |
| --- | --- | --- | --- |
| RELEASE-MOBILE-DATA-019 | 交付 v1.0.19 修复并验证移动端内容流与数据覆盖完整性 | 本地 check/E2E/cross-browser/live smoke、版本记录和独立复审均通过 | 推送 `codex/mobile-data-integrity-v1.0.19-20260923`、GitHub CI、main 合并、ECS 部署；真机/软键盘仍需人工验收 |

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
