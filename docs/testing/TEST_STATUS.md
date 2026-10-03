> **2026-10-03 依赖边界修复候选**：main `19fcee2` 的 CI 因 shadcn 构建工具链的 braces high 公告失败。本候选保留所有锁定版本，仅纠正开发/生产依赖分类；生产 audit 0、73 文件/421 测试及构建通过，开发 audit 仍有 8 high。精确提交 GitHub 全量 CI 待验证；本地 Chromium 被运行环境 socket 限制阻断，未称全量通过。未合并、未部署，线上视觉验收与远端接力仍待完成。[完整证据](../engineering-change-log/2026-10-03-build-dependency-boundary.md)

> **完整 CI 已关闭（2026-10-02）**：PR47精确测试headf7e5373，工作流36994802711五jobs全绿；Chromium228通过122适用性跳过0失败，Firefox/WebKit6通过。原main同步且无产品代码差异；生产仍v1.0.25a74f7ee。此前仅定向UI通过和旧CI失败记录保留为历史。详见[完整门禁终态](../engineering-change-log/2026-10-02-full-chromium-contract-closure.md)。PENDING_REMOTE_PLANNING仍未解除。

> **最新：v1.0.25** 已修正日期选项过大的问题。运行代码a74f7ee95d77f0a26ed30e47db0ff9e71ba05f41；桌面32px内容宽度工具栏，手机仅自然换行。线上3825px火烧云整组约483px，日期约59px，已实测。72/414完整门禁及36几何/6交互组合通过。[紧凑工具栏交付](../engineering-change-log/2026-10-02-compact-topic-toolbar.md)。下方旧发布记录为历史。

> **2026-10-02 v1.0.24 最新交付**：云海/火烧云日期、晨晚时段常驻顶部直接选择，移除调整弹层和手机空白占位。PR44/45已合并，运行代码6389bef784c12b4bc1c7aaee0fa3a93d852766a5。72文件414测试、28几何/6交互组合及12手机地图手势通过；线上390px工具栏紧接搜索，所有选项可见，无横溢或地图覆盖。完整记录见[日期工具栏交付](../engineering-change-log/2026-10-02-direct-date-toolbar.md)。以下旧版本事实仅供历史参考。

> **2026-10-02 当前交付已完成**：PR41/43 已合并并同步原目录 main；部署代码 `4460382fc2991b3af5555816f307c2318f5b962a` / v1.0.23。完整检查72文件414测试、lint/typecheck/build通过；浏览器10PASS6适用性SKIP，最终缺字段提示回归1PASS。真实线上12行84评分，取样点今晚45，BestMatch源抓取2026-10-02T06:23:56.895Z，stale=false；app/worker健康，原卷和回滚镜像保留。ICON缺能见度仍暂缓该模型评分，已明确说明原因。远端真实修复9c249d5已接收验证；旧聊天长度上限，接力聊天待Jovi决定。以下旧候选/失败状态仅为历史。详见[当前交付记录](../engineering-change-log/2026-10-02-branch-consolidation.md)。

# 《逐星》测试实施状态与待测试清单

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

> 对应方案：[`TEST_PLAN_V1.md`](./TEST_PLAN_V1.md)
> 详细剩余任务：[`../project-tracking/TEST_BACKLOG.md`](../project-tracking/TEST_BACKLOG.md)
> 项目总览：[`../project-tracking/PROJECT_STATUS.md`](../project-tracking/PROJECT_STATUS.md)
> 状态日期：2026-09-27
> 当前 release candidate：`v1.0.22`，分支 `codex/home-hydration-clock-20260927`
> 候选基线：`origin/main@d75bcffc571c`（v1.0.21）；生产公网 v1.0.21 已实测，首页水合错误待热修发布。

## 状态定义

