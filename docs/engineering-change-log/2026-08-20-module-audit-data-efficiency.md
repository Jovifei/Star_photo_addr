# 工程修改跟踪：模块功能复审、数据刷新降载与阿里云部署加固

> 文档编号：`ENG-CHANGE-2026-08-20-MODULE-DATA-EFFICIENCY`  
> 仓库：`Jovifei/Star_photo_addr`  
> 基线：`main@2910b2369beb9163e7efbdbf4d59f7f064e9ac56`  
> 提交策略：本轮不新建长期分支，完成验证后以单个原子提交直接快进 `main`。

## 1. 修改目的

在上一轮数据链路加固基础上继续按模块复审运行行为，重点检查：

- 今夜观测地图、逐小时播放和辅助指标是否产生重复请求；
- Open-Meteo 总云、低云、中云、高云输入是否仍受严格校验；
- NASA GIBS 卫星目录是否被不同接口重复下载；
- VIIRS 视觉光污染图层的 URL、署名、浏览器加载和服务端诊断是否一致；
- 公共同源 API 是否会把空字符串坐标误解析成 `(0, 0)`；
- `refresh=1` 在无缓存或上游失败时是否仍可能绕过冷却；
- Docker/Compose 中新增的构建时和运行时参数能否传入阿里云生产镜像。

## 2. 分模块审计结论

| 模块 | 检查内容 | 发现 | 修复/结论 |
| --- | --- | --- | --- |
| 今夜观测时间轴 | 播放、选时、AQI、Kp | 每 1.5 秒切换时次都会重新请求 AQI/Kp；AQI 只取 2 天；Kp 固定按“现在”选值 | 抽离辅助条件 hook；每地点/人工刷新只下载一次序列；播放仅在内存选最近值；AQI 扩到 4 天；Kp按所选预报时刻匹配 |
| 天气 API | 单点/多点坐标、云层数组、缓存 | `Number("") === 0`，尾逗号或空参数可能形成假坐标 | 新增共享坐标解析器；拒绝空值、空 token、错位数组和越界坐标；真实 `(0,0)` 仍合法 |
| AQI / 气压 API | 坐标、强刷、旧值回退 | 空坐标可被当作 0；冷却期无旧缓存时仍可能重新打上游 | 使用共享坐标解析；无缓存且无并发任务时返回 429 + `Retry-After`，不绕过冷却 |
| NOAA Kp | 强刷与缓存 | 上游失败后冷却期缺缓存时仍可再次请求 | 与天气类接口统一：冷却期无可用回退时返回 429 |
| NASA GIBS | 卫星目录和健康检查 | 页面首开时卫星接口与数据状态接口各下载一次约 5.8 MB capabilities；进程内缓存不共享 | 新增共享 GIBS catalogue loader；卫星路由与数据诊断共用同一 Promise、缓存、超时、强刷冷却和 stale 回退 |
| 数据源诊断 | 定时状态检查 | 统一 5 分钟 TTL 会让轻量天气检查和大体积 GIBS 检查同频 | 增加分数据源 TTL：天气 5 分钟、光污染 15 分钟、卫星 1 小时；手动复检仍可绕过各源新鲜缓存并受总冷却保护 |
| 光污染图层 | 自定义 WMTS 与署名 | 替换瓦片 URL 后若未同步署名，页面仍可能错误显示默认供应商 | 新增构建时 `NEXT_PUBLIC_LIGHT_POLLUTION_ATTRIBUTION`；自定义 URL 未提供署名时显示明确配置提醒，不错误归功默认源 |
| Docker / 阿里云 | build args、runtime env | 新署名和分源 TTL 未进入镜像/Compose | Dockerfile 与 Compose 同步新增构建参数和运行时 TTL；`.env.example` 给出生产默认值与说明 |
| 工程结构 | 重复业务逻辑 | 坐标解析、辅助条件选时、GIBS 下载分别散落在多个组件/路由 | 收敛为 `queryParams.ts`、`auxiliaryConditions.ts`、`useAuxiliaryConditions.ts`、`gibsCapabilities.ts` 四个单一职责模块 |

## 3. 关键 Bug 根因与修复

### 3.1 时间轴播放触发辅助接口风暴

旧 `CloudTimeline` effect 依赖 `activeForecastTime`。播放每 1.5 秒更新时次，因此每个时次都会：

```text
取消上一轮 AQI/Kp 请求
→ 重新请求 /api/air-quality
→ 重新请求 /api/space-weather/kp
→ 解析后再渲染
```

这既浪费浏览器、Next.js 和阿里云出网资源，也可能让快速切换时一直看不到稳定结果。

