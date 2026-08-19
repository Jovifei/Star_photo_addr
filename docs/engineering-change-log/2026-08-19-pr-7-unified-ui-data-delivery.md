# 工程修改跟踪：PR #7 统一界面、数据获取刷新与阿里云部署加固

> 文档编号：`ENG-CHANGE-2026-08-19-PR7`  
> 仓库：`Jovifei/Star_photo_addr`  
> 目标分支：`main`  
> 功能分支：`codex/unify-stargazing-theme-20260819`  
> Pull Request：`#7`  
> 对比基线：`3c0b92299863dd10bdaaaf703ca6bade72997fc3`  
> 功能变更终点：`4e7f943d15a7832edbb2b5aafe08d23f24e8700e`  
> 记录范围：`3c0b92299863dd10bdaaaf703ca6bade72997fc3...4e7f943d15a7832edbb2b5aafe08d23f24e8700e`

本文档用于记录两次提交之间的**修改目的、Bug 根因、修复方式、新增功能、数据边界、验证方式和回滚路径**。本文件本身属于合并前的追踪文档提交，不改变运行时逻辑；最终合并提交由 PR #7 在 GitHub 上生成。

---

## 1. 修改背景与总体目的

此前项目已经具备今夜云量、观星地点、卫星图层和观星计划等功能，但不同工作区之间仍存在命名、视觉、状态传递和数据刷新语义不一致的问题；同时，在计划部署到阿里云 ECS 后，还需要解决以下工程问题：

1. 用户无法明确判断天气、卫星云图和光污染图层当前是否真正可用；
2. 页面上的“刷新”可能只更新部分数据，导致云量、卫星时次、推荐评分仍使用旧缓存；
3. 多个访客同时访问或连续强制刷新时，可能放大对 Open-Meteo、NASA GIBS 等上游的请求；
4. 容器存活状态与外部数据源状态混在一起，外部源短时波动可能被误判为应用故障；
5. `/`、`/sites`、`/planner` 及历史兼容入口之间跳转时，地点、观测夜、模型和时次可能丢失；
6. 缺少适合生产部署后的数据源冒烟检查、运维文档和可回溯的工程变更记录。

本轮修改的总体目标是：

- 将总品牌统一为 **逐星**；
- 将产品工作区统一为 **今夜观测 / 暗夜选址 / 观星计划**；
- 建立可诊断、可刷新、可降级的数据获取链路；
- 明确天气预报、卫星观测、夜光参考和 Bortle/SQM 的科学边界；
- 补齐 Docker、Nginx、健康检查和阿里云部署后的验证路径；
- 形成可供后续版本审计的变更记录。

---

## 2. 最终有效变更范围

### 2.1 产品界面与导航

- 统一顶部导航、品牌名称、工作区名称和页面 SEO 文案；
- 统一地图、侧栏、小时矩阵、规划抽屉、按钮、表格和响应式视觉；
- 增加统一设计令牌、焦点态和减弱动效支持；
- `/sites`、`/viirs`、`/stargazing-finder-dark` 保留为兼容入口；
- 跨工作区保留以下状态：
  - 地点经纬度；
  - 地点名称和海拔；
  - 观测夜；
  - 天气模型；
  - 预报时次；
  - 卫星观测时次；
  - 当前图层模式。

### 2.2 天气与云量数据

- `GET /api/forecast` 统一处理 ICON、GFS、AIFS 和 Best Match；
- 对 Open-Meteo 返回数据进行结构和字段完整性校验；
- 不再仅以 HTTP 200 判断天气正常，必须检查以下逐小时序列是否存在有效数字：
  - `cloud_cover`：总云量；
  - `cloud_cover_low`：低云；
  - `cloud_cover_mid`：中云；
  - `cloud_cover_high`：高云；
- 按模型限制最大预报天数，防止生成上游不支持的请求；
- 为天气、气压、空气质量、地理编码、空间天气等服务端接口加入超时和缓存语义；
- 上游失败时，只在存在明确的旧缓存且未超过允许时限时返回 `stale` 数据。

### 2.3 卫星云图与光污染

- 卫星云图使用 NASA GIBS Himawari AHI Band 13；
- 卫星时次目录与数值天气预报使用独立时间域；
- 光污染模式使用 VIIRS 2023 视觉参考图层；
- VIIRS 图层用于观察人工夜光空间分布，不等同于现场 Bortle 或 SQM 实测；
- 单个瓦片错误不会立即卸载整个光污染图层，连续错误才标记为降级；加载恢复后自动回到可用状态；
- Bortle/SQM 仅在安装并显式启用来源和许可均可核验的本地栅格后显示；未安装时明确显示无数据，不通过颜色推测或伪造等级。

### 2.4 数据源诊断与刷新

新增并统一以下运行时诊断接口：

