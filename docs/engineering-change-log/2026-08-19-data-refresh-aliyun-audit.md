# 工程修改跟踪：数据获取、刷新与阿里云部署前审计

> 文档编号：`ENG-CHANGE-2026-08-19-DATA-REFRESH-ALIYUN`  
> 仓库：`Jovifei/Star_photo_addr`  
> 基线：`main@c16804b4bdb687308ad64eb734f045a9ecd6f4b0`  
> 功能分支：`fix/data-refresh-aliyun-audit-20260819`  
> PR：`#9`

## 1. 修改目的

对浏览器、Next.js 同源 API、外部提供方、缓存、人工刷新、后台 worker、Docker 和反向代理做一次部署前完整审计。重点确认：

- Open-Meteo 总云量、低云、中云和高云不是空结构或错位数组；
- NASA GIBS Himawari 云图与 VIIRS Black Marble 不串产品、不请求不存在的缩放层级；
- VIIRS 2023 光污染视觉 WMTS 能在浏览器和服务端诊断中使用相同配置语义；
- `refresh=1` 不被重复点击、并发请求或参数变体滥用；
- 上游失败时使用明确标记的 stale 数据，不伪造成功；
- 阿里云 ECS 部署具备端口隔离、日志轮转、资源限制和边缘限流。

## 2. 分模块审计结论

| 模块 | 主要检查 | 发现 | 处理 |
| --- | --- | --- | --- |
| 今夜观测地图 | 地点、模型、时间轴、云量画布 | 云量刷新会自我取消并闪空 | 修复请求签名、旧画布保留和原子替换 |
| 云量数据 | 总/低/中/高云与时间轴 | 已有字段校验；补充刷新一次性消费 | 保留对齐校验，revision 只强制一次 |
| 卫星云图 | 产品类型、目录、时次、缩放 | 旧产品帧可能残留；高层级 404 | 帧白名单、单一 catalogue state、maxNativeZoom |
| 光污染 | WMTS 模板、图片、CORS、状态恢复 | 无需的 CORS 会阻断有效图片；模板未完整 materialize | 移除 CORS 要求，统一模板校验与占位符展开 |
| 暗夜数值 | Bortle/SQM 资产 | 未安装时必须无数据 | 保持不伪造数值的边界 |
| 观星点评分 | 242 点快照、磁盘缓存、并发 | `days/focusTime` 可绕过强刷冷却 | 精确缓存与 `date+model` refresh family 分离 |
| 兼容天气 API | 参数、超时、缓存、错误 | 缺模型校验、并发合并和冷却 | 补齐白名单、超时、合并、冷却及诊断头 |
| AQI / 气压 / Kp | 高频读、手动刷新、旧数据 | 各路由重复实现且并发会重复打上游 | 新增通用 `RefreshCoordinator` 并接入三类路由 |
| 后台 worker | 周期任务、超时、退出 | `setInterval(async)` 可能任务重叠且没有请求超时 | 改为串行递归定时器、独立超时和优雅停止 |
| Docker | 非 root、volume、健康检查 | 基础配置有效；缺生产资源与日志覆盖 | 新增阿里云 Compose override |
| Nginx | HTTPS、API 限流、静态缓存 | 只有文档示例，没有可直接部署文件 | 新增 `deploy/nginx/star-photo.conf` |
| 工程质量 | lint、类型、单元、E2E | 首轮发现 React effect 内同步 setState | 卫星状态合并为单一 catalogue，消除级联更新 |

## 3. 关键 Bug 与根因

### 3.1 云量网格刷新自我取消

旧实现开始请求前执行 `setCloudGrid(null)`。该状态变化重新触发 effect，第二次请求随即取消第一请求，造成重复调用、地图闪空和不必要的 Open-Meteo 压力。

修复：

- 请求签名由观测夜、范围、模型、刷新 revision 和地图边界组成；
- 相同签名只保留一个请求；
- 兼容上下文保留旧画布；
- 新结果成功后原子替换；
- 失败时明确提示“已保留上一次结果”。

### 3.2 refresh revision 被永久当成强制刷新

revision 是递增 token，不会回到 0。旧判断 `revision > 0` 会让第一次人工刷新后的所有地图移动、模型或夜晚变化继续携带 `refresh=1`。

修复：记录最后消费的 revision，只有 token 真正变化时强制刷新一次。

### 3.3 卫星产品串帧和 GIBS 缩放错误

云图与夜光切换失败时，旧 frames 可能留在状态。服务端使用的 GIBS matrix set 分别止于 Level 6 和 Level 8，客户端却可能请求更高层级。

修复：

- 只接受匹配 `kind`、`source=NASA GIBS`、`observed=true`、`isForecast=false` 的帧；
- 用单一 catalogue state 替代多组易失同步状态；
- 云图 `maxNativeZoom=6`，夜光 `maxNativeZoom=8`；
- 更高地图级别由 Leaflet overzoom。

