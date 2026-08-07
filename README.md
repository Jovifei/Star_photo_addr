# 星野决策｜地图式星空摄影天气规划

一个面向星空摄影与云海拍摄的响应式 Web 应用。它把地图选点、未来 7/14 天逐夜预报、天文条件、低云高度、风险门禁和点位比较放在同一条决策链里：先在地图上找机位，再判断哪一晚值得出发。

## 当前可用功能

- 地图观测台：Leaflet 深色底图、12 个预置机位标记、地图点击取点。
- 地点发现：中国境内城市/区县搜索，以及浏览器当前位置（需 HTTPS 或 localhost）。
- 即时评估：选中任意坐标后请求 Open‑Meteo，计算未来 7/14 天逐夜评分、连续窗口、云量、降水、阵风和气温。
- 候选点管理：地图/搜索/定位候选点可改名并保存到浏览器本机；相同坐标不会重复保存。
- 实时天气：总/低/中/高云量、降水、能见度、湿度、露点、风与阵风。
- 天文计算：太阳/月球高度、月面照度、银河中心高度，均由 Astronomy Engine 在本地计算。
- 星空与云海：两套独立评分；雷暴、降水、低能见度、大阵风和极高云量为硬性安全门禁。
- 点位决策：逐夜排名、核心窗口矩阵、逐小时详情和气压层云高区间。
- 可靠降级：缓存优先启动、手动刷新；接口失败时保留最近一次成功数据。
- 统一观测台主题：全站共用深夜靛蓝背景、青色观测信号、紫色天文强调、圆角面板与一致的交互状态。
- UI/UX Pro Max 优化：44px 触控目标、键盘地图点位入口、弹层焦点管理、读屏状态、等宽数据和按需加载图表。
- 响应式界面：桌面与手机均有独立导航，自动化脚本检查 375 / 768 / 1024 / 1440 四档宽度。

> 当前地图底图只用于选点，并不是光污染图。Bortle/SQM 尚未参与评分，界面会明确提示这一边界。

## 使用流程

1. 打开“地图”，搜索地点、点击地图或使用当前位置。
2. 查看所选坐标未来 7/14 个观测夜的分数与天气原因。
3. 给候选点改名并保存。
4. 回到“今晚”看全部点位排名，或在“对比”中横向比较核心窗口。
5. 出发前再次刷新，并核对道路、雷电、地质灾害和现场安全信息。

## 本地运行

要求 Node.js 22+。

```bash
git clone https://github.com/Jovifei/Star_photo_addr.git
cd Star_photo_addr
npm ci
npm run dev
```

当前天气和地点搜索不要求 API Key。浏览器定位只会在用户授权后使用，生产环境需 HTTPS。

## 构建与验证

```bash
# 单元测试 + 生产构建 + Sites Worker 测试
npm test

# 桌面 1440×1000 与手机 375×812 浏览器测试；脚本内另查 768 / 1024
npm run test:e2e

# 真实 Open‑Meteo 联网冒烟测试
npm run test:live

# 仅生产构建
npm run build
```

浏览器测试会 mock 天气、地名搜索和地图瓦片，以保证结果稳定；真实联网能力由 `test:live` 单独验证。首次运行若提示缺少浏览器，先执行 `npx playwright install chromium`。

## Docker

```bash
docker compose up --build -d
```

打开 `http://localhost:8080`，健康检查为 `/healthz`。若本机没有 Docker，可先用 `npm run build && npm run preview` 验证静态站点，再在具备 Docker 的环境完成容器验收。

## 数据来源与精度边界

- 天气与地名搜索：[Open‑Meteo](https://open-meteo.com/)。免费服务适合原型；商业运营前应核对许可、限额和 SLA。
- 天文计算：[Astronomy Engine](https://github.com/cosinekitty/astronomy)。
- 地图底图：OpenStreetMap 数据与 CARTO 样式，仅用于交互定位。
- 海拔：点位记录值与天气模型地形海拔分别保留，不把模型值伪装为现场测量。
- 云高：由离散气压层的云量、相对湿度与位势高度推导，是区间估算，不是测云仪实测。
- 预报时效：0–72 小时用于出发判断，4–7 天用于规划，8–14 天只表示趋势。
- 光污染：普通卫星夜光辐亮度不能直接等同于地面天空亮度、SQM 或 Bortle 等级。接入方案与许可风险见 [`docs/LIGHT_POLLUTION_DATA_DECISION.md`](docs/LIGHT_POLLUTION_DATA_DECISION.md)。
- 流星雨：2026 英仙座流星雨事件入口链接到 [International Meteor Organization 2026 日历说明](https://www.imo.net/the-2026-meteor-shower-calendar-is-here/)。

任何推荐都不能替代道路封闭、雷电、地质灾害、野生动物和现场安全判断。

## 项目结构

- `src/App.jsx`：导航、缓存、全局预测与页面编排
- `src/components/ObservationMap.jsx`：地图搜索、定位、候选点即时评估与保存
- `src/lib/openMeteo.js`：天气接口适配器
- `src/lib/geocoding.js`：中国境内地名搜索
- `src/lib/scoring.js`：可审计评分与安全门禁
- `src/lib/clouds.js`：气压层云高区间
- `src/lib/astronomy.js`：天文条件
- `tests/e2e/`：桌面/手机核心流程浏览器测试与 QA 截图
- `design-system/star-photo-planner/MASTER.md`：UI/UX Pro Max 生成的设计系统基线
- `docs/UI_UX_PRO_MAX_AUDIT.md`：本轮规则取舍、落地内容与验收状态
- `docs/PRODUCT_TECH_PLAN.md`：产品与技术总方案
- `docs/PERSEIDS_REFERENCE_AUDIT.md`：参考网站功能审计
- `docs/CODEX_HANDOFF_MAP_PHASE2.md`：未完成事项和可直接继续的 Codex 提示词

## 当前状态与下一阶段

地图搜索、定位、7/14 天评估、改名、保存与防重复均已实现并写入自动化脚本；全站已完成 UI/UX Pro Max 无障碍、触控、响应式与性能优化。若执行环境没有 Playwright Chromium，最终桌面/手机截图验收仍需按交接文档补跑。尚未伪造或提前宣称完成的部分包括：

1. 可商用且可追溯的光污染/SQM 数据层。
2. 多模型云量瓦片、时间滑块与服务端代理缓存。
3. 道路可达性、灾害预警和省域候选机位生成。
4. 在装有 Docker 的环境完成容器运行时验收。

完整交接与执行提示词见 [`docs/CODEX_HANDOFF_MAP_PHASE2.md`](docs/CODEX_HANDOFF_MAP_PHASE2.md)。

数据归各来源方所有；请保留网页页脚署名。