| 接口 | 用途 | 说明 |
|---|---|---|
| `GET /api/data-status` | 推荐的运维诊断入口 | 检查天气、卫星、夜光、中文注记和本地暗夜栅格 |
| `GET /api/data-status?refresh=1` | 人工强制复检 | 受服务端冷却保护，避免被连续请求放大 |
| `GET /api/data-sources/health` | 兼容入口 | 保留旧客户端和已有部署调用 |
| `GET /healthz` | 应用/容器存活检查 | 不依赖 Open-Meteo 或 NASA，外部源波动不会触发容器重启 |

数据源状态使用以下等级：

- `available`：接口与关键数据字段正常；
- `degraded`：可访问，但数据不完整、使用旧缓存或存在局部异常；
- `unconfigured` / `not-installed`：可选能力未配置，例如本地 Bortle/SQM 栅格；
- `error`：请求失败、超时或结构无法识别。

刷新链路调整为：

```text
用户点击“刷新数据”
→ 选中地点天气预报 refresh=1
→ 周边云量网格 refresh=1
→ 观星地点评分快照 refresh=1
→ 卫星时次目录 refresh=1（当前卫星模式）
→ 数据源状态 refresh=1
→ 保留失败前已经显示的有效数据，并标记降级/旧缓存
```

### 2.5 服务端保护

- 数据源探测加入超时；
- 加入内存 TTL 缓存；
- 同时到达的相同探测请求共用同一个上游任务；
- 强制刷新加入最短冷却时间；
- 响应头暴露缓存状态、刷新抑制状态和下一次允许刷新时间；
- 错误响应不回传完整上游 URL、上游正文、HTML 错误页或内部堆栈。

### 2.6 阿里云与 Docker 部署

新增或完善：

- `docs/ALIYUN_DEPLOYMENT.md`；
- 多阶段 `Dockerfile`；
- `docker-compose.yml` 主服务和观星快照 worker；
- 持久化观星快照 volume；
- 容器级 `/healthz` 健康检查；
- Nginx、HTTPS、安全组和反向代理建议；
- `.env.example` 中的数据源探测超时、缓存 TTL、强制刷新冷却和可选图层配置；
- `scripts/check-data-sources.mjs` 发布后冒烟脚本；
- GitHub Actions 中的真实上游 `live-data-smoke` 检查。

---

## 3. Bug 与修复记录

### BUG-01：兼容入口跳转后观测上下文丢失

**现象**  
从 `/sites`、`/viirs` 或 `/stargazing-finder-dark` 进入统一产品后，地点、观测夜、模型或当前时次可能被重置。

**根因**  
历史入口只负责页面跳转，没有使用统一的 URL 构造逻辑传递完整观测上下文。

**修复**  
新增共享产品路由构造函数，所有工作区和兼容入口统一序列化地点、夜晚、模型、预报时次、卫星时次和图层参数。

**回归验证**  
`tests/e2e/navigation.spec.ts` 覆盖兼容入口、历史链接和跨工作区上下文保留。

---

### BUG-02：相同查询参数在不同工作区被误判为已处理

**现象**  
当两个工作区使用相同查询字符串时，状态桥接可能认为参数已经处理过，导致目标工作区不重新应用状态。

**根因**  
桥接去重键只考虑查询参数，没有纳入当前产品工作区。

**修复**  
去重和规范化逻辑同时考虑路由/工作区及查询参数，避免跨页面误复用处理状态。

---

### BUG-03：历史 `night` 与过期 `forecastTime` 产生规范化竞态

**现象**  
打开旧书签时，历史观测夜和已经超出有效范围的预报时次可能触发重复规范化，出现状态抖动或重复加载。

**根因**  
URL 恢复、当前日期修正和 Store 状态更新之间缺少明确的单次处理边界。

**修复**  
收敛 URL 恢复顺序，增加已处理状态和目标工作区判断，并在规范化后使用统一 URL 替换。

---

### BUG-04：手动刷新只更新部分数据

**现象**  
天气预报已经刷新，但地图网格、观星评分或卫星目录仍可能显示旧数据。

**根因**  
刷新动作分散在多个组件中，没有共享刷新版本，也没有为所有相关接口统一附加 `refresh=1`。

**修复**  
在 Store 中引入统一刷新动作和刷新修订号；地点预报、云量网格、评分快照、卫星时次和数据源状态共同响应一次人工刷新。

**回归验证**  
`tests/e2e/data-refresh.spec.ts` 断言天气、数据状态和观星评分快照均收到强制刷新请求。

---

### BUG-05：AIFS 返回无有效云量但仍可能被视为可用

**现象**  
真实上游冒烟中曾出现 AIFS 请求返回时间序列，但 `cloud_cover` 没有有效数字。

