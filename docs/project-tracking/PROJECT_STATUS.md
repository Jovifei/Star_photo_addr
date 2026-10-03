> **2026-10-03 次级质量候选**：A11Y-AXE-001 首批六项桌面/手机测试已加入，默认规则整页扫描并保存全部结果，serious/critical 阻断。本地完整代码检查通过，浏览器首轮执行等待 hosted CI；真机、地图真实影像和完整无障碍合规边界未关闭。[范围](../engineering-change-log/2026-10-03-accessibility-gate.md)

> **2026-10-03 时区修复 CI 闭环**：现有 PR49 的 `2c143f72` 五项 CI 全部通过：74 文件/428 测试，Chromium 234 PASS/122 适用性跳过/0 FAIL，Firefox/WebKit 12 PASS，生产 audit 0；未合并、未部署。[精确提交证据](../engineering-change-log/2026-10-03-source-timestamp-timezone.md)

> **2026-10-03 时区显示修复候选**：生产公开页面发现同一抓取时次分别显示13:15/22:15；新增统一上海时区格式器和三浏览器时区回归。此跟进与依赖分类提交30fbead分开，尚未部署；此前30fbead的5项CI已通过，但不替代本次源码修改的精确提交验证。[范围与验证](../engineering-change-log/2026-10-03-source-timestamp-timezone.md)

> **2026-10-03 依赖边界修复候选**：main `19fcee2` 的 CI 因 shadcn 构建工具链的 braces high 公告失败。本候选保留所有锁定版本，仅纠正开发/生产依赖分类；生产 audit 0、73 文件/421 测试及构建通过，开发 audit 仍有 8 high。精确提交 GitHub 全量 CI 待验证；本地 Chromium 被运行环境 socket 限制阻断，未称全量通过。未合并、未部署，线上视觉验收与远端接力仍待完成。[完整证据](../engineering-change-log/2026-10-03-build-dependency-boundary.md)

> **完整 CI 已关闭（2026-10-02）**：PR47精确测试headf7e5373，工作流36994802711五jobs全绿；Chromium228通过122适用性跳过0失败，Firefox/WebKit6通过。原main同步且无产品代码差异；生产仍v1.0.25a74f7ee。此前仅定向UI通过和旧CI失败记录保留为历史。详见[完整门禁终态](../engineering-change-log/2026-10-02-full-chromium-contract-closure.md)。PENDING_REMOTE_PLANNING仍未解除。

> **最新：v1.0.25** 已修正日期选项过大的问题。运行代码a74f7ee95d77f0a26ed30e47db0ff9e71ba05f41；桌面32px内容宽度工具栏，手机仅自然换行。线上3825px火烧云整组约483px，日期约59px，已实测。72/414完整门禁及36几何/6交互组合通过。[紧凑工具栏交付](../engineering-change-log/2026-10-02-compact-topic-toolbar.md)。下方旧发布记录为历史。

> **2026-10-02 v1.0.24 最新交付**：云海/火烧云日期、晨晚时段常驻顶部直接选择，移除调整弹层和手机空白占位。PR44/45已合并，运行代码6389bef784c12b4bc1c7aaee0fa3a93d852766a5。72文件414测试、28几何/6交互组合及12手机地图手势通过；线上390px工具栏紧接搜索，所有选项可见，无横溢或地图覆盖。完整记录见[日期工具栏交付](../engineering-change-log/2026-10-02-direct-date-toolbar.md)。以下旧版本事实仅供历史参考。

> **2026-10-02 当前交付已完成**：PR41/43 已合并并同步原目录 main；部署代码 `4460382fc2991b3af5555816f307c2318f5b962a` / v1.0.23。完整检查72文件414测试、lint/typecheck/build通过；浏览器10PASS6适用性SKIP，最终缺字段提示回归1PASS。真实线上12行84评分，取样点今晚45，BestMatch源抓取2026-10-02T06:23:56.895Z，stale=false；app/worker健康，原卷和回滚镜像保留。ICON缺能见度仍暂缓该模型评分，已明确说明原因。远端真实修复9c249d5已接收验证；旧聊天长度上限，接力聊天待Jovi决定。以下旧候选/失败状态仅为历史。详见[当前交付记录](../engineering-change-log/2026-10-02-branch-consolidation.md)。

# 逐星项目状态总览

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

