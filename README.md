# 逐星｜星空摄影观测平台

<p align="center">
  <strong>把“今晚能不能拍、去哪里拍、几点拍”放进同一套地图与摄影决策工作流。</strong>
</p>

<p align="center">
  <a href="https://github.com/Jovifei/Star_photo_addr/actions/workflows/ci.yml">
    <img alt="CI" src="https://github.com/Jovifei/Star_photo_addr/actions/workflows/ci.yml/badge.svg?branch=main">
  </a>
  <img alt="Node.js 24+" src="https://img.shields.io/badge/Node.js-24%2B-43853d">
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-111111">
  <img alt="License MIT" src="https://img.shields.io/badge/License-MIT-blue">
</p>

**逐星**是一套面向星空摄影、暗夜选址、火烧云与高山云海的中文摄影决策平台。它把逐小时数值天气、卫星云观测、夜光/光污染参考、候选地点筛选、天文位置和特殊摄影条件指数放进同一产品，目标是直接回答：**今晚能不能拍、去哪里拍、几点拍。**

生产站点：`https://photo.joviluma.com`

## 四个核心工作区

| 工作区 | 入口 | 主要回答的问题 |
| --- | --- | --- |
| **今夜观测** | `/` | 今晚云量怎样、卫星云带在哪、哪些地点更值得去、几点更适合拍？ |
| **暗夜选址** | `/sites → /` | 哪些地点远离城市夜光、暗夜条件更好、如何加入候选比较？ |
| **火烧云** | `/fireglow` | 日出/日落附近的云层与通光条件如何、哪个地点和时次更值得守候？ |
| **高山云海** | `/cloudsea` | surface 水汽与低云是否具备条件，压力层模式是否显示山顶位于低层云 deck 上方，以及是否存在逆温证据？ |

原独立「观星计划」已退役。历史 `/planner` 只保留为 noindex 兼容入口，把地点、模型和时次上下文带回统一首页。

> [!IMPORTANT]
> 本项目提供摄影与观测规划参考，不替代现场天气预警、道路安全、雷电、地质灾害、景区管制、探空资料或专业天文台判断。

---

## 界面预览

截图由生产构建通过 Playwright 自动生成；截图中的数据只用于展示信息结构，不代表当前实时观测结论。

### 今夜观测

<p align="center">
  <img src="docs/images/readme/01-tonight-observation.jpg" alt="今夜观测桌面界面" width="100%">
</p>

### 暗夜选址

<p align="center">
  <img src="docs/images/readme/02-dark-sky-selection.jpg" alt="暗夜选址桌面界面" width="100%">
</p>

### 移动端

<p align="center">
  <img src="docs/images/readme/04-mobile-overview.jpg" alt="逐星移动端界面" width="390">
</p>

---

# 科学语义与显示边界

## 天气、卫星、夜光不是同一类数据

- **NASA GIBS 卫星云图**：描述已经发生的云况，不是未来预报；
- **Open-Meteo surface / pressure forecast**：数值模式对未来天气和垂直结构的预测；
- **VIIRS 夜光**：长期/年度人工夜光参考，不是实时光污染；
- **Bortle/SQM**：只有来源与许可可核验的本地栅格才作为真实采样展示，不从普通夜光瓦片伪造。

## 暗夜地点目录 B1–B4

目录参考 B1–B4 只用于点位库筛选与着色，是经过整理的地点目录元数据：

- 不是当前 VIIRS 栅格的逐像素换算；
- 不是现场 SQM 实测；
- 不进入实时天气推荐分；
- 当真实 Bortle/SQM 栅格不可用时，系统明确显示数据不可用，不用目录值冒充实时暗夜采样。

## 火烧云

火烧云页面显示的是 **0–100 条件指数**，不是经过长期实拍样本校准的统计事件概率。指数综合高/中/低云、降水、能见度、阵风和太阳高度阶段，用于比较地点与时次的相对条件。

## 高山云海 Beta：surface + pressure profile

云海页面同样展示 **0–100 条件指数**，但垂直层位已经不再使用 valley-floor/LCL 启发式补算。

当前第一阶段数据链为：

1. **surface weather**：`relative_humidity_2m`、`cloud_cover_low`、`cloud_cover_mid`、`cloud_cover_high`、`precipitation`、`wind_speed_10m`；
2. **pressure-level model profile**：1000 / 975 / 950 / 925 / 900 / 850 / 800 / 700 / 600 / 500 hPa 的云量、相对湿度、温度和位势高度；
3. 复用统一 pressure cloud-layer 推导，识别连续低层 cloud deck；
4. 用站点海拔与模式云底/云顶的 MSL 高度判断“山顶在云上 / 云中 / 云下”；
5. 用相邻压力层温度随高度上升的信号给出**逆温证据**；
6. 再结合真实 surface 湿度、低云覆盖、风、上层云和降水形成条件指数。

