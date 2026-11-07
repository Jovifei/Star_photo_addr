# 测试体系与改进路线（2026-08-23 审计）

> 回答四个问题：测试怎么写/从哪里测、使用中可能的 BUG 在哪、可借鉴的开源项目、下一步优化方向。

---

## 一、测试怎么写：四层结构（全部已就位，按层添加即可）

| 层 | 位置 | 跑法 | 测什么 | 例子 |
|---|---|---|---|---|
| **纯逻辑单测** | `tests/unit/*.test.ts` | `npx vitest run` | 评分模型、时间分组、坐标距离、文本归一化等纯函数 | `fireglow.test.ts`、`timelineTrack.test.ts`、`chineseText.test.ts` |
| **路由集成** | `tests/integration/` | 同上 | API 路由的参数校验、缓存头、降级行为（不 mock 上游） | `serverCache.test.ts` |
| **上游契约** | `tests/contract/` | 同上 | 外部 API（Open-Meteo/GIBS）返回结构的契约 | `gibsCapabilities.test.ts` |
| **浏览器 E2E** | `tests/e2e/*.spec.ts` | `npx playwright test` | 真实构建里的关键用户路径；自带 `mock-open-meteo.js`，**不吃配额** | `navigation.spec.ts`、`resilience.spec.ts` |

**写新测试的决策树**：是新算法/纯函数 → unit；是新 API 路由 → integration + 关键路径 e2e；是 UI 交互 → e2e（先在 `mock-open-meteo.js` 里补 mock 数据形状）。

**强制门禁（建议加入 CI）**：
1. `npx tsc --noEmit` + `npx eslint src`
2. `npx vitest run`
3. `npm run build`（⚠️ 本次审计发现：预渲染错误只有 build 能抓到，dev 模式完全正常）
4. `npx playwright test`

## 二、本次审计找到的 BUG（均已修复）

1. **生产构建崩溃（存量 BUG）**：`MapHeadline` 在 `/` 的静态预渲染中直接调用 `useSearchParams` 而无 Suspense 边界 → `next build` 失败。因为 e2e 很久没跑，一直没暴露。修复：拆出 `WorkspaceAwareHeadline` 子组件并用 Suspense 包裹，预渲染回退默认标题。
2. **卫星轨道刻度超限**：24 帧抽 8 个刻度的算法在末帧重复命中时产出 9 个。修复：等距取点（含首末）严格 ≤8。由新单测发现。
3. **`normalizeLocationTexts` 引用相等被破坏**：`undefined` 与 `null` 比较永不相等 → 每次水合都克隆对象，破坏下游 memo。由新单测发现。
4. **火烧云 API 内存缓存无上界**：长期运行会缓慢增长。修复：32 条 LRU 式淘汰。

**还在观察的已知限制**（不算 BUG，已记录在 OPERATIONS.md）：附近推荐自动补拉失败后不自动重试（手动刷新即可）；火烧云评分 v1 未含气溶胶。

## 三、可借鉴的开源项目（调研于 2026-08-23）

### 直接同类
- **[LibraHo/weather-sunset-predictor](https://github.com/LibraHo/weather-sunset-predictor)** —— 与我们的火烧云最接近：Open-Meteo + 太阳高度角 + 云层/能见度/湿度 + **周边格点数据**生成可解释评分。可借鉴：① 用周边 3×3 格点一致性代替单点（减少孤立噪点）；② 评分可解释文案的分层输出。
- **[r-ayin/sunset-prediction](https://github.com/r-ayin/sunset-prediction)** —— 5 因子晚霞质量引擎，宣称比付费 API 准 2.2 倍。可借鉴：因子权重的公开基准测试方法（回测历史 ERA5 晚霞案例）。
- **[giancarloerra/APD](https://github.com/giancarloerra/APD)** —— 天文摄影规划面板：多源天气 + 交互星图。可借鉴：多模型并排对比（ICON/GFS/AIFS 同屏）。
- **[pcnerd37/StargazeWeatherConditions](https://github.com/pcnerd37/StargazeWeatherConditions)**、**[irjudson/astronomus](https://github.com/irjudson/astronomus)** —— 观星条件聚合。可借鉴：**7Timer 晴天钟**（视宁度/透明度）作为第二数据源交叉验证——我们目前只有 Open-Meteo 单源。
- **[Clear Outside](https://clearoutside.com/)**（非开源，产品标杆）—— 逐小时云量分层展示的交互范本。

### 数据源增强（对应 OPERATIONS.md 规划项）
- **CAMS 气溶胶（AOD）**：Open-Meteo Air-Quality API 已含，接入后火烧云评分可去掉"能见度代理"。
- **7Timer**：免费视宁度/透明度预报，天文社区标准，可作为观星分的第二意见。

## 四、下一步优化路线（按优先级）

**P4a · 测试与稳定**
- CI 跑上面四条门禁（尤其 `npm run build`，本次教训）
- e2e 补三条关键路径：时间轴刻度点击→矩阵联动、主题切换→推荐口径、火烧云榜单→地图飞行
- 上游配额耗尽的演练用例（mock 429/限额响应，验证全链路降级文案）

**P4b · 数据准确性**
- ~~火烧云算法借鉴开源~~ **已完成（2026-08-23 v2）**：克隆 LibraHo/weather-sunset-predictor 至本地（`%TEMP%/fireglow-ref/`）提取并落地——云种加权画布（高×0.75/中×0.45/低×0.10）、分相最佳时刻（-6~-4° 高云爆发 / -2~+2° 中云爆发 / +2~+5° 低云时刻）、全晴无画布硬约束、三日概览结构；另按莉景天气参考图加入 20% 概率分级（五级色阶）、鲜艳度指数、金色/蓝色时刻与天文晨昏（小时级高度序列线性插值，实测比 SearchAltitude 快数百倍）。
- 火烧云：接入 CAMS AOD；参考 sunset-predictor 加周边格点一致性（需评估配额成本，每站 ×9 格点）
- 观星：引入 7Timer 视宁度/透明度做交叉分数（多源并排参考 APD）
- 评分回测脚本：用 ERA5 历史案例回归校准权重

**P4c · 体验**
- 时间轴轨道在触屏上的拖拽惯性 + 长按快进
- 观星计划“附近推荐”支持多锚点（按当前选中点而非第一个候选）
- 火烧云页接入今夜观测的取样点联动（选中点显示其晨昏窗口明细）