| 状态 | 含义 |
| --- | --- |
| PASS | 已自动/人工执行，有证据且通过 |
| IMPLEMENTED | 已写测试，等待 CI 或目标环境验证 |
| TODO | 尚未实现，但当前无外部阻塞 |
| MANUAL | 需要人工/真机，自动化不能完全替代 |
| BLOCKED | 缺少 ECS、域名、证书、授权数据或现场设备 |
| DEFERRED | 已安排在后续阶段；旧文档中的 SKIP 均视为此状态，不是取消 |

## v1.0.19 本地发布候选门禁（2026-09-23）

| 门禁 | 结果 | 说明 |
| --- | --- | --- |
| `npm run check` | PASS | ESLint、TypeScript、63 个 Vitest 文件 / 368 项测试、Next.js production build |
| `npm run test:e2e` | PASS | Chromium 230 项：163 passed / 67 个项目/设备适用性 skip / 0 failed |
| `npm run test:e2e:cross-browser` | PASS | Firefox desktop 与 WebKit mobile，4/4 passed |
| `npm run test:live` | PASS | Open-Meteo 四模型/压力层/地理编码/AQI、NASA GIBS、NOAA Kp、VIIRS smoke |
| `npm audit --omit=dev --audit-level=high` | PASS | 0 vulnerabilities |
| 生产 `/healthz`、`/api/data-status` 预检 | PASS（旧版本基线） | v1.0.18 / `349db7b`；weather/satellite/light-pollution available；v1.0.19 尚未部署 |
| 真机 iPhone/Android、软键盘与真实浏览器底栏 | MANUAL | 仍需 Jovi 部署后现场确认 |

本节为 v1.0.19 本地发布候选证据；GitHub CI、main 合并、ECS 新版本部署与生产 `/healthz` 仍需单独验收。

## v1.0.22 首屏水合热修门禁（2026-09-27）

| 门禁 | 结果 | 说明 |
| --- | --- | --- |
| `STAR_BUILD_CPUS=1 npm run check` | PASS | 本机低资源构建；64 个 Vitest 文件 / 370 项、lint、TypeScript、生产构建 |
| 跨两天水合专项 | PASS | 桌面/手机 2/2，日期更新正确、筛选可操作，无 React 水合错误 |
| 手机地图专项 | PASS | 320、375、390、430、768、1024 等 12/12，覆盖地图拖动/缩放、面板手势和四入口 |
| 版本历史专项 | PASS | 首轮 CI 的旧测试仍写死上一版 v1.0.20；按当前版本推导上一补丁版后，桌面/手机 2/2 |
| GitHub CI、main 合并、ECS 公网 | PENDING | 必须以 v1.0.22 最终提交和真实公网结果验收 |
| 物理手机浏览器 | NOT_RUN | 桌面策略仍阻止直接启动连接手机的浏览器 |

## v1.0.21 已发布门禁及发现问题（2026-09-27）

| 门禁 | 结果 | 说明 |
| --- | --- | --- |
| `npm run check` | PASS | ESLint、TypeScript、64 个 Vitest 文件 / 370 项测试、Next.js production build |
| `npm exec -- playwright test` | PASS | Chromium 桌面/手机 248 项：172 passed / 76 项目适用性 skip / 0 failed |
| `npm run test:e2e:cross-browser` | PASS | Firefox desktop 与 WebKit mobile，6/6 passed，包含缩放、拖动、手机空白点选与键盘来源弹窗 |
| `npm run test:live` | PASS | Open-Meteo best_match、ICON、GFS、AIFS、pressure profile、geocoding、AQI、NASA GIBS、NOAA Kp；VIIRS optional tile 均 OK |
| `npm audit --omit=dev --audit-level=high` | PASS | 0 vulnerabilities |
| 物理手机浏览器 | NOT_RUN | Android 已连接；启动浏览器访问本地候选命令被桌面执行策略拒绝，临时端口映射已撤销 |
| GitHub PR CI / main | PASS | PR #36 五项 CI 全绿，合并提交 `d75bcffc571c`；Chromium 174 passed / 76 skipped |
| 生产健康/数据源 | PASS | app/worker healthy，公网 `/healthz` v1.0.21 / `d75bcffc571c`；天气/卫星/夜光可用 |
| 发布后手机视口浏览器 | CHANGES_REQUIRED | 首页和暗夜选址 React #418；火烧云/云海无同类错误；v1.0.22 修复待发布 |