**根因**  
AIFS 使用了不适合当前请求语义的模型参数，并且早期检查只验证响应结构，没有验证云量字段内容。

**修复**  
将 AIFS 映射为 `ecmwf_aifs025_single`；将总云量、低云、中云和高云全部纳入必需字段完整性检查。

**回归验证**  
`tests/unit/forecast.test.ts` 和 `scripts/live-smoke.mjs` 同时检查模型映射和真实云量字段。

---

### BUG-06：数据源诊断可能放大上游请求

**现象**  
多个访客同时打开页面或连续点击强制刷新时，可能重复访问 Open-Meteo、NASA GIBS 和第三方图层。

**根因**  
缺少同进程请求合并、TTL 缓存和强制刷新冷却。

**修复**  
实现服务端探测缓存、并发 promise 合并和刷新冷却；响应中返回 `cached`、`coalesced`、`refreshSuppressed` 和 `nextRefreshAt`。

---

### BUG-07：`/api/data-status` 通过重导出声明路由配置，生产构建失败

**现象**  
将 `dynamic` 从兼容路由重导出时，Next.js/Turbopack 无法静态分析 route segment config，生产构建门禁失败。

**根因**  
Next.js 要求 route segment config 在当前路由文件中以本地字面量声明。

**修复**  
在 `src/app/api/data-status/route.ts` 中本地声明：

```ts
export const dynamic = "force-dynamic";
```

并直接调用共享 `getDataSourceHealth()`，不再重导出路由配置。

**对应提交**  
`f7b0bcbe88ddc621d934d164fdd97ff42f977128`

---

### BUG-08：前端数据源复检存在旧请求覆盖新请求的竞态

**现象**  
首次检测尚未结束时再次复检，旧请求取消后的错误或结果可能覆盖后发请求。

**根因**  
组件没有记录当前请求所有权；Abort 后的异步回调仍可能更新状态。

**修复**  
使用 `AbortController` 引用判断请求所有权；只有最新请求可以写入状态；组件卸载时取消请求并清理计时器。

---

### BUG-09：夜光图层文案与真实数据年份不一致

**现象**  
旧断言仍期望“2016 夜光基准”，而当前默认光污染图层已统一为 VIIRS 2023 静态视觉参考。

**根因**  
图层实现和科学边界说明已经更新，但测试和部分文案未同步。

**修复**  
统一显示 VIIRS 2023，并明确“第三方视觉瓦片、非现场 Bortle/SQM”；同步 E2E 断言。

---

### BUG-10：评分时间滑窗测试依赖“聚合数量一定变化”

**现象**  
滑动评分时次后，数据时次已经变化，但由于模拟分布碰巧产生相同聚合数量，测试误判失败。

**根因**  
测试使用了不稳定的间接指标，而不是验证当前时次、快照焦点和状态。

**修复**  
将 E2E 重点放在 `data-score-time`、快照焦点和可用状态；模拟数据按时次生成可辨识分布。

---

### BUG-11：刷新 E2E 仍拦截旧诊断接口

**现象**  
运行时代码已经调用 `/api/data-status`，但刷新 E2E 仍拦截 `/api/data-sources/health`，导致页面无法得到模拟状态，桌面和移动端均超时找不到“天气 / Open-Meteo”。

**根因**  
增加推荐运维入口后，测试 mock 未同步到新的规范接口。

**修复**  
将 `tests/e2e/data-refresh.spec.ts` 的拦截路径改为 `/api/data-status**`，兼容接口继续由服务端保留，但测试以运行时实际调用为准。

**对应提交**  
`4e7f943d15a7832edbb2b5aafe08d23f24e8700e`

---

## 4. 实施期间 CI 问题记录

这些问题未必出现在最终差异中，但属于工程过程的重要回溯信息：

1. **误加入重复的 `cache.ts`**：缺少相邻 `constants`、`types` 模块，导致 TypeScript 门禁失败；最终删除重复模块，保留现有 `cache.js` 实现。
2. **React Hooks lint：effect 内同步 setState**：数据源初始加载和快照加载在 effect 主体中同步更新状态，触发 React 19 lint；改为异步请求回调或零延时任务后更新。
3. **AIFS 真实冒烟失败**：发现响应存在但云量字段为空，促使模型参数和字段完整性检查同时加固。
4. **旧 E2E 文案断言**：2016/2023 光污染语义变化后，旧断言造成假失败；测试改为验证当前真实语义。
5. **规范诊断接口迁移后 mock 未同步**：`/api/data-status` 成为实际调用入口后，刷新 E2E 仍拦截旧接口；已在功能变更终点提交中修复。

原则：CI 失败必须先区分**产品逻辑缺陷、接口契约变化、测试假设过时、外部源瞬时波动**，不能通过简单降低断言或跳过测试掩盖问题。

---

## 5. 数据语义与边界