修复后：

```text
地点或人工 refresh revision 变化
→ AQI(4天) 与 Kp 序列各请求一次
→ 时间轴播放只在本地数组中选择最近时次
→ 不再发网络请求
```

同时设置最大允许时间差；如果所选时刻超出辅助数据覆盖范围，UI 显示 `—`，不再退回第一条无关数据。

### 3.2 空字符串坐标被误认为赤道/本初子午线

JavaScript 中：

```text
Number("") === 0
```

因此 `lat=&lng=` 或多点参数尾逗号可能被当作合法坐标。修复后的共享解析器明确区分：

- 参数缺失或仅空白：非法；
- 列表存在空 token：非法；
- 纬度/经度数量不一致：非法；
- 超范围或非有限数：非法；
- 显式 `0`：合法。

### 3.3 GIBS 大目录重复下载

卫星时次路由和数据状态路由原先各自维护缓存，彼此不知道对方正在下载。同一页面首开可并行下载两份 NASA GIBS capabilities。

修复后两者共用：

- 一份 process-local XML 缓存；
- 一条 in-flight Promise；
- 15 秒请求超时；
- 15 分钟新鲜目录；
- 24 小时 stale 回退；
- 60 秒强刷冷却。

数据状态层另外使用 1 小时卫星探测 TTL，因此常规 5 分钟天气状态轮询不会再次解析或下载大目录。

### 3.4 强制刷新冷却的冷缓存漏洞

已有接口在冷却期且存在旧缓存时会返回缓存；但若第一次上游请求失败、缓存不存在，下一次 `refresh=1` 仍可能走普通上游请求。

AQI、气压和 Kp 现在在以下条件下返回 429：

```text
刷新被抑制
+ 没有同 key 的 in-flight 请求
+ 没有可用 stale 缓存
```

响应包含 `X-Refresh-Suppressed: true` 和 `Retry-After`，让前端、Nginx 日志和运维脚本都能识别真实行为。

## 4. 数据语义边界

- Open-Meteo 云量只有在总云、低云、中云、高云与时间轴长度一致且包含有限数值时才视为可用；
- Himawari 是卫星观测，不能当作未来预报；
- VIIRS 2023 视觉瓦片只用于人工夜光空间参考，不是实时光污染；
- 未安装授权本地栅格时不显示 Bortle/SQM 数值；
- Kp 是全球行星指数，不等于杭州或任意具体地点的极光概率；
- AQI/Kp 与所选预报时次距离过远时返回无数据，不用错误时次填充。

## 5. 新增与更新测试

### 单元测试

- 空坐标、尾逗号、坐标错位、越界及真实零坐标；
- AQI/Kp 结构过滤、最近时次选择、最大时差与输入不变性；
- 自定义光污染源署名；
- GIBS catalogue 并发合并与内存复用。

### Playwright

- 保留云量人工刷新仅一个网格强制请求、旧画布持续可见；
- 保留无 CORS 头的光污染瓦片加载验证；
- 新增时间轴播放 3.5 秒期间 AQI/Kp 请求数量保持不变；
- 新增人工刷新后 AQI/Kp 各出现一次带 `refresh=1` 的请求。

### CI 门禁

本提交进入 `main` 后必须通过：

1. production dependency audit；
2. ESLint；
3. TypeScript；
4. unit tests；
5. Next.js production build；
6. Open-Meteo / NASA GIBS / NOAA 等真实数据源冒烟；
7. desktop/mobile Playwright；
8. Compose 合并配置、Nginx `nginx -t`、生产镜像构建和 `/healthz` 容器检查。

## 6. 阿里云配置变化

新增构建时变量：

```dotenv
NEXT_PUBLIC_LIGHT_POLLUTION_ATTRIBUTION=
```

替换光污染瓦片时应同时填写来源/版权说明。未填写时页面使用中性的“自定义光污染参考图层”，不会继续显示默认 darkmap 署名。

新增运行时变量：

```dotenv
DATA_SOURCE_WEATHER_PROBE_TTL_MS=300000
DATA_SOURCE_SATELLITE_PROBE_TTL_MS=3600000
DATA_SOURCE_LIGHT_POLLUTION_PROBE_TTL_MS=900000
```

`NEXT_PUBLIC_*` 修改后必须执行 `docker compose ... up -d --build`；单纯重启容器不会更新浏览器 bundle。

## 7. 回滚

本轮通过一个原子提交直接快进 `main`。若出现回归，可回滚该提交；观星快照 named volume 与代码版本独立，不需要删除 `observing-snapshots` 数据卷。