本地 E2E 的瓦片/专题排行以 fixture 验证布局与交互，live smoke 单独验证外部数据源可达；二者不互相替代。v1.0.21 的公网浏览器缺陷已转入 v1.0.22 热修，不因原 CI 绿灯而忽略。

## v1.0.14 发布门禁结果

| 门禁 | 结果 | 说明 |
| --- | --- | --- |
| `npm run check` | PASS | ESLint、TypeScript、53 个 Vitest 文件 / 308 项测试、Next.js 生产构建 |
| 省级目录数据专项 | PASS | 282 个通用候选、31 个省级行政区、B1 37 / B2 180 / B3 21 / B4 44、默认精选 17；ID/坐标/海拔/说明回归通过 |
| `npm run test:e2e` | PASS | Chromium 桌面/移动 146 实例：112 passed / 34 skipped / 0 failed |
| `npm run test:live` | PASS | Open-Meteo 四模型/压力层/地理编码/AQI、NASA GIBS、NOAA Kp、VIIRS live smoke |
| `npm audit --omit=dev --audit-level=high` | PASS | 0 vulnerabilities |
| 生产 Compose / 公网 | PASS | app/worker healthy；公网 `/healthz` v1.0.14 / `39338495db0d`；`check:data-sources` 和太子尖/牵牛岗/九山顶/葛仙村/达瓦更扎搜索通过 |

本节结果来自 `main@39338495db0d` 的本地构建、脱敏 Mock E2E、真实数据源冒烟、ECS Compose 和公网 API/浏览器检查；真机、200% 缩放、压力测试、授权暗夜资产和现场 Bortle/SQM 科学校准仍不能因本轮自动化通过而完成。

## v1.0.13 发布门禁结果（历史）

| 门禁 | 结果 | 说明 |
| --- | --- | --- |
| `npm run check` | PASS | ESLint、TypeScript、53 个 Vitest 文件 / 306 项测试、Next.js 生产构建 |
| 本地点位搜索专项 | PASS | API/单元/集成和桌面/移动 E2E；公网浏览器输入“太子尖”显示“临安太子尖” |
| `npm run test:e2e` | PASS | Chromium 桌面/移动 146 实例：112 passed / 34 skipped / 0 failed |
| `npm run test:live` | PASS | Open-Meteo、NASA GIBS、NOAA、VIIRS live smoke |
| `npm audit --omit=dev --audit-level=high` | PASS | 0 vulnerabilities |
| 生产 Compose / 公网 | PASS | app/worker healthy；公网 `/healthz` v1.0.13 / `14ad3a49cf1`；`/api/geocode?q=太子尖` 返回临安太子尖 |

本节结果来自主线代码发布的本地构建、脱敏 Mock E2E、真实数据源冒烟和公网搜索/健康检查；真机、200% 缩放、压力测试、授权暗夜资产和现场 Bortle/SQM 科学校准不因本表自动化通过而完成。

## v1.0.12 发布门禁结果（历史）