### 3.4 光污染 CORS 与模板问题

视觉瓦片只作为普通 `<img>` 显示，不参与 canvas 像素读取。强制 `crossOrigin="anonymous"` 会让不返回 CORS 头的有效第三方或自建 WMTS 在浏览器中失败。

模板探测还存在另一问题：虽然允许 `{s}`、`{r}`、`{-y}`，服务端探测没有实际展开这些占位符。

修复：

- 移除不需要的 CORS 要求；
- 支持 `{z}`、`{x}`、`{y}`、`{-y}`、`{s}`、`{r}`；
- 正确计算 TMS 反向 Y；
- 仅允许 HTTP(S)，禁止 URL 内嵌凭据和未知占位符；
- 浏览器与 `/api/data-status` 使用同一套校验。

### 3.5 重型观星刷新保护可绕过

精确快照必须区分 `days/focusTime`，但强制刷新冷却不应使用同一精确键，否则调用方可以不断改变参数重复触发 242 地点任务。

修复：

```text
精确缓存键：date + days + model + focusTime
刷新 family：date + model
```

同时返回：

- `X-Observation-Cache`；
- `X-Data-Stale`；
- `X-Refresh-Suppressed`；
- `Retry-After`。

### 3.6 AQI、气压和 Kp 的重复刷新逻辑

三个路由各自维护缓存，却缺少统一并发合并和强刷冷却。新增 `RefreshCoordinator<T>`：

- `decide()` 负责冷却与 `Retry-After`；
- `run()` 负责相同 key 的 Promise 合并；
- bounded history 防止长时间 ECS 进程中的 Map 无界增长。

### 3.7 后台 worker 任务重叠

`setInterval(refresh, interval)` 不会等待异步 refresh 完成，网络阻塞时下一轮仍会启动；原实现也没有独立请求截止时间。

修复：

- 一轮结束后再用 `setTimeout` 安排下一轮；
- `SNAPSHOT_WORKER_REQUEST_TIMEOUT_MS` 默认 150 秒；
- `SIGTERM/SIGINT` 时取消当前请求并停止后续任务；
- 参数使用 `URLSearchParams`，模型和天数有白名单。

## 4. 代码简化

本轮不是以删行数为唯一目标，而是减少重复状态和重复治理逻辑：

- 卫星层从 `frame + frames + frameMode + error` 收敛为单一 catalogue；
- 光污染模板 materialize 和 validate 共用一套函数；
- AQI、气压、Kp 共用 `RefreshCoordinator`；
- worker 调度由“定时器 + 潜在重叠”收敛为一个串行 loop；
- 精确缓存 key 与刷新 family key 明确分工。

## 5. 新增测试

### 单元测试

- 光污染模板：默认 WMTS、缺失占位符、HTTP(S)、凭据、`{s}/{r}/{-y}`；
- 卫星：产品隔离、无效帧、原生缩放；
- 观星快照：exact key 与 refresh family；
- RefreshCoordinator：冷却、`Retry-After`、并发 Promise 合并与释放。

### Playwright

- 人工刷新期间旧云量 canvas 保持可见；
- 同一地图网格只启动一个强制刷新请求；
- 光污染图片响应没有 CORS 头时仍正常加载；
- 原有桌面端与移动端业务流程继续执行。

### 真实数据源冒烟

- Open-Meteo Best Match / ICON / GFS / AIFS；
- 总、低、中、高云量；
- 气压层云量；
- 地理编码；
- AQI；
- NASA GIBS Himawari 与 Black Marble；
- NOAA Kp；
- 光污染视觉瓦片作为可选外部源单独报告。

## 6. 阿里云交付变化

新增：

```text
docker-compose.aliyun.yml
deploy/nginx/star-photo.conf
```

并更新：

```text
.env.example
docker-compose.yml
docs/ALIYUN_DEPLOYMENT.md
```

部署要求：

- 3100 仅绑定 `127.0.0.1`；
- 公网只开放 80/443；
- API 同时受 Nginx 限流和应用冷却保护；
- JSON 日志轮转，防止系统盘被长期日志写满；
- app/worker 分别限制内存、CPU、PID 和 `/tmp`；
- `NEXT_PUBLIC_*` 修改后必须重新构建镜像；
- `/healthz` 仅作 liveness，外部数据通过 `/api/data-status` 诊断。

## 7. 数据边界

- VIIRS 视觉图层不是实时光污染；
- 不能直接换算现场 Bortle/SQM；
- 没有授权本地栅格时继续显示“无数据”；
- 推荐地点不替代道路、雷电、地质灾害和现场管制判断；
- 第三方接口本轮通过不代表未来永不波动，因此保留 timeout、stale fallback、degraded 和诊断头。

## 8. 回滚

本轮集中在独立分支和 PR #9。若合并后出现回归，可回滚最终 merge/squash commit。观测快照保存在 `observing-snapshots` named volume，与镜像版本独立；回滚代码无需删除数据卷。
