# 生产观星指数与全数据源审计：2026-09-13

> 审计性质：只读诊断，不修改评分代码、不删除缓存、不重启生产容器、不部署修复。
> 代码基线：`main@7afa8392243e144f8c86633be0c06e0f49c570e5`；运行时构建：`v1.0.14 / 39338495db0d`。
> 生产地址：`https://photo.joviluma.com`。

## 1. 结论先行

用户看到“观星分 94、页面说几乎无云，现场低/中层云较多”的现象，不能归因于单一原因。审计确认同时存在以下生产风险：

1. 地图快照评分只使用 Open-Meteo `cloud_cover` 总云量，没有使用已经请求到的低云/中云/高云；
2. 候选列表、详情页和地图使用两套不同评分模型，候选列表还取整晚最佳 3 小时，不等于用户到场时刻；
3. 生产曾出现 `stale=true` 的观星快照仍携带 94 分，前端仍可展示具体高分；
4. `/api/forecast` 的磁盘 fallback 没有执行 6 小时 stale 年龄门槛，超过数天的旧文件仍可能在上游失败时被返回；
5. `CandidateList` 与 `StarWindowTable` 的 effect 会因 `forecastCache` 每次变化重复请求，已造成页面级请求风暴和 Open-Meteo 429；
6. 首页默认 ICON、worker GFS 7 天快照和候选列表固定 ICON 请求不是同一个快照链，健康状态“available”不能证明 282 个点位、当前模型或当前时次都新鲜。

当前没有发现 Open-Meteo、NASA GIBS 或 NOAA 被篡改的证据；问题主要是预报模型不确定性、山地网格误差、缓存/请求治理和产品语义过度确定。

## 2. 事故复现证据

### 2.1 生产返回 stale 94 分

只读请求：

```text
GET /api/observing/snapshot
    ?date=2026-09-12&days=1&model=icon&time=2026-09-12T21:00
```

生产返回 `HTTP 200`，但响应头/正文为：

```text
X-Observation-Cache: disk
X-Data-Stale: true
body.stale: true
generatedAt: 2026-09-13T06:56:36Z
finder-088-location / 利川星斗山:
  score: 94
  cloud: 8
  weatherRisk: 100
  confidence: high
  validHours: 1
```

94 分可以由当前地图公式精确还原：

```text
cloudScore = 100 - 8 = 92
score = round((92 × 0.55 + 100 × 0.15) / 0.70) = 94
```

这证明“stale 快照仍带具体高分”是真实行为，不是推测。`scoreObservingSiteAtTime()` 对只含一个时次的结果固定返回 `confidence: "high"`，也没有把层云字段纳入可信度。

### 2.2 同一地点、同一时次的模型分歧

以利川星斗山目录坐标 `30.182,108.882`、2026-09-12 21:00（北京时间）为例，直接请求 Open-Meteo 各模型得到：

| 模型 | 总云 | 低云 | 中云 | 高云 | 模型海拔 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Best Match | 91 | 91 | 13 | 1 | 1402m |
| ICON | 8 | 0 | 3 | 4 | 1402m |
| GFS | 100 | 100 | 0 | 10 | 1402m |
| AIFS | 28 | 23 | 13 | 1 | 1402m |

同一地点同一时次总云量跨越 8–100。目录机位海拔约 1681m，模型网格海拔约 1402m，且模型坐标与机位相差数公里。Open-Meteo 官方说明总云量是面积覆盖率，模型有不同分辨率、变量和更新时间；山地局地云不能被单一网格预报等同为现场观测。

### 2.3 生产请求风暴与限流

ECS 访问日志审计显示，2026-09-12 22:53–22:55（北京时间）一次页面访问产生约 164 次 `/api/forecast` 请求，其中 133 次 200、30 次 Nginx 429、1 次 503；同一地点重复请求 7–13 次。应用日志同时出现：

```text
Open-Meteo HTTP 429: Too many concurrent requests
```

此外，应用日志在 2026-09-12 14:10（北京时间）出现 `Minutely API request limit exceeded`，在 22:53 出现 `Too many concurrent requests`。这会使同一页面混入成功、失败、旧缓存和不同时间到达的数据。

ECS `/opt/star-photo/.env` 未配置 `OPEN_METEO_API_KEY`，当前使用匿名配额；这放大了页面请求风暴对分钟/并发限额的影响。生产 `SNAPSHOT_INTERVAL_MS=3600000`，worker 每小时运行一次。