| 门禁 | 结果 | 说明 |
| --- | --- | --- |
| `npm run check` | PASS | ESLint、TypeScript、52 个 Vitest 文件 / 304 项测试、Next.js 生产构建 |
| 专题评分门槛专项 | PASS | 火烧云与云海 0/60/100 分滑块、`score >= threshold` 列表过滤、null 数据 fail-closed |
| 顶部控件专项 | PASS | 评分时间 → B1–B4 → 推荐门槛 → 推荐开关；B1/B2/B3/B4 联动 ≥85/70/55/50；主页默认预报 + 光污染 |
| `npm run test:e2e` | PASS | Chromium 桌面/移动 144 实例：110 passed / 34 skipped / 0 failed；修正 3 个旧断言后重跑通过 |
| `npm run test:live` | PASS | Open-Meteo 四模型/压力层/地理编码/AQI、NASA GIBS、NOAA Kp、VIIRS 瓦片均 OK（2026-09-10） |
| `npm audit --omit=dev --audit-level=high` | PASS | 0 vulnerabilities |
| 生产 Compose / 公网 | PASS | app/worker healthy；公网 `/healthz` 返回 v1.0.12 / `1e550cdc5a15`；`check:data-sources` 通过 |

本节结果来自主线代码发布的本地构建、脱敏 Mock E2E、真实数据源冒烟和公网检查；真机、200% 缩放、压力测试、授权暗夜资产和现场 Bortle/SQM 科学校准不因本表自动化通过而完成。

## v1.0.11 发布门禁结果（历史）

| 门禁 | 结果 | 说明 |
| --- | --- | --- |
| `npm run check` | PASS | ESLint、TypeScript、51 个 Vitest 文件 / 302 项测试、Next.js 生产构建 |
| `npm run test:e2e` | PASS | Chromium 桌面/移动 140 实例：106 passed / 34 skipped / 0 failed |
| 命令栏专项 | PASS | 顶部直接 B1–B4、评分时间、推荐门槛和推荐开关；桌面 1280/1440 单行；无额外评分大面板 |
| `npm run test:live` | PASS | Open-Meteo、NASA GIBS、NOAA、VIIRS live smoke |
| `npm audit --omit=dev --audit-level=high` | PASS | 0 vulnerabilities |
| 生产 Compose | PASS | app/worker healthy，`/healthz` 为 v1.0.11 / `a66ad049dfd6` |
| 公网数据源 | PASS | `npm run check:data-sources -- https://photo.joviluma.com` 通过；未配置项保持明确降级 |

本节结果来自当前 `main` 的本地构建、Mock E2E、真实数据源冒烟和生产公网检查；不代表 iPhone/Android 真机、200% 缩放、压力测试或现场 Bortle/SQM 科学校准已经完成。

## 第一阶段已完成自动化工作包

| 工作包 | 状态 | 已验证内容 |
| --- | --- | --- |
| T1 测试目录和 Vitest include | PASS | `unit`、`contract`、`integration` 已统一纳入 `npm test` 和 `npm run check` |
| T2 API 输入与错误集成测试 | PASS | forecast 空值/错位/越界/非法模型、并发合并、429、stale；生产 API 边界 400/no-store |
| T3 数据契约 Fixture | PASS | 云层正常、错位、全空、混入字符串、非法时间轴 Fixture |
| T4 GIBS 契约与缓存 | PASS | parser、图层识别、并发合并、内存复用、失败后强刷冷却；真实 GIBS smoke 通过 |
| T5 核心导航 E2E | PASS | Chromium 参数保留测试；Firefox/WebKit `/sites` 上下文继承 |
| T6 故障注入 E2E | PASS | 强刷返回 503 时保留旧云量 Canvas，并持续显示降级信息 |
| T7 键盘与焦点 E2E | PASS | Dialog 初始焦点、Shift+Tab 焦点循环、Esc 关闭与焦点回归 |
| T8 跨浏览器冒烟 | PASS | Firefox Desktop 与 WebKit iPhone 核心流程通过 |
| T9 CI 失败产物 | PASS | Chromium 与跨浏览器 HTML、trace、video、screenshot artifact 可用 |
| T10 测试状态回写 | PASS | 执行记录、任务卡、提交台账与工程变更记录已进入 main |

## 第一阶段最终结果

