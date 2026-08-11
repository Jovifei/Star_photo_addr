# 逐星 × 星野决策｜星空摄影观测平台

这是一个已经统一到 Next.js 16 的中文星空摄影决策产品。三个入口共用设计语言、地点/观测夜状态和天气评分能力：

- `/`：逐星地图分析。搜索或点击地点，查看暗夜边界、未来云图、高/中/低三层云量与 20:00—次日 05:00 时间轴。
- `/sites`：推荐观星地点。地图标记 20 个人工整理的中国观星地点，并按所选观测夜计算最佳连续窗口。
- `/planner`：星野决策。比较 7/14 天、多个地点、星空与云海模式，管理自定义点位。

三个入口用 URL 参数联动：`lat`、`lng`、`name`、`elevation`、`night`。例如：

```text
/planner?lat=30.4694&lng=119.5978&name=天荒坪&elevation=958.4&night=2026-08-12
```

观测夜以“傍晚所在日期”命名：`2026-08-07` 表示 8 月 7 日 20:00 至 8 月 8 日 05:00；所有日期界面均显示星期。

## 本地运行

要求 Node.js 24+。

```bash
npm ci
npm run dev
```

打开 `http://localhost:3100`。天气和地名搜索经 Next 同源 API 转发，不需要浏览器端 API Key。可选的天地图中文注记令牌通过 `NEXT_PUBLIC_TIANDITU_TOKEN` 配置；未配置时使用内置中文城市注记，不回退到英文地名底图。

### 数据源配置状态

- Open-Meteo 天气、NASA GIBS Himawari 卫星云图、VIIRS Black Marble 夜光基准均通过服务端/公共图层直接使用，不需要在浏览器填写 Key。
- 天地图中文注记是可选项：复制 `.env.example` 为 `.env.local`，填写 `NEXT_PUBLIC_TIANDITU_TOKEN`，然后重启 `npm run dev` 或重新构建 Docker。
- Bortle/SQM 暂不默认启用。它需要已经确认许可的本地 VIIRS/World Atlas 资源，并同时设置对应的 `NEXT_PUBLIC_ASSET_VIIRS_TILES` 或 `NEXT_PUBLIC_ASSET_WORLD_ATLAS`；没有资源时页面会明确显示“未安装”，不会伪造天空亮度。
- 地点详情中的“今日 / 3 天 / 5 天 / 7 天”使用同一次地点预报请求的未来夜间数据；它不是重新创建地点，也不会改变主地图当前时次。

## 验证

```bash
npm run check       # lint + typecheck + unit + production build
npm run test:e2e    # production server 上的 desktop/mobile 浏览器流程
npm run check:full  # 上述全部
npm run test:live   # 可选：真实 Open-Meteo 联网冒烟
```

首次执行 E2E 前如缺浏览器：

```bash
npx playwright install chromium
```

## Docker

```bash
docker compose up --build -d
curl -fsS http://127.0.0.1:3100/healthz
```

健康检查应返回包含 `status: "ok"` 和 `app: "star-weather-planner"` 的 JSON。容器内部运行 Next standalone 服务，宿主机默认端口为 3100；可通过 `APP_PORT` 覆盖。

## 数据边界

- 天气与地理编码：[Open-Meteo](https://open-meteo.com/)。
- 天文位置：Astronomy Engine 本地计算。
- 地图：CARTO 无地名深色底图 + 天地图或内置中文注记。
- 暗夜：没有可核验栅格时明确显示“未安装/无数据”，不伪造 SQM 或 Bortle。
- 云图：数值预报使用 Open-Meteo 网格采样和规则网格插值，不是卫星实况；高、中、低云颜色和 0–100% 比例分别呈现。卫星模式独立使用 NASA GIBS Himawari 观测。
- 推荐地点：人工整理的参考点，不等于官方安全背书；出发前仍需核对道路、雷电、地质灾害和现场管制。

## 代码结构

- `src/app/`：Next 路由与同源 API。
- `src/components/`：逐星与推荐地点共用组件。
- `src/features/planner/`：迁入 Next 的星野决策功能。
- `src/lib/`：全局状态、评分、天文、云图与时间语义。
- `tests/unit/`、`tests/planner/`、`tests/e2e/`：算法、旧产品迁移与跨产品流程测试。
- `docs/gpt_plan/`：交付状态、风险与后续 Codex 接管提示词。
