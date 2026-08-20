# 《逐星》测试实施状态与待测试清单

> 对应方案：[`TEST_PLAN_V1.md`](./TEST_PLAN_V1.md)  
> 状态日期：2026-08-20  
> 基线：`main@94043d8715faefd79306c77998741cad44425da9`

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

- `npm run lint`；
- `npm run typecheck`；
- Vitest unit；
- Next.js production build；
- Chromium desktop/mobile Playwright；
- Open-Meteo/NASA/Geocoding/AQI/Kp live smoke；
- Docker image、Compose、Nginx、`/healthz` container smoke；
- 当前视野推荐单元与 E2E。

## 第一批自动化实施范围

下一分支优先完成不需要新增商业服务或真机的项目：

| 工作包 | 状态 | 内容 |
| --- | --- | --- |
| T1 测试目录和 Vitest include | TODO | contract/integration 目录纳入执行 |
| T2 API 输入与错误集成测试 | TODO | 空坐标、越界、非法模型、429/超时 |
| T3 数据契约 Fixture | TODO | 云层缺失/错位/全空/非法值 |
| T4 GIBS 契约与缓存 | TODO | 缺图层、非法 XML、并发、冷却 |
| T5 核心导航 E2E | TODO | 三工作区参数保留、返回/前进 |
| T6 故障注入 E2E | TODO | 503 保留旧云量、状态接口降级 |
| T7 键盘与焦点 E2E | TODO | Dialog Esc、焦点回归、Tab 导航 |
| T8 跨浏览器冒烟 | TODO | WebKit/Firefox 的小规模核心流程 |
| T9 CI 失败产物 | TODO | trace/screenshot/video/html report |
| T10 测试状态回写 | TODO | 本文件更新 PASS/TODO/SKIP |

## 暂不在自动执行环境完成

| 项目 | 状态 | 原因/后续方式 |
| --- | --- | --- |
| iPhone 真机 Safari | MANUAL | 需要真机或云真机 |
| Android 多厂商真机 | MANUAL | 需要设备矩阵 |
| 阿里云大陆 ECS 海外出口 | BLOCKED | 需实际 ECS 执行 DNS/TLS/TTFB |
| TLS 正式域名 | BLOCKED | 需域名和证书 |
| k6 50/100 用户压力 | SKIP | 第一批先补契约与回归，后续独立执行 |
| 30 分钟 soak | SKIP | CI 成本高，计划每周工作流 |
| Sentry/Web Vitals | SKIP | 需要产品与隐私配置决定 |
| axe 自动无障碍 | SKIP | 需要新增依赖并更新 lockfile |
| 像素视觉基线 | SKIP | 需要稳定生成并审核二进制 baseline |
| Lighthouse CI | SKIP | 后续性能工作包 |
| Bortle/SQM 科学真值 | BLOCKED | 缺授权栅格及现场校准数据 |

## 退出标准

第一批分支转 Ready 前：

- 新增测试在 GitHub Actions 全绿；
- 原有 168+ unit 与 36+ Chromium E2E 不回归；
- production build、live smoke、container smoke 通过；
- 所有未完成项目在本文件标注 TODO/MANUAL/BLOCKED/SKIP；
- 新增测试和发现的 Bug 写入工程修改记录。