| 门禁 | 结果 |
| --- | ---: |
| production dependency audit | PASS |
| ESLint | PASS |
| TypeScript | PASS |
| Vitest | 28 files / 186 tests PASS |
| Next.js production build | PASS |
| Open-Meteo / NASA GIBS / Geocoding / AQI / Kp live smoke | PASS |
| Compose / Nginx / production image / `/healthz` | PASS |
| Chromium Desktop + Mobile | 54 PASS / 2 DEFERRED-BY-DEVICE / 0 FAIL |
| Firefox Desktop + WebKit iPhone | PASS |

PR #13 的最终 HEAD `fa8f2996c1145fe69c251695eb6887fcde7a538f` 再次通过 quality、live-data-smoke、container-smoke、Chromium E2E 和 Firefox/WebKit；该轮还修复了测试对具体日历日期的隐式依赖。

## 第二阶段：地图可读性与附近排行

| ID | 测试/门禁 | 状态 | 覆盖内容 |
| --- | --- | --- | --- |
| UXMAP-U01 | `tests/unit/locationPresentation.test.ts` | IMPLEMENTED | Haversine 距离、厘米样式海拔转米、异常海拔拒绝、区域取样点命名、半径排行 |
| UXMAP-E01 | 面板比例与云量横条 | IMPLEMENTED | 90%–135% 滑杆生效，四个云量按钮转为横向百分比条 |
| UXMAP-E02 | 今夜观测/暗夜选址职责区分 | IMPLEMENTED | `/sites` 重定向后显示长期暗空标题与说明，导航保持 active |
| UXMAP-E03 | 暗夜数值栅格未安装状态 | IMPLEMENTED | 控件与侧栏显示“未安装”，弹窗说明许可/安装边界，不冒充天气故障 |
| UXMAP-E04 | 附近观星地点排行 | IMPLEMENTED | Planner 10/50/100/200 km 半径、评分列表、距离、海拔和 Bortle 展示 |
| UXMAP-CI | lint、TypeScript、Vitest、build、live/container、Chromium、Firefox/WebKit | IMPLEMENTED | CI 配置会在 main push 自动运行；当前连接器只可读取 PR 触发的 run，因此尚未取得最终 Check Run 证据 |
| UXMAP-VIS | 桌面视觉验收 | MANUAL | 面板默认大小、拖动范围、遮挡、缩放后文字清晰度、地图可操作性 |

本阶段测试代码已经进入 `main`，但在 GitHub Actions 或本地完整命令通过前不得把本表的 IMPLEMENTED 改为 PASS。执行后应把精确测试数、Run URL 和发现的 Bug 回写此处。

## 测试发现并修复的既有 Bug

### BUG-T1：云量数组混入非法元素仍被接受

云量数组现要求与时间轴等长、每项只能为 `null` 或有限数字、至少包含一个有效数字，且时间值符合本地 ISO 墙钟格式。

### BUG-T2：跨浏览器配置误合并 Chromium 项目

Playwright 基础配置和覆盖配置曾拼接项目数组，使 Firefox/WebKit Job 意外执行 Chromium；现已显式替换 `projects`。

### BUG-T3：移动端强刷失败提示被旧地图 debounce 掩盖

现已记录上下文/边界请求签名、阻止同签名普通请求重复执行、在人工刷新 revision 到来时取消旧 debounce，并在 503 时保留旧 Canvas 和降级提示。

### BUG-T4：评分档位 E2E 对日期分布存在硬编码

测试现读取当前档位数量，动态选择第一个非空档位，并精确断言地图数量减少该档位的数量。

## 剩余主测试项目