> 快照日期：2026-09-27（v1.0.22 热修候选）
> 候选版本：`v1.0.22`，分支 `codex/home-hydration-clock-20260927`；生产基线：`v1.0.21 / d75bcffc571c8cfcb31d828d0ab8ca123d1c3c6a`。
> v1.0.21 已合并部署且 app/worker、数据源通过；发布后浏览器发现首页/暗夜选址水合错误，v1.0.22 修复待 CI、合并和公网复核。

## 0.1 v1.0.22 当前热修候选

- 首屏时间由服务端序列化并在浏览器挂载后同步实际日期；响应式地图面板以一致的服务端快照完成水合。
- 本地 `npm run check`：64 个 Vitest 文件 / 370 项、ESLint、TypeScript、生产构建通过；跨两天桌面/手机回归 2/2，手机地图专项 12/12。
- GitHub CI、main 合并、ECS 更新和公网再次验收待完成；物理手机浏览器仍为 `NOT_RUN`。

## 0.2 v1.0.21 已发布快照

- 四个入口手机/平板共享地图主页、紧凑搜索日期栏、底部导航和三态数据面板；横向平板使用地图加侧栏。
- 手机地图默认可拖动、双指/双击缩放与点选；火烧云/云海空白坐标显示附近目录点，不为任意坐标造预测分数；三日排行逐行注明日期。
- `npm run check`：64 个 Vitest 文件 / 370 项测试、ESLint、TypeScript、production build 均通过。
- Chromium：248 项，172 passed / 76 适用性跳过 / 0 failed；Firefox/WebKit 6/6；live smoke required/optional 源均通过；production dependency audit 0 vulnerabilities。
- PR #36 的五项 CI 通过后合并为 `main@d75bcffc571c`；ECS app/worker healthy，公网 `/healthz` 与数据源核查确认 v1.0.21。手机实测浏览器随后发现首页/暗夜选址 React #418，转入 v1.0.22 热修；物理手机仍为 `NOT_RUN`。

## 0.2 历史发布快照（v1.0.14，截至 2026-09-10）

- 顶部命令栏按“评分时间 → B1–B4 暗空参考 → 推荐门槛 → 仅显示推荐地点”排列；搜索、定位和四组参数保持紧凑同排，窄屏才堆叠。
- B1–B4 文案和分数预设明确为：B1 极暗 ≥85、B2 自然暗夜 ≥70、B3 乡村夜空 ≥55、B4 乡村/郊区过渡 ≥50；命令栏档位单选并同步推荐门槛，目录参考不进入实时天气评分。
- 主页默认使用云量预报 + 光污染参考，卫星实况及其较高的 24 小时时间轴需主动选择；旧的持久化实况状态会在无显式 URL 时迁移回默认组合。
- 火烧云和云海排行各自增加 0–100 分门槛滑块，列表只保留 `score >= threshold` 的数值评分点位；null/数据不足点位不计入达标数量，地图标记仍保留未知语义。
- 搜索“太子尖”现优先命中本地点位目录中的“临安太子尖”；本地点位不再依赖远端地理编码是否收录山峰 POI，未命中本地时仍回退全球城市搜索。
- 通用观星目录现有 282 个候选、覆盖 31 个省级行政区；新增 25 个省级网红山地/海岸/草原/营地/高原候选，默认精选 17 个，视野候选上限 20 个。
- 当时主线已通过 `npm run check`（53 个测试文件 / 308 项）、Chromium E2E 112 passed / 34 skipped、live smoke 和 audit；当时公网 `/healthz` 返回 v1.0.14 / `39338495db0d`。这些记录属于历史验收，不代表当前部署。

以下第 1–8 节保留历史工作包与长期未完成项；新的发布状态以本节和对应最新工程记录为准。

## 1. 当前结论

- 《逐星》详细测试方案 V1.0、第一阶段自动化和项目跟踪体系均已进入 `main`；
- 地图面板可移动/缩放、云量百分比条、暗夜数据缺失说明、分级行政边界、区域化取样点名称、海拔显示保护和观星计划附近排行已提交；
- `/sites` 继续复用统一地图引擎，但已使用“长期暗空”任务标题与今夜观测区分；
- 星空、云海、晚霞的产品边界和自动刷新策略已写入 `docs/product/WORKSPACE_ARCHITECTURE.md`；
- 本轮新增单元和 Chromium E2E 用例；分支已推送并合并到 main，生产验收已完成；真机、性能、授权数据和科学校准仍按测试台账管理；
- 真机、阿里云出口、正式 TLS、有许可栅格/边界和 SQM 科学校准仍不能声明为已验证。

## 2. 已完成工作包