### 5.1 数值天气预报

- 来源：Open-Meteo；
- 类型：未来逐小时数值预报；
- 主要字段：总云量、低/中/高云、降水、能见度、风、温湿度；
- 不等同于卫星实况。

### 5.2 卫星云图

- 来源：NASA GIBS Himawari AHI Band 13；
- 类型：实际观测时次；
- 与天气模型的未来时次必须分开展示。

### 5.3 光污染参考

- 默认图层：VIIRS 2023 静态视觉参考；
- 用途：观察人工夜光空间分布；
- 不代表实时光污染，也不能直接当作 Bortle/SQM 实测值。

### 5.4 Bortle/SQM

- 仅使用来源和许可可核验的本地栅格；
- 未安装时返回未配置/未安装；
- 页面不得从普通夜光颜色推测并显示伪造等级。

---

## 6. 兼容性说明

- 保留旧路由入口；
- 保留 `/api/data-sources/health`，新监控推荐使用 `/api/data-status`；
- 未修改观星评分公式和建议阈值；
- 环境变量新增项均为增量配置；
- 未引入数据库 schema 迁移；
- 观星快照使用文件和 Docker volume 持久化，升级不要求清空历史快照。

---

## 7. 主要文件索引

### 数据与接口

- `src/lib/forecast.ts`
- `src/lib/dataSourceHealth.ts`
- `src/lib/dataSourceStatus.ts`
- `src/lib/serverCache.ts`
- `src/lib/gibs.ts`
- `src/lib/lightPollution.ts`
- `src/lib/stargazingFinderWeather.ts`
- `src/app/api/forecast/route.ts`
- `src/app/api/data-status/route.ts`
- `src/app/api/data-sources/health/route.ts`
- `src/app/api/satellite/times/route.ts`
- `src/app/api/observing/snapshot/route.ts`

### 前端刷新与状态

- `src/lib/store.tsx`
- `src/components/CloudControl.tsx`
- `src/components/SatelliteLayer.tsx`
- `src/components/ObservingSitesLayer.tsx`
- `src/components/ObservingViirsLayer.tsx`
- `src/components/ProductStateBridge.tsx`

### 部署与验证

- `Dockerfile`
- `docker-compose.yml`
- `.env.example`
- `.github/workflows/ci.yml`
- `docs/ALIYUN_DEPLOYMENT.md`
- `scripts/check-data-sources.mjs`
- `scripts/live-smoke.mjs`
- `tests/e2e/data-refresh.spec.ts`

---

## 8. 合并门禁

合并到 `main` 前，PR #7 的最终 HEAD 必须满足：

```bash
npm ci
npm run check
npm run test:e2e
npm run test:live
```

部署后必须满足：

```bash
docker compose up --build -d
curl -fsS http://127.0.0.1:3100/healthz
node scripts/check-data-sources.mjs http://127.0.0.1:3100
```

GitHub Actions 中以下 job 必须全部成功：

- `quality`
- `live-data-smoke`
- `e2e`

最终结果以 PR #7 对应最终 HEAD 的 GitHub Checks 为准；如果分支在校验后再次移动，必须重新等待新一轮门禁，不能沿用旧提交的成功结果。

---

## 9. 回滚方案

### 9.1 整体回滚

如合并后出现阻断性问题，优先通过 GitHub revert 本次 PR 的 merge commit，避免直接强推 `main`。

### 9.2 数据源能力降级

- Open-Meteo/NASA 临时异常：保留应用进程，展示降级或旧缓存，不重启容器；
- 光污染第三方瓦片异常：标记降级，不影响天气和卫星云图；
- 本地暗夜栅格异常：关闭对应 `NEXT_PUBLIC_ASSET_*` 开关，恢复“未安装/无数据”；
- 快照 worker 异常：主站仍可运行，修复 worker 后重新生成快照。

### 9.3 配置回滚

新增环境变量都有默认值；删除新增变量后应用可使用默认超时、TTL 和冷却参数。天地图、本地 VIIRS/World Atlas 等仍为可选能力。

---

## 10. 后续工程修改记录规范

以后每次较大功能、Bug 修复或部署变更，在合并前于本目录新增一份文件：

```text
docs/engineering-change-log/YYYY-MM-DD-<PR或主题>.md
```

至少包含：

1. 对比基线提交和功能终点提交；
2. 修改背景与目标；
3. 新增/删除/修改的核心能力；
4. Bug 现象、根因、修复和回归测试；
5. API、配置和数据语义变化；
6. 风险边界；
7. 验证命令和 CI 门禁；
8. 回滚方式；
9. 关键文件索引。

这样可以通过“提交范围 + PR + 文档编号”快速还原每次工程修改的原因和验证依据，避免未来只看到代码差异却无法判断当时为什么修改。