| ID | 项目 | 状态 | 原因 | 详细执行卡 |
| --- | --- | --- | --- | --- |
| UX-MAP-002-LOCAL | 本轮本地全量与视觉验收 | MANUAL | 当前执行容器无法解析 GitHub/npm，且连接器看不到 main push Check Run | [`PROJECT_STATUS`](../project-tracking/PROJECT_STATUS.md#6-本轮本地验收顺序) |
| DEV-IOS-001 | iPhone Safari 真机 | MANUAL | 地址栏、安全区、定位、触控、横竖屏、后台恢复 | [`TEST_BACKLOG`](../project-tracking/TEST_BACKLOG.md#2-dev-ios-001iphone-safari-真机) |
| DEV-ANDROID-001 | Android 多厂商 | MANUAL | Chrome/WebView、字体缩放、手势导航、后台恢复 | [`TEST_BACKLOG`](../project-tracking/TEST_BACKLOG.md#3-dev-android-001android-多厂商) |
| UX-ZOOM-001 | 200% 浏览器缩放 | MANUAL | planner、地图浮层和按钮裁切需人工观察 | [`TEST_BACKLOG`](../project-tracking/TEST_BACKLOG.md#4-ux-zoom-001200-浏览器缩放) |
| A11Y-COLOR-001 | 高对比和色觉模式 | MANUAL | 状态不得只依赖颜色 | [`TEST_BACKLOG`](../project-tracking/TEST_BACKLOG.md#5-a11y-color-001高对比与色觉模式) |
| DEP-ECS-001 | 阿里云大陆 ECS 出口 | BLOCKED | 需要真实 ECS 的 DNS/TCP/TLS/TTFB | [`TEST_BACKLOG`](../project-tracking/TEST_BACKLOG.md#6-dep-ecs-001阿里云大陆-ecs-海外出口) |
| DEP-TLS-001 | 正式域名 TLS | BLOCKED | 需要域名、证书链、跳转与续期 | [`TEST_BACKLOG`](../project-tracking/TEST_BACKLOG.md#7-dep-tls-001正式域名-tls) |
| DATA-DARKSKY-001 | Bortle/SQM 与本地边界资产安装 | BLOCKED | 需要有许可数据文件、令牌或服务器构建权限 | [`DARK_SKY_DATA_SETUP`](../DARK_SKY_DATA_SETUP.md) |
| PERF-K6-050/100 | k6 50/100 用户压力 | DEFERRED | 后续独立性能阶段，需隔离预发布环境 | [`TEST_BACKLOG`](../project-tracking/TEST_BACKLOG.md#8-perf-k6-050--perf-k6-100压力测试) |
| PERF-SOAK-030 | 30 分钟 soak | DEFERRED | 需要长期资源指标和预发布环境 | [`TEST_BACKLOG`](../project-tracking/TEST_BACKLOG.md#9-perf-soak-03030-分钟长稳测试) |
| PERF-LHCI-001 | Lighthouse CI | DEFERRED | 需要稳定 Mock/性能基线 | [`TEST_BACKLOG`](../project-tracking/TEST_BACKLOG.md#10-perf-lhci-001lighthouse-ci) |
| VIS-BASE-001 | 像素视觉基线 | DEFERRED | 需要稳定字体、地图 Mock 和人工审批 | [`TEST_BACKLOG`](../project-tracking/TEST_BACKLOG.md#11-vis-base-001像素视觉基线) |
| SCI-SQM-001 | Bortle/SQM 科学真值 | BLOCKED | 需要授权栅格、SQM 仪器和现场校准 | [`TEST_BACKLOG`](../project-tracking/TEST_BACKLOG.md#12-sci-sqm-001bortlesqm-科学真值) |

## 次级质量项目

| ID | 项目 | 状态 | 说明 |
| --- | --- | --- | --- |
| A11Y-AXE-001 | axe 自动无障碍 | DEFERRED | 需要新增依赖；现有键盘焦点测试已通过 |
| OBS-SENTRY-001 | Sentry / Web Vitals | DEFERRED | 需要隐私、采样率、数据留存和精确位置脱敏决策 |
| COV-VITEST-001 | Vitest 覆盖率门槛 | DEFERRED | 需要 coverage-v8；建议全局 75/65、关键模块 90% |

## 当前退出结论

第一阶段自动化测试已通过。第二阶段代码、测试和文档已进入 `main`，但最终全量门禁证据仍需从 GitHub Actions 或用户本地运行取得；在此之前保持 IMPLEMENTED / IN_PROGRESS。真机、阿里云、正式 TLS、授权暗夜资产和科学真值仍按 MANUAL/BLOCKED 管理。

## Mobile Browser v2 focused evidence (2026-09-27)

| Item | Status | Evidence |
| --- | --- | --- |
| Home filter AdaptiveSheet | IMPLEMENTED | `codex/mobile-home-priority-v2-20260927@ac6b425` |
| Mobile focused E2E | PASS | 11 passed |
| Desktop inline filter | PASS | 2 passed at 1200/1440 |
| typecheck / lint / build | PASS | local Node 24 run |
| Provider/cache/snapshot/score changes | NONE | scope review |
| PR / CI / merge / deploy | PENDING | `gh auth login` required locally |

This focused evidence does not replace full E2E, cross-browser, device, CI, or production gates.

## Mobile Browser v2 P2-B focused evidence (2026-09-28)

| Item | Status | Evidence |
| --- | --- | --- |
| DecisionSummary L2/trust summary | PASS | default visible on mobile and desktop |
| Forecast instance provenance | PASS | one native disclosure, closed by default, expandable |
| Duplicate observation provenance | PASS | `.observation-provenance` count 0 |
| Stale/invalid fail-closed | PASS | P0 stale reason visible; score 94 withheld |
| `npm run check` | PASS | lint, typecheck, 64 Vitest files / 370 tests, build |
| Workspace/content regression | PASS | 23 passed |
| Full Chromium / cross-browser / device / CI / production | NOT_RUN | separate gates |

P2-B does not change forecast integrity, scoring, provider/cache/snapshot, or
the `ForecastAvailability` path.

## Mobile Browser v2 P3-A focused evidence (2026-09-28)

| Item | Status | Evidence |
| --- | --- | --- |
| Presentation mappers | PASS | 7 unit tests |
| Three-axis data-state E2E | PASS | 4 passed |
| P0/data refresh/workspace refresh | PASS | 13 passed |
| `npm run check` | PASS | 65 Vitest files / 377 tests, build |
| Full Chromium / cross-browser / device / CI / production | NOT_RUN | separate gates |

P3-A keeps Provider Health, Selected Data Validity, and Recommendation
Eligibility separate; it does not make probe status a recommendation result.

P3-A review follow-up also verifies model mismatch/missing identity as `invalid`
and 429/stale fallback as `unavailable`/`stale` with recommendation withheld.

## Mobile Browser v2 P3-B focused evidence (2026-09-28)

| Item | Status | Evidence |
| --- | --- | --- |
| Hourly data validity vocabulary | PASS | ready/partial surface tests |
| Map recommendation eligibility | PASS | fresh all-unknown snapshot withheld |
| P3A regression | PASS | existing data-state tests |
| Unit | PASS | 15 tests |
| P0/data refresh/workspace refresh | PASS | 13 passed |
| Full Chromium / cross-browser / device / CI / production | NOT_RUN | separate gates |

P3-B keeps raw snapshot and hourly fact ownership unchanged.

## Mobile Browser v2 P2-A focused evidence (2026-09-28)

| Item | Status | Evidence |
| --- | --- | --- |
| Home context strip mobile matrix | PASS | 320/390/768/1024: 4 passed |
| Home context strip desktop behavior | PASS | 1200/1440: 2 passed; strip hidden, controls inline |
| Map-first regression | PASS | 16 passed |
| Content flow / home priority regression | PASS | 11 passed |
| Related desktop inline regression | PASS | 4 passed |
| `npm run check` | PASS | lint, typecheck, 64 Vitest files / 370 tests, build |
| `git diff --check` | PASS | clean |
| Full Chromium / cross-browser / device / CI / production | NOT_RUN | separate gates |

P2-A only reads existing night/model/time/update state. Provider, cache,
snapshot, score, forecast integrity, and fail-closed semantics are unchanged.
