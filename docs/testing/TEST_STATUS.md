# 《逐星》测试实施状态与待测试清单

> 对应方案：[`TEST_PLAN_V1.md`](./TEST_PLAN_V1.md)  
> 状态日期：2026-08-20  
> 实施分支：`test/quality-foundation-v1-20260820`  
> 基线：`main@18e03cdf82f0e3154664a4e96543f0a45e81444d`  
> 已验证功能 HEAD：`ac55dde8b110073f27d1d2f9ed668cf87275d342`  
> 最终功能验证：GitHub Actions Run `#112`（ID `32363556827`）

## 状态定义

| 状态 | 含义 |
| --- | --- |
| PASS | 已自动执行且通过 |
| IMPLEMENTED | 已写测试，等待 CI 或环境验证 |
| TODO | 尚未实现 |
| MANUAL | 需要人工/真机 |
| BLOCKED | 当前工具或环境不可执行 |
| SKIP | 本阶段明确跳过，记录原因 |

## 第一批自动化实施结果

| 工作包 | 状态 | 已验证内容 |
| --- | --- | --- |
| T1 测试目录和 Vitest include | PASS | `unit`、`contract`、`integration` 已统一纳入 `npm test` 和 `npm run check` |
| T2 API 输入与错误集成测试 | PASS | forecast 空值/错位/越界/非法模型、并发合并、429、stale；生产 API 边界 400/no-store |
| T3 数据契约 Fixture | PASS | 云层正常、错位、全空、混入字符串、非法时间轴 Fixture |
| T4 GIBS 契约与缓存 | PASS | parser、图层识别、并发合并、内存复用、失败后强刷冷却；真实 GIBS smoke 通过 |
| T5 核心导航 E2E | PASS | 既有 Chromium 参数保留测试；Firefox/WebKit `/sites` 上下文继承 |
| T6 故障注入 E2E | PASS | 强刷返回 503 时保留旧云量 Canvas，并持续显示降级信息 |
| T7 键盘与焦点 E2E | PASS | Dialog 初始焦点、Shift+Tab 焦点循环、Esc 关闭与焦点回归 |
| T8 跨浏览器冒烟 | PASS | Firefox Desktop 2 项、WebKit iPhone 13 2 项，共 4/4 通过 |
| T9 CI 失败产物 | PASS | Chromium 与跨浏览器 HTML、trace、video、screenshot artifact 可用 |
| T10 测试状态回写 | PASS | 本文件、执行记录与工程变更记录已写入精确结果和跳过边界 |

## 最终自动化结果

| 门禁 | 结果 |
| --- | ---: |
| production dependency audit | PASS |
| ESLint | PASS |
| TypeScript | PASS |
| Vitest | 28 files / 186 tests PASS |
| Next.js production build | PASS |
| Open-Meteo / NASA GIBS / Geocoding / AQI / Kp live smoke | PASS |
| Compose / Nginx / production image / `/healthz` | PASS |
| Chromium Desktop + Mobile | 54 PASS / 2 SKIP / 0 FAIL |
| Firefox Desktop + WebKit iPhone 13 | 4 PASS / 0 FAIL |

Chromium 的 2 项跳过沿用项目原有设备适用性条件，不属于失败。

## 本轮测试发现并修复的 Bug

### BUG-T1：云量数组混入非法元素仍被接受

旧契约只要求必需云层数组中“至少存在一个有限数字”，因此 `[10, "bad"]` 也可能进入 UI。现改为：

```text
数组长度 = 时间轴长度
+ 每项只能为 null 或有限数字
+ 至少一项为有限数字
+ 时间值必须符合本地 ISO 墙钟格式
```

### BUG-T2：跨浏览器配置误合并 Chromium 项目

`defineConfig(baseConfig, override)` 会合并项目数组，导致只安装 Firefox/WebKit 的 CI 仍尝试运行 Chromium。现改为展开基础配置并显式替换 `projects`。

### BUG-T3：移动端强制刷新失败提示被旧地图 debounce 掩盖

移动端布局稳定过程可能留下旧 `moveend/zoomend` 定时器。用户执行强制刷新并收到 503 后，旧定时器会立即发起非强刷请求，用缓存成功结果覆盖错误状态。现已：

- 记录同上下文/边界最后一次尝试签名；
- 禁止同一签名的非强刷重复请求；
- 新人工刷新 revision 到来时取消旧地图 debounce；
- 503 时继续显示旧 Canvas 和“已保留上一次结果”提示。

### 工程纠偏

首次测试提交意外改变 `tw-animate-css` 版本，后续已恢复为锁文件对应的 `^1.4.0`，未引入依赖漂移。

## 暂不在当前自动环境完成

| 项目 | 状态 | 原因/后续方式 |
| --- | --- | --- |
| iPhone 真机 Safari | MANUAL | WebKit 自动化不能完全替代真机地址栏、安全区、定位权限 |
| Android 多厂商真机 | MANUAL | 需要设备矩阵 |
| 阿里云大陆 ECS 海外出口 | BLOCKED | 需实际 ECS 执行 DNS/TCP/TLS/TTFB |
| TLS 正式域名 | BLOCKED | 需正式域名和证书 |
| k6 50/100 用户压力 | SKIP | 后续性能工作包 |
| 30 分钟 soak | SKIP | CI 成本较高，计划进入每周工作流 |
| Sentry / Web Vitals | SKIP | 需要产品、隐私和数据留存决策 |
| axe 自动无障碍 | SKIP | 需要新增依赖并更新 lockfile；本阶段已完成原生键盘/焦点测试 |
| 像素视觉基线 | SKIP | 需要稳定生成并人工审批二进制 baseline |
| Lighthouse CI | SKIP | 后续性能工作包 |
| 覆盖率门槛 | SKIP | 需要增加 `@vitest/coverage-v8` 并更新 lockfile |
| Bortle/SQM 科学真值 | BLOCKED | 缺授权栅格和现场校准数据 |

## 第一批退出结论

第一批当前可自动执行项目已达到退出标准：质量、真实数据源、容器、Chromium、Firefox、WebKit 均通过；未完成项目保持 MANUAL/BLOCKED/SKIP，不作为已验证能力对外声明。