| 工作包 | 状态 | 交付 | 关键证据 |
| --- | --- | --- | --- |
| RELEASE-MAP-FIRST-021 | 本地验证通过，等待 CI/集成 | 手机地图主页、底部数据面板、默认地图手势、专题附近目录点、三日高分日期标识 | `codex/mobile-map-first-20260926`；`npm run check` 64/370；Chromium 248/172/76/0；Firefox/WebKit 6/6；live smoke/audit PASS；PR/main/ECS 尚待完成；真机 NOT_RUN |
| RELEASE-DATA-014 | PASS | 按省级公开资料扩充 282 点目录、默认 17 个精选、天津补点、版本记录、生产部署和公网验收 | `main@39338495db0d`；`npm run check` 53/308、Chromium E2E 112/34、live smoke/audit、app/worker healthy、`check:data-sources`、公网搜索 |
| RELEASE-UI-013 | PASS | 本地点位搜索优先命中目录、v1.0.13 版本记录、生产部署和公网搜索验收 | `main@14ad3a49cf1`；`npm run check` 53/306、Chromium E2E 112/34、live smoke/audit、生产 `/healthz`、公网搜索 |
| RELEASE-UI-012 | PASS | 顶部控件统一、主页默认图层纠偏、火烧云/云海评分门槛滑块、v1.0.12 记录、生产部署和公网验收 | `main@1e550cdc5a15`；`npm run check` 52/304、Chromium E2E 110/34、live smoke/audit、生产 `/healthz`、公网 `check:data-sources` |
| RELEASE-UI-011 | PASS | 顶部直接筛选控件、B1–B4 说明、v1.0.11 版本记录、生产部署和公网验收 | `main@a66ad049dfd6`；`npm run check`、Chromium E2E、live smoke、audit、生产 `/healthz` |
| DOC-README-001 | PASS | 图形化 README、使用说明、截图与部署命令 | `c16804b...` / PR #8 |
| DATA-HARDEN-001 | PASS | 云量刷新、卫星、VIIRS、快照、AQI/气压/Kp、阿里云链路加固 | `2910b236...` / PR #9 |
| DATA-AUDIT-002 | PASS | 坐标校验、共享 GIBS、分源 TTL、冷缓存强刷保护 | `3ca93736...` + 纠偏 `02281ce7...` |
| UX-VIEWPORT-001 | PASS | 当前视野推荐、编号标记、卡片排序、移动端层级修复 | `94043d87...` / PR #10 |
| QA-PLAN-001 | PASS | 《逐星》详细测试方案 V1.0 与初始状态清单 | `18e03cdf...` / PR #11 |
| QA-AUTO-001 | PASS | 契约/集成/故障注入/跨浏览器/CI 证据及 3 项 Bug 修复 | `50496e61...` / PR #12 |
| TRACK-001 | PASS | 项目状态、剩余测试任务卡、提交台账、Codex 接力和分支规则 | `3a461c09...` / PR #13 |

## 3. 2026-09-23 发布前状态快照

| 工作包 | 状态 | 分支 | 已提交内容 | 完成条件 |
| --- | --- | --- | --- | --- |
| RELEASE-MOBILE-DATA-019 | 发布门禁完成，等待集成 | `codex/mobile-data-integrity-v1.0.19-20260923` | v1.0.19 修复移动内容流、云海/火烧云数据覆盖语义、海拔空值和桌面非模态语义 | 推送 release 分支、GitHub CI、main 合并、ECS 部署及公网健康/数据/页面验收 |

## 4. 已合并、可清理的远端分支

以下分支的功能或文档已经进入 `main`；GitHub 因 Squash/Merge 提交拓扑仍可能显示 `Ahead`，不代表存在遗漏功能：

```text
codex/unify-stargazing-theme-20260819      → PR #7 已合并
docs/readme-visual-guide-20260819          → PR #8 已合并
fix/data-refresh-aliyun-audit-20260819     → PR #9 已合并
feat/province-viewport-recommendations-20260820 → PR #10 已合并
docs/test-plan-v1-20260820                 → PR #11 已合并
test/quality-foundation-v1-20260820        → PR #12 已合并
test/ux-research-quality-v2-20260820       → PR #13 已合并
audit/module-data-aliyun-readiness-20260820 → 无独有提交，已被 main 完整超越
```

删除这些分支不会删除已经进入 `main` 的最终功能；提交和 PR 历史仍可追溯。

## 5. 待完成工作包

### 5.1 本轮需要用户环境补充