根因定位到 `CandidateList.tsx` 与 `StarWindowTable.tsx`：两者都监听 `forecastCache` 变化并请求所有缺失候选，没有共享的 in-flight 请求表；每收到一个地点就重新渲染，尚未完成的地点会再次发起请求。

## 3. 数据源逐项审查

| 数据源 | 真实性/用途 | 当前刷新与证据 | 风险结论 |
| --- | --- | --- | --- |
| Open-Meteo surface | 真实官方数值天气 API；总/低/中/高云、雨、风、能见度 | `/api/data-status` 只探测杭州一个坐标、Best Match 和四个云量数组；业务天气缓存新鲜 10 分钟、stale 6 小时 | 数据真实但不是现场观测；模型之间差异很大，健康探测覆盖不足 |
| Open-Meteo ICON/GFS/AIFS | 真实模型输出，更新周期和分辨率不同 | 当前直接请求可返回，但页面没有记录 provider run/发布时间；候选列表固定 ICON，worker 使用 GFS | 单模型 94 分不应表达为确定结论；需显示模型分歧和实际网格点 |
| Open-Meteo pressure-level | 真实模式垂直剖面，用于云海层位 | 单点缓存 10 分钟，失败回退 6 小时；不是探空或现场测量 | 可解释垂直模式证据，但不能证明现场云底/云顶 |
| Open-Meteo CAMS AQI | 真实区域空气质量模型，辅助透明度 | 10 分钟缓存、失败 6 小时；不在 `/api/data-status` 诊断范围 | 不是现场空气站，也不参与核心地图观星分 |
| NASA GIBS Himawari | 真实卫星云观测/红外云顶图 | 目录缓存 15 分钟、旧目录可回退 24 小时；生产曾比直连最新时次落后约 30–50 分钟，仍标 `stale=false` | 能做现场复核参考，但必须显示帧年龄；云顶红外图不等同地面低云量 |
| NASA GIBS VIIRS Black Marble | 真实 NASA 夜光影像 | 2016 静态基准；不参与天气评分 | 当前静态语义基本正确，不是实时光污染 |
| darkmap.cn VIIRS 2023 WMTS | 真实第三方视觉瓦片 | 只探测固定一张瓦片，无产品更新时间 | 只能作年度空间参考，不是现场 Bortle/SQM 或实时云量 |
| 本地 Bortle/SQM 栅格 | 生产未安装 | 明确 `not-installed` | 这是正确降级，没有伪造暗空数值 |
| NOAA SWPC Kp | 真实全球行星 Kp 指数 | 15 分钟缓存、失败 12 小时；接口正常 | 不参与云量分；`time_tag` 未显式补 `Z`，浏览器可能产生 UTC+8 解释偏移 |
| 地理编码/地点目录 | Open-Meteo 真实城市 API + 本地公开资料目录 | 目录结果优先，HTTP 边缘缓存约 1 小时 | 只负责坐标候选；静态 282 点缺少逐条 `sourceUrl/verifiedAt/evidenceLevel` |

## 4. 刷新、缓存和评分链风险

### P0

- **过期磁盘 forecast 无年龄门槛**：生产 `forecast-cache` 共有 68 个文件，33 个超过 6 小时、32 个超过 24 小时、15 个超过 7 天，最老约 206.9 小时。`src/app/api/forecast/route.ts` 在上游失败时只要文件存在就返回 stale，不校验 `fetchedAt` 年龄。
- **stale 高分仍可展示**：观测快照整体只标一个 `stale`，已成功批次的单点分数继续保留；候选列表/详情不检查 `metadata.stale`，因此旧数据仍可进入 `evaluateNight` 并显示推荐。
- **地图评分忽略分层云**：`src/lib/observingSites.ts` 的地图评分只读取总云量；低/中/高云虽被请求，却不参与地图分数或 focus 时次可信度。
- **请求风暴触发上游限流**：候选加载的两个 effect 没有共享请求去重，造成并发/分钟 429，继而触发部分成功与旧缓存混用。

### P1