可靠性边界：

- pressure profile 的 cloud/RH/temperature/geopotential-height 必须沿同一小时轴完整对齐；
- 少于 6 个完整压力层时，不视为可靠剖面；
- pressure 地点数量与请求数量不一致时整批 fail-closed，避免坐标错位；
- surface 低云明显、但 pressure profile 缺失或无法定位连续低层云 deck 时，**不使用启发式云底/云顶补值，云海垂直结论显示数据不足**；
- pressure 临时失败不会推翻已经成功取得的真实 surface 数据；页面会标明 pressure coverage，缺失地点不推断垂直层位；
- 逆温是**数值模式证据**，不是探空、云底仪或山顶传感器实测；
- 0–100 仍是工程条件指数，尚未用长期实拍标签校准成统计事件概率。
- 当窗口 `score` 缺失时，地图标记与图例显示为独立的“数据不足”状态，不等同于最低条件等级。

### 尚未完成的云海 Phase 2

当前 pressure profile 使用的是**站点中心坐标**。项目计划中的 8–15 km 周边谷地采样仍未实施，因此第一阶段可以判断模式垂直云层与山顶关系，但还不能把“周边谷地是否被同一低云层填满”当成已经验证的事实。下一阶段再加入周边地形/谷地采样，以区分“山顶在云上”与“真正有连续云海铺展”。

---

# 使用指南

## 1. 今夜观测 `/`

同一地图工作台内可以查看：

- 搜索、地图点击、内置候选和分享链接地点；
- 当前地点海拔和天气模型；
- NASA GIBS 卫星云观测；
- Open-Meteo 总/低/中/高云与逐小时天气；
- VIIRS 夜光视觉参考和可选本地暗夜栅格；
- 未来 72 小时预报时次；
- 候选地点 7 天动态排行；
- 地点详情中的连续观测窗口、月相、暗夜时长、银河高度、小时矩阵和 pressure profile；
- 数据源健康、缓存、stale/refresh error 与人工刷新状态。

云量 `70%` 表示模型估计约七成天空被对应云层覆盖，**不是“70% 概率有云”**。

## 2. 暗夜选址 `/sites`

`/sites` 是兼容入口，最终进入首页统一地图的暗夜状态，并尽量保留地点、模型、观测夜和时次。

推荐流程：

1. 查看 VIIRS 夜光参考和目录参考 B1–B4 地点；
2. 缩放到计划活动区域；
3. 点击地点查看真实天气/暗夜数据状态；
4. 把值得比较的地点加入候选；
5. 在候选排行、地点详情与逐小时矩阵中完成决策。

## 3. 火烧云 `/fireglow`

- 支持朝霞/晚霞与日期切换；
- 地图和排行显示条件指数，不称校准概率；
- 详情显示日出/日落方位、暮光时序和高/中/低云；
- 上游失败时只允许有效且未超龄的最近成功快照回退。

## 4. 高山云海 `/cloudsea`

- 晨间：05:00–08:00；
- 傍晚：17:00–19:00；
- 显示 surface 湿度、风、低/中/高云；
- 显示压力层模式云底/云顶、山顶相对关系、最佳剖面时次和置信度；
- 显示逆温证据及对应高度范围；
- pressure 缺失时保留 surface 指标，但需要垂直层位的结论 fail-closed；
- stale、refresh error 和 pressure coverage 在界面可见。

---

# 数据源

| 数据 | 来源 | 用途 | 边界 |
| --- | --- | --- | --- |
| surface 天气与云量 | Open-Meteo | 温湿度、降水、风、能见度、总/低/中/高云 | 数值预报，不是卫星实况 |
| 压力层剖面 | Open-Meteo | pressure cloud、RH、温度、位势高度；云海层位与逆温证据 | 数值模式；需足够完整层数 |
| 卫星云图 | NASA GIBS Himawari AHI Band 13 | 观察已经发生的云带 | 不是未来预报 |
| 夜光视觉参考 | VIIRS 2023 WMTS | 人工夜光空间分布 | 不等于 Bortle/SQM 实测 |
| 本地暗夜栅格 | 用户提供授权资产 | 可选 Bortle/SQM | 未安装时不造值 |
| 天文位置 | Astronomy Engine | 太阳/月亮高度、月相、银河相关计算 | 仍需考虑地形遮挡 |
| 空气质量 | Open-Meteo | 透明度/气溶胶辅助参考 | 区域模型，不是现场仪器 |
| 空间天气 | NOAA SWPC | 行星 Kp 趋势 | 不等于当地极光概率 |
| 地理编码 | Open-Meteo Geocoding | 搜索与坐标解析 | 同名地点需人工确认 |

---

# 快速开始

## 环境要求

- Node.js `>= 24`
- npm
- 可选：Docker / Docker Compose
- E2E：Playwright 浏览器

## 本地开发

