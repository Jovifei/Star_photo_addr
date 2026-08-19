# 逐星｜星空摄影观测平台

这是一个统一到 Next.js 16 的中文星空摄影决策产品。总品牌为 **逐星**，产品由三个连续工作区构成，共用地点、候选清单、观测夜、天气模型、时次与评分状态：

- `/`：**今夜观测**。浏览中国观星地点，切换卫星云图、逐小时云量与综合决策图层，快速判断今晚是否适合观测。
- `/sites`：**暗夜选址**。进入统一地图的光污染与候选地点工作区，结合 VIIRS、Bortle 条件和天气筛选观测点。
- `/planner`：**观星计划**。比较候选地点在今晚及未来 3/5/7 夜的评分、最佳连续窗口、云量、降水、风和月光条件。

三个工作区形成“判断今夜条件 → 筛选暗夜地点 → 制定观星计划”的使用闭环。它们通过共享观测会话和 URL 参数联动：`lat`、`lng`、`name`、`elevation`、`night`、`model`、`forecastTime`、`observationTime`、`overlay`。

## 本地运行

要求 Node.js 24+。

```bash
npm ci
npm run dev
```

打开 `http://localhost:3100`。天气、地理编码、空气质量、卫星时次和评分快照均通过 Next 同源 API 访问，浏览器不直接持有上游密钥。

## 数据源与刷新

- **云量/天气**：Open-Meteo 总云量、高云、中云、低云、降水、风和能见度；ICON、GFS、AIFS 会按各自预报时效限制请求。
- **卫星云图**：NASA GIBS Himawari AHI Band 13，使用实际卫星观测时间域，不与天气预报时次混用。
- **光污染视觉参考**：默认 VIIRS 2023 第三方 WMTS；只用于空间参考，不等同于现场 Bortle 或 SQM 实测。
- **Bortle/SQM**：只有安装并显式启用授权本地栅格后才显示；未安装时明确标记，不伪造数值。
- **空气质量**：Open-Meteo CAMS。
- **空间天气**：NOAA SWPC 全球行星 Kp；不等同于当地极光概率。

应用内“刷新数据”会绕过 10 分钟新鲜缓存，重新读取天气、云量网格、推荐点评分快照、卫星目录和数据源状态。上游暂时失败时，只会回退到明确标记的旧数据，不会用空数组或固定值冒充成功。

运维接口：

```bash
curl -fsS http://127.0.0.1:3100/healthz
curl -fsS http://127.0.0.1:3100/api/data-sources/health
curl -fsS 'http://127.0.0.1:3100/api/data-sources/health?refresh=1'
```

- `/healthz`：应用进程存活检查；
- `/api/data-sources/health`：Open-Meteo、NASA GIBS、光污染瓦片与本地资产状态；
- `refresh=1`：绕过诊断缓存重新探测。

## 配置

复制环境模板：

```bash
cp .env.example .env.local
```

常用配置：

- `NEXT_PUBLIC_TIANDITU_TOKEN`：可选的天地图中文注记；
- `NEXT_PUBLIC_LIGHT_POLLUTION_TILE_URL`：自有/授权光污染瓦片模板；
- `NEXT_PUBLIC_ASSET_*`：授权本地暗夜资产开关；
- `OPEN_METEO_*`、`GIBS_CAPABILITIES_URL`、`NOAA_KP_URL`：运行时上游地址或企业代理。

`NEXT_PUBLIC_*` 是构建时变量，修改后必须重新构建。

## 验证

```bash
npm run check       # lint + typecheck + unit + production build
npm run test:e2e    # production server 上的 desktop/mobile 浏览器流程
npm run check:full  # 上述全部
npm run test:live   # 真实天气、云层、卫星、AQI、Kp、地理编码冒烟
```

真实冒烟测试会把官方数据源失败作为错误；第三方光污染视觉瓦片会单独报告 `degraded`，便于生产环境改用自建/授权源。

首次执行 E2E 前如缺浏览器：

```bash
npx playwright install chromium
```

## Docker 与阿里云

```bash
cp .env.example .env
export BUILD_REVISION="$(git rev-parse --short=12 HEAD)"
docker compose up --build -d
curl -fsS http://127.0.0.1:3100/healthz
```

默认只监听 `127.0.0.1:3100`，适合由 Nginx/Caddy 反向代理并对公网只开放 `80/443`。完整 ECS、安全组、HTTPS、上游排障、更新与回滚步骤见：

- [`docs/ALIYUN_DEPLOYMENT.md`](docs/ALIYUN_DEPLOYMENT.md)

容器内部运行 Next standalone 服务；观测点评分快照保存在 named volume `observing-snapshots`，镜像更新不会自动删除。

## 数据边界

- 数值云量不是卫星实况；卫星观测也不是未来预报。
- 光污染视觉瓦片不是实时光污染，也不能直接推导现场 Bortle/SQM。
- 推荐地点是人工整理的参考点，不等于官方安全背书。
- 出发前仍需核对道路、雷电、地质灾害、现场管制和当地实时云况。

## 代码结构

- `src/app/`：Next 路由与同源 API。
- `src/components/`：今夜观测与暗夜选址共用组件。
- `src/features/planner/`：观星计划功能。
- `src/lib/`：全局状态、评分、天文、云图、缓存与数据源诊断。
- `tests/unit/`、`tests/planner/`、`tests/e2e/`：算法、接口语义和跨工作区流程测试。
- `scripts/live-smoke.mjs`：真实上游冒烟测试。
