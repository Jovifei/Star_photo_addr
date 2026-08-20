# 《逐星》测试实施状态与待测试清单

> 对应方案：[`TEST_PLAN_V1.md`](./TEST_PLAN_V1.md)  
> 状态日期：2026-08-20  
> 实施分支：`test/quality-foundation-v1-20260820`  
> 基线：`main@18e03cdf82f0e3154664a4e96543f0a45e81444d`

## 状态定义

| 状态 | 含义 |
| --- | --- |
| PASS | 已自动执行且通过 |
| IMPLEMENTED | 已写测试，等待 CI 或环境验证 |
| TODO | 尚未实现 |
| MANUAL | 需要人工/真机 |
| BLOCKED | 当前工具或环境不可执行 |
| SKIP | 本阶段明确跳过，记录原因 |

## 已有基础

- lint、TypeScript、Vitest、Next.js production build；
- Chromium desktop/mobile Playwright；
- Open-Meteo/NASA/Geocoding/AQI/Kp live smoke；
- Docker image、Compose、Nginx、`/healthz` container smoke；
- 当前视野推荐 unit/E2E。

## 第一批自动化实施状态

| 工作包 | 状态 | 本分支实现 |
| --- | --- | --- |
| T1 测试目录和 Vitest include | IMPLEMENTED | `contract`、`integration` 已纳入 `npm test` 与 `npm run check` |
| T2 API 输入与错误集成测试 | IMPLEMENTED | forecast 400/并发/429/stale；生产服务 API 边界 400 |
| T3 数据契约 Fixture | IMPLEMENTED | 云层错位、全空、混入字符串、非法时间轴 Fixture |
| T4 GIBS 契约与缓存 | IMPLEMENTED | 复用既有 parser/cache 测试；跨流程由 CI/live smoke 继续验证 |
| T5 核心导航 E2E | IMPLEMENTED | 复用既有参数保留测试；新增 Firefox/WebKit `/sites` 浏览器流程 |
| T6 故障注入 E2E | IMPLEMENTED | 强刷返回 503 时旧云量 Canvas 保留并显示降级信息 |
| T7 键盘与焦点 E2E | IMPLEMENTED | Dialog 初始焦点、焦点循环、Esc 关闭与焦点回归 |
| T8 跨浏览器冒烟 | IMPLEMENTED | Firefox Desktop + WebKit iPhone 核心流程 |
| T9 CI 失败产物 | IMPLEMENTED | Chromium/跨浏览器 HTML、trace、video、screenshot artifact |
| T10 测试状态回写 | IMPLEMENTED | 本文件和执行记录已更新，待 CI 后改为 PASS/FAILED |

## 本轮发现并修复的 Bug

- Open-Meteo 必需云量数组只检查“至少存在一个数字”，因此 `[10, "bad"]` 会被错误接受；现在要求数组与时间轴等长，且每个元素只能是 `null` 或有限数，并至少包含一个有效数值。
- 第一次测试提交曾意外改变 `tw-animate-css` 版本；已在后续提交恢复为锁文件对应的 `^1.4.0`，不引入依赖漂移。

## 暂不在自动执行环境完成

| 项目 | 状态 | 原因/后续方式 |
| --- | --- | --- |
| iPhone 真机 Safari | MANUAL | WebKit 自动化不能完全替代真机地址栏、安全区、定位权限 |
| Android 多厂商真机 | MANUAL | 需要设备矩阵 |
| 阿里云大陆 ECS 海外出口 | BLOCKED | 需实际 ECS 执行 DNS/TLS/TTFB |
| TLS 正式域名 | BLOCKED | 需域名和证书 |
| k6 50/100 用户压力 | SKIP | 后续性能工作包 |
| 30 分钟 soak | SKIP | CI 成本高，计划每周工作流 |
| Sentry/Web Vitals | SKIP | 需要产品与隐私配置决定 |
| axe 自动无障碍 | SKIP | 需要新增依赖与 lockfile；本轮先做原生键盘/焦点测试 |
| 像素视觉基线 | SKIP | 需要稳定生成并人工审批二进制 baseline |
| Lighthouse CI | SKIP | 后续性能工作包 |
| 覆盖率门槛 | SKIP | 需要增加 `@vitest/coverage-v8` 并更新 lockfile |
| Bortle/SQM 科学真值 | BLOCKED | 缺授权栅格及现场校准数据 |

## 分支退出标准

- GitHub Actions quality、live-data、container、Chromium、Firefox/WebKit 全绿；
- 原有 unit/E2E 不回归；
- 新增失败注入和契约测试通过；
- CI 结果回写为 PASS，并记录精确数量；
- 未完成项保持 MANUAL/BLOCKED/SKIP，不虚报完成。