```bash
git clone https://github.com/Jovifei/Star_photo_addr.git
cd Star_photo_addr
npm ci
npm run dev
```

默认端口为 `3000`；统一使用 `3100`：

```bash
PORT=3100 npm run dev
```

PowerShell：

```powershell
$env:PORT = "3100"
npm run dev
```

## 生产构建

```bash
npm ci
npm run build
PORT=3100 npm run start
```

## Docker Compose

```bash
cp .env.example .env
export BUILD_REVISION="$(git rev-parse --short=12 HEAD)"
docker compose up --build -d
curl -fsS http://127.0.0.1:3100/healthz
```

Compose 默认包含：

- `star-weather`：Next.js 主服务；
- `star-weather-worker`：定时生成观测地点评分快照；
- `observing-snapshots`：持久化快照 volume。

完整部署步骤见 [`docs/ALIYUN_DEPLOYMENT.md`](docs/ALIYUN_DEPLOYMENT.md)。

---

# 同源 API

浏览器主要访问项目自己的 Next.js API：

| 接口 | 用途 |
| --- | --- |
| `GET /healthz` | 应用进程存活与构建版本 |
| `GET /api/forecast` | 地点逐小时天气与云量 |
| `GET /api/pressure-forecast` | 单点压力层云量与垂直剖面 |
| `GET /api/geocode` | 地点搜索 |
| `GET /api/air-quality` | 空气质量 |
| `GET /api/satellite/times` | 卫星云图/夜光时次 |
| `GET /api/space-weather/kp` | NOAA Kp |
| `GET /api/observing/snapshot` | 观星地点评分快照 |
| `GET /api/fireglow/snapshot` | 火烧云条件指数快照 |
| `GET /api/cloudsea/snapshot` | surface + pressure 云海条件指数快照 |
| `GET /api/data-status` | 推荐运行时数据源诊断 |

`/healthz` 故意不依赖 Open-Meteo 或 NASA；第三方短时故障不应让容器把正常应用反复重启。

---

# 缓存、刷新与容错

默认参数来自 `.env.example`。

| 数据 | 新鲜缓存 | 允许回退的旧缓存 | 强刷冷却 |
| --- | ---: | ---: | ---: |
| 天气预报 | 10 分钟 | 6 小时 | 1 分钟 |
| NASA GIBS 目录 | 15 分钟 | 24 小时 | 1 分钟 |
| 观测点评分快照 | 30 分钟 | 6 小时 | 1 分钟 |
| 数据源健康状态 | 5 分钟 | — | 1 分钟 |

服务端包含请求超时、同资源并发合并、地点数量上限、错误脱敏、请求中止和新请求覆盖旧请求的竞态保护。生产数据链坚持 **fail-closed + 明确 stale/no-data**，不使用固定值或合成天气冒充上游成功。

---

# 验证与质量门禁

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
npm run test:e2e:cross-browser
npm run test:live
npm run check
npm run check:full
```

GitHub Actions 发布门禁包括：

1. production dependency audit；
2. lint + typecheck + unit/contract/integration + production build；
3. live upstream smoke；
4. Docker Compose / Nginx / production image smoke；
5. Chromium desktop/mobile 全量 E2E；
6. Firefox/WebKit core smoke。

---

# 技术架构

- Next.js 16 App Router；
- React 19 + TypeScript；
- Leaflet / React-Leaflet；
- ECharts；
- Astronomy Engine；
- Vitest；
- Playwright；
- Docker Compose。

```text
Star_photo_addr/
├─ src/
│  ├─ app/                     # 页面、兼容路由与同源 API
│  ├─ components/              # 统一工作台与共享 UI
│  ├─ data/observingSites/     # 242 地点正式 catalog
│  └─ lib/                     # 天气、pressure、天文、卫星、评分、缓存
├─ scripts/
├─ tests/
│  ├─ unit/
│  ├─ contract/
│  ├─ integration/
│  └─ e2e/
├─ docs/
├─ Dockerfile
├─ docker-compose.yml
└─ .env.example
```

---

# 文档

- [产品与技术计划](docs/PRODUCT_TECH_PLAN.md)
- [参考站审计](docs/PERSEIDS_REFERENCE_AUDIT.md)
- [阿里云部署手册](docs/ALIYUN_DEPLOYMENT.md)
- [统一视觉系统](docs/UNIFIED_VISUAL_SYSTEM.md)
- [测试说明](docs/TESTING.md)
- [工程修改跟踪](docs/engineering-change-log/)

较大功能、Bug 修复或部署变更继续按：

```text
修改目的 → 现象 → 根因 → 修复 → 验证 → 风险与回滚
```

---

# 许可

项目 `package.json` 声明 MIT License。第三方天气、卫星、地图和暗夜资产分别受各数据提供方条款约束；自建部署者应自行确认生产使用、缓存、再分发和署名要求。