| ID | 项目 | 状态 | 优先级 | 依赖 |
| --- | --- | --- | --- | --- |
| UX-MAP-002-LOCAL | 拉取本轮主干并做桌面视觉验收 | MANUAL | P0 | 本地 Node 24、Chromium；重点检查面板拖动/缩放、无遮挡、附近排行 |
| DATA-DARKSKY-001 | 安装有许可的 Bortle/SQM 数值栅格 | BLOCKED | P0（仅针对数值暗夜能力） | 合法数据文件、服务器写权限、重新构建镜像 |
| MAP-BOUNDARY-001 | 配置天地图令牌或本地授权边界包 | BLOCKED | P1 | 天地图账号/令牌或有许可 GeoJSON；域名白名单 |

### 5.2 真机与人工体验

| ID | 项目 | 状态 | 优先级 | 依赖 |
| --- | --- | --- | --- | --- |
| DEV-IOS-001 | iPhone Safari 真机 | MANUAL | P0 | iPhone、HTTPS 可访问环境 |
| DEV-ANDROID-001 | Android 多厂商 | MANUAL | P1 | 至少 Pixel/三星/小米或等效设备 |
| UX-ZOOM-001 | 200% 浏览器缩放 | MANUAL | P1 | 桌面 Chrome/Firefox/Edge |
| A11Y-COLOR-001 | 高对比与色觉模式 | MANUAL | P1 | Windows 高对比、灰阶/色觉模拟 |

### 5.3 部署基础设施

| ID | 项目 | 状态 | 优先级 | 依赖 |
| --- | --- | --- | --- | --- |
| DEP-ECS-001 | 阿里云大陆 ECS 海外出口 | BLOCKED | P0 | 实际 ECS、地域、服务器访问权限 |
| DEP-TLS-001 | 正式域名 TLS | BLOCKED | P0 | 域名、DNS、证书/ACME、Nginx |

### 5.4 性能、稳定性与视觉

| ID | 项目 | 状态 | 优先级 | 依赖 |
| --- | --- | --- | --- | --- |
| PERF-K6-050 | k6 50 用户压力 | DEFERRED | P1 | 预发布环境、监控、限流基线 |
| PERF-K6-100 | k6 100 用户突发 | DEFERRED | P1 | 50 用户通过、上游保护确认 |
| PERF-SOAK-030 | 30 分钟 soak | DEFERRED | P1 | 预发布环境、CPU/内存采集 |
| PERF-LHCI-001 | Lighthouse CI | DEFERRED | P2 | 稳定 Mock 或预发布页面 |
| VIS-BASE-001 | 像素视觉基线 | DEFERRED | P1 | 稳定字体、Mock 地图、人工审批流程 |

### 5.5 科学数据校准

| ID | 项目 | 状态 | 优先级 | 依赖 |
| --- | --- | --- | --- | --- |
| SCI-SQM-001 | Bortle/SQM 科学真值 | BLOCKED | P0（仅针对科学声明） | 授权栅格、SQM 仪器、现场样本、校准方案 |

详细步骤、验收标准和证据见 [`TEST_BACKLOG.md`](./TEST_BACKLOG.md)；本轮暗夜资产安装步骤见 [`../DARK_SKY_DATA_SETUP.md`](../DARK_SKY_DATA_SETUP.md)。

## 6. 本轮本地验收顺序

```bash
git checkout main
git pull --ff-only
npm ci
npm run check
npx playwright install chromium
npm run test:e2e
```

视觉重点：

1. 左上“观星地点”和右上“云量与图层”可通过“面板布局”调整 90%–135%；
2. 拖动面板标题后不影响地图缩放、按钮和滑杆；
3. 总云量/高云/中云/低云显示为横向百分比条；
4. `/sites` 显示长期暗空任务说明；
5. 无本地栅格时天顶亮度/Bortle 显示“未安装”而不是假值；
6. `/planner` 的附近排行可切换 10/50/100/200 km。

## 7. 发布阻断规则

以下任一情况存在时，不得把对应能力标记为“生产已验证”：

- P0 测试未通过；
- iPhone Safari 核心流程不可操作；
- 阿里云 ECS 无法稳定访问关键上游；
- TLS 证书链、主机名或续期未验证；
- 性能测试出现持续 5xx、OOM 或刷新绕过；
- stale 数据未明确标记；
- 未经现场校准却输出精确 SQM/Bortle 真值。

## 8. 下次更新要求

下一轮提交必须更新：

- 本文件中对应工作包状态；
- `TEST_BACKLOG.md` 的执行记录；
- `TEST_STATUS.md` 的结果汇总；
- `CHANGE_LEDGER.md`；
- 一份对应的 `engineering-change-log`。