- **两套评分模型**：地图使用 `observingSites.ts`；候选列表、详情和 CloudTimeline 使用 `scoring.ts`。后者取整晚天文暗夜中最高 3 小时的加权分；当前时次旁边显示的“观星分”其实可能是整晚最佳窗口分。
- **乐观缺失值**：`scoring.ts` 对缺失能见度、湿度、露点、风和降水概率使用默认值；finder 批量链只检查 `hourly.time`，层云数组/长度/坐标/时区/海拔不完整时会填 null。
- **模型与 worker 不一致**：首页默认 ICON，worker 只预热 GFS 7 天快照，候选列表固定 ICON 14 天预报；没有统一的实际读取键。
- **时间元数据不足**：`fetchedAt/generatedAt` 是应用收到/生成时间，不是 provider 模型运行时间；没有显示 provider run、模式网格坐标、请求点距离和模型海拔差。
- **云图时间戳可能被伪新**：`fetchCloudGrid()` 用当前客户端时间重写 `fetchedAt`，不传递 `/api/forecast` 的 stale/原始抓取时间。
- **健康探测覆盖不足**：`/api/data-status` 不检查 ICON/GFS/AIFS、282 点批量成功率、降水/风/能见度、AQI、Kp、pressure、CloudSea、Fireglow、观测快照或 geocode。
- **卫星年龄无门槛**：GIBS capabilities 可用不等于最新帧可用；生产曾出现约 30–50 分钟时次差，仍标记 available/stale=false。

## 5. 已执行的只读验证

- 本地静态审查：`observingSites.ts`、`scoring.ts`、`forecast.ts`、`stargazingFinderWeather.ts`、`cloudGrid.ts`、所有相关 API route、worker 和客户端刷新 effect。
- 生产 API：`/healthz`、`/api/data-status`、`/api/forecast`、`/api/pressure-forecast`、`/api/air-quality`、`/api/space-weather/kp`、`/api/satellite/times`、`/api/observing/snapshot`。
- 生产构建身份：`v1.0.14 / 39338495db0d`；app/worker healthy，ECS worker 重启次数 0，服务器工作树 `main` clean。
- 当前 Compose 使用 `star-photo_observing-snapshots` 命名卷（约 43 MB）；另一个旧卷 `star-photo-addr_observing-snapshots` 未被使用。本轮未删除或改写任何快照卷。
- `npm run test:live`：Open-Meteo 四模型/压力层/AQI、NASA GIBS、NOAA Kp 均返回成功；`npm run check:data-sources -- https://photo.joviluma.com` 通过。
- 这些结果证明连通性、字段结构和运行身份，不证明单点预报准确，也不能替代现场云量或地面站观测。

## 6. 修复建议（待确认，不在本轮执行）

### P0：先阻断错误高分和请求风暴

1. 建立统一的 `model + 坐标 + days` in-flight 请求层，移除 `CandidateList` / `StarWindowTable` 的重复 effect 竞态。
2. `api/forecast` 的磁盘 fallback 必须校验 `fetchedAt` ≤ 6 小时；超龄直接返回明确不可用，不再参与评分。
3. 所有客户端遇到 `metadata.stale=true`、snapshot `stale=true` 或批次不完整时，禁止显示正常高分；至少降为“数据过期/数据不足”。
4. 统一地图、候选列表、详情页评分模型，并明确区分“当前时次分”和“整晚最佳窗口分”。

### P1：让分数可解释、可复核

1. 分数纳入总/低/中/高云、降水概率、能见度和风；关键字段缺失 fail-closed，不以默认晴朗补值。
2. 保存并展示 provider 模型、模型运行/可用时间、实际网格坐标、网格海拔、与机位距离和 stale 状态。
3. 对 ICON/GFS/Best Match/AIFS 做模型分歧检测；分差大时降低置信度并禁止“强烈推荐”。
4. 让 worker 预热首页实际使用的模型/时次，或统一服务端快照键；worker 健康检查加入最近成功快照时间和成功点位数。
5. 扩大 `/api/data-status`：按代表性高山/平原/海岛坐标检查所有模型和关键字段，并加入 AQI/Kp/pressure/Fireglow/CloudSea/观测快照/geocode。
6. 卫星状态加入最新帧年龄阈值和瓦片实际读取检查；NOAA 时间统一按 UTC 解析。

### P2：建立真实准确率闭环

使用 Open-Meteo Historical Forecast / Previous Runs 与 Himawari、地面站和用户现场记录，对过去 30–90 天按地点、模型、提前量统计“预测低云/中云为空但现场有云”的失败率；在有样本前，不把 85+ 分包装为现场保证。

## 7. 本轮边界

本轮没有修改源码、评分算法、环境变量或生产容器，也没有删除任何快照/forecast-cache 文件。用户若确认实施 P0 修复，应另开 `codex/` 分支，先补失败测试，再按 `main` 门禁、版本记录和部署手册发布。
