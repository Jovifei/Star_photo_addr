# 《逐星》测试实施状态与待测试清单

> 对应方案：[`TEST_PLAN_V1.md`](./TEST_PLAN_V1.md)  
> 详细剩余任务：[`../project-tracking/TEST_BACKLOG.md`](../project-tracking/TEST_BACKLOG.md)  
> 项目总览：[`../project-tracking/PROJECT_STATUS.md`](../project-tracking/PROJECT_STATUS.md)  
> 状态日期：2026-08-22  
> 当前 main：`3fc11fcb00151b3ab8e80239137728132f51407e`  
> 当前测试工作分支：无（本轮直接提交 main）

## 状态定义

| 状态 | 含义 |
| --- | --- |
| PASS | 已自动/人工执行，有证据且通过 |
| IMPLEMENTED | 已写测试，等待 CI 或目标环境验证 |
| TODO | 尚未实现，但当前无外部阻塞 |
| MANUAL | 需要人工/真机，自动化不能完全替代 |
| BLOCKED | 缺少 ECS、域名、证书、授权数据或现场设备 |
| DEFERRED | 已安排在后续阶段；旧文档中的 SKIP 均视为此状态，不是取消 |

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
