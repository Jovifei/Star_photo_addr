# 《逐星》测试实施状态与待测试清单

> 对应方案：[`TEST_PLAN_V1.md`](./TEST_PLAN_V1.md)  
> 详细剩余任务：[`../project-tracking/TEST_BACKLOG.md`](../project-tracking/TEST_BACKLOG.md)  
> 项目总览：[`../project-tracking/PROJECT_STATUS.md`](../project-tracking/PROJECT_STATUS.md)  
> 状态日期：2026-08-22  
> 当前 main 已包含：PR #13 / `3a461c09a2cb450de710f87490ff9317b2d81a8e`  
> 当前测试工作分支：无

## 状态定义

| 状态 | 含义 |
| --- | --- |
| PASS | 已自动/人工执行，有证据且通过 |
| IMPLEMENTED | 已写测试，等待 CI 或目标环境验证 |
| TODO | 尚未实现，但当前无外部阻塞 |
| MANUAL | 需要人工/真机，自动化不能完全替代 |
| BLOCKED | 缺少 ECS、域名、证书、授权数据或现场设备 |
| DEFERRED | 已安排在后续阶段；旧文档中的 SKIP 均视为此状态，不是取消 |

## 已完成自动化工作包

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

## 测试发现并修复的 Bug

### BUG-T1：云量数组混入非法元素仍被接受

云量数组现要求与时间轴等长、每项只能为 `null` 或有限数字、至少包含一个有效数字，且时间值符合本地 ISO 墙钟格式。

### BUG-T2：跨浏览器配置误合并 Chromium 项目

Playwright 基础配置和覆盖配置曾拼接项目数组，使 Firefox/WebKit Job 意外执行 Chromium；现已显式替换 `projects`。

### BUG-T3：移动端强刷失败提示被旧地图 debounce 掩盖

现已记录上下文/边界请求签名、阻止同签名普通请求重复执行、在人工刷新 revision 到来时取消旧 debounce，并在 503 时保留旧 Canvas 和降级提示。

### BUG-T4：评分档位 E2E 对日期分布存在硬编码

旧测试固定取消“优先”档位；当当前日期对应的 Mock 分布中没有优先地点时，过滤结果合法地不变，测试却失败。现改为读取当前档位数量，动态选择第一个非空档位，并精确断言地图数量减少该档位的数量。业务过滤逻辑未被弱化。

## 剩余主测试项目

| ID | 项目 | 状态 | 原因 | 详细执行卡 |
| --- | --- | --- | --- | --- |
| DEV-IOS-001 | iPhone Safari 真机 | MANUAL | 地址栏、安全区、定位、触控、横竖屏、后台恢复 | [`TEST_BACKLOG`](../project-tracking/TEST_BACKLOG.md#2-dev-ios-001iphone-safari-真机) |
| DEV-ANDROID-001 | Android 多厂商 | MANUAL | Chrome/WebView、字体缩放、手势导航、后台恢复 | [`TEST_BACKLOG`](../project-tracking/TEST_BACKLOG.md#3-dev-android-001android-多厂商) |
| UX-ZOOM-001 | 200% 浏览器缩放 | MANUAL | planner、地图浮层和按钮裁切需人工观察 | [`TEST_BACKLOG`](../project-tracking/TEST_BACKLOG.md#4-ux-zoom-001200-浏览器缩放) |
| A11Y-COLOR-001 | 高对比和色觉模式 | MANUAL | 状态不得只依赖颜色 | [`TEST_BACKLOG`](../project-tracking/TEST_BACKLOG.md#5-a11y-color-001高对比与色觉模式) |
| DEP-ECS-001 | 阿里云大陆 ECS 出口 | BLOCKED | 需要真实 ECS 的 DNS/TCP/TLS/TTFB | [`TEST_BACKLOG`](../project-tracking/TEST_BACKLOG.md#6-dep-ecs-001阿里云大陆-ecs-海外出口) |
| DEP-TLS-001 | 正式域名 TLS | BLOCKED | 需要域名、证书链、跳转与续期 | [`TEST_BACKLOG`](../project-tracking/TEST_BACKLOG.md#7-dep-tls-001正式域名-tls) |
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

第一阶段自动化测试和项目跟踪体系均已进入 `main` 并达到当期门禁。上述剩余项目都有唯一 ID、前置条件、执行步骤、通过标准和证据要求；在实际完成前保持 MANUAL、BLOCKED 或 DEFERRED，不作为已验证能力对外声明。
