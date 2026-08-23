# 运行注意事项（数据源 / 配额 / 本地开发）

> 面向本项目维护者。记录环境依赖的坑、配额与降级行为、以及排查路径。
> 最后更新：2026-08-22

---

## 1. 本地开发打不开？先查端口

- **默认端口 3000 在 Windows 上经常被 Docker Desktop 占用**（`com.docker.backend.exe` 监听 3000）。`npm run dev` 会撞端口。
- 固定用其它端口启动：`npm run dev -- -p 3111`，然后访问 `http://localhost:3111`。
- Next dev 有单例锁（`.next/dev/`）：如果报 `Another next dev server is already running`，按提示找到已跑的端口/PID 复用或结束它，不要并行起第二个。
- dev 日志位置：`.next/dev/logs/next-development.log`（hydration 报错、CSS 语法错误、API 500 都在这里查）。

## 2. Open-Meteo 配额与限流（最重要的外部依赖）

### 现状
- 所有天气数据（今夜观测快照、观星计划预报、火烧云评分）都走 **Open-Meteo** 同一条管线。
- 未配置 API key 时是**匿名调用，按 IP 限流，每日有调用上限**。超限返回：
  `{"reason":"Daily API request limit exceeded. Please try again tomorrow."}`
- **超限时的表现是"正常降级"，不是 bug**：观测快照标 `stale` → 界面显示"已降级"；火烧云站点显示"数据不足"；planner 保留上一次成功数据并提示已过期。
- 配额按天重置；但本地内存缓存（30 分钟）与磁盘快照缓存（TTL 见下）可能让恢复后一段时间仍命中降级缓存，用"强制刷新"或等缓存过期。

### 关于"多个账号切换"
- 每个账号（API key）确实有独立免费额度；但**轮换多个免费账号来叠加配额违反 Open-Meteo 服务条款**，账号可能被封锁，不要这么做。
- 合规的选项（按推荐顺序）：
  1. **配置 Pro key**：设置环境变量 `OPEN_METEO_API_KEY`（已实现：设置后自动附加到全部上游请求，含 forecast / finder 批量 / 火烧云）。Pro 按量计费，本项目流量下很便宜。
  2. **自建/中转代理**：`OPEN_METEO_FORECAST_URL` 指向自建网关，自行控流。
  3. **减少调用量**（项目已做）：24 点/次的批量请求、30 分钟内存缓存、观测快照磁盘缓存 + in-flight 合并 + 强制刷新冷却。继续压流的方向是延长 s-maxage CDN 缓存。

### 相关环境变量
| 变量 | 作用 | 默认 |
|---|---|---|
| `OPEN_METEO_API_KEY` | Open-Meteo Pro key，附加到全部天气请求 | 未设置（匿名） |
| `OPEN_METEO_FORECAST_URL` | 上游 forecast API 地址（可指向代理） | `https://api.open-meteo.com/v1/forecast` |
| `OPEN_METEO_GEOCODE_URL` | 地理编码上游地址 | `https://geocoding-api.open-meteo.com/v1/search` |
| `OBSERVATION_SNAPSHOT_TTL_MS` | 观测快照磁盘缓存 TTL | 30 分钟 |
| `OBSERVATION_SNAPSHOT_STALE_TTL_MS` | 过期快照仍可兜底返回的窗口 | 6 小时 |
| `OBSERVATION_SNAPSHOT_TIMEOUT_MS` | 快照生成超时 | 120 秒 |
| `OBSERVATION_SNAPSHOT_FORCE_REFRESH_COOLDOWN_MS` | 强制刷新冷却 | 60 秒 |

## 3. 降级与占位约定（界面上这些词是有含义的）

| 界面文案 | 含义 | 处理 |
|---|---|---|
| 已降级 / 已过期 | 快照或预报超龄（上游失败或配额） | 点刷新；持续出现查配额/网络 |
| 数据不足（火烧云/评分） | 该站点当日无可用小时数据 | 同上 |
| 海拔待核 | 点位库中该站海拔未核验，**绝不显示假 0** | 跑 `scripts/backfill-finder-elevations.mjs` 回填 |
| 源状态面板 | `CloudControl` 内"数据源状态"实时探测 | 排查上游第一入口 |

## 4. 数据维护脚本

- `node scripts/backfill-finder-elevations.mjs [--dry-run]`
  观测点库海拔回填：优先保留描述中的人工整理值，缺失的用 Open-Meteo 高程 API（Copernicus DEM）补全。**库文件更新后记得重跑**。

## 5. 火烧云数据源结论（2026-08-22 调研）

- sunsetbot.top **无公开 API**（仅微信小程序）；其上游为 NCEP-GFS / ECMWF（云况）+ CAMS（气溶胶）+ ERA-5（回算）。
- 本项目 v1 用 Open-Meteo（同类原始源）+ astronomy-engine 太阳高度角实现；**CAMS AOD（气溶胶光学厚度）是已规划的增强项**，用于替代当前的能见度代理。

## 6. 健康检查入口

- `/healthz` — 存活探测
- `/api/data-sources` / `CloudControl` 源状态面板 — 上游健康
- `/api/observing/snapshot?...` — 观测快照（看 `stale` 字段）
- `/api/fireglow/snapshot?...` — 火烧云快照

## 7. 第三方在线数据源（运行时调用，不随仓库分发）

| 来源 | 用途 | 说明 |
|---|---|---|
| 阿里云 DataV GeoAtlas（geo.datav.aliyun.com） | 中国省级行政边界回退源 | 本地许可边界包（`NEXT_PUBLIC_ASSET_BOUNDARIES`）未启用时自动使用；浏览器会话内缓存；失败静默降级为无线 |
| darkmap.cn WMTS | 光污染底图 | 既有 |
| NASA GIBS / Himawari | 卫星云图 | 既有 |
