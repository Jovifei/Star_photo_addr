# Codex 继续开发交接：地图观测台 Phase 2

## 当前状态

分支：`agent/map-observatory`  
基线：GitHub `main` + 选择性移植已验证的 UI/测试改动；没有带入实验分支里的 `.workbuddy` / `.comet` 污染。  
本轮完成：地图导航、Leaflet 深色底图、12 个预设点标记、中国地点搜索、地图点击取点、定位入口、单点 14 天实时预报、7/14 天夜晚轨道、候选点保存、光污染边界声明。

## 本地继续

优先使用交付的 Git bundle（它包含完整提交历史，不依赖 GitHub 分支已推送）：

```bash
git clone -b agent/map-observatory Star_photo_addr-map-observatory.bundle Star_photo_addr
cd Star_photo_addr
npm ci
npm run dev
```

也可以直接解压 `Star_photo_addr-map-observatory.zip` 后运行 `npm install && npm run dev`，但 zip 不包含 Git 历史。不要从 `codex/local-validation-and-hardening` 整体合并，因为该远程分支包含与产品无关的大型技能数据提交。

## 已验证命令

```bash
npm run test:unit
npm run build
npm test
```

地图人工验收：打开应用 → “地图” → 搜索“杭州” → 选择浙江杭州 → 切换 7/14 天 → 保存点位 → 进入“点位”确认。

## 真实剩余项

### P0：合并前硬化

- 增加地图 E2E：mock geocoding、搜索结果选择、14 天切换、保存点位。
- 在有真实浏览器定位权限的环境验证“使用当前位置”的允许/拒绝路径。
- 为地图点击增加可编辑名称，避免保存为坐标字符串。
- 修复任何移动端 375×812、桌面 1440×900 可见问题。

### P1：光污染数据层

- 先做数据决策文档：数据集名称、年份、许可证、覆盖区域、分辨率、更新频率、瓦片托管成本。
- 全球图层与中国增强图层必须分开版本化，不可混成同一排名尺度。
- 前端实现 Bortle B1–B9 图例、点选 SQM、数据年份与“无数据”状态。
- 只有在光污染值可追溯后，才把它作为评分因子；升级 `SCORE_MODEL_VERSION` 并补回归测试。

### P1：云量地图

- 设计同域服务 `/api/cloud-tiles/{model}/{level}/{time}/{z}/{x}/{y}`，不要让浏览器直接拉大体积 GRIB。
- 模型选择：Best Match、ICON、GFS、AIFS；层级：total/low/mid/high。
- 时间滑块显示模型起报时间、有效时次和无数据边界；服务端缓存并限制并发。
- 地图数值与点位详情必须使用同一有效时次，避免“图层晴、卡片阴”的口径冲突。

### P2：候选点与事件

- 接入行政边界/标签和省域候选点索引。
- 候选点生成应综合道路可达性、地形坡度、光污染、海拔和天气，不得仅按黑暗值排序。
- 建立流星雨事件表：活动起止、峰值 UTC、ZHR、辐射点、月相说明、来源 URL 和抓取时间。
- 增加倒计时和事件筛选，但不要展示无来源的伪精确 ZHR。

## 可直接交给 Codex 的提示词

```text
你接手仓库 Jovifei/Star_photo_addr 的 agent/map-observatory 分支。先完整阅读：
1. docs/PRODUCT_TECH_PLAN.md
2. docs/PERSEIDS_REFERENCE_AUDIT.md
3. docs/CODEX_HANDOFF_MAP_PHASE2.md

目标：完成地图观测台 Phase 2，优先 P0 E2E 与移动端硬化，再做光污染数据决策；不要虚构 Bortle/SQM、云图或流星雨 ZHR。

约束：
- 保留现有 React/Vite/Leaflet 架构和星空评分、云海评分、详情抽屉。
- 所有第三方数据必须记录来源、许可证、版本/年份、分辨率、更新时间和缺失状态。
- 先写测试，再实现；`npm test`、`npm run test:live`、`npm run build` 全部通过。
- 地图 E2E 必须 mock Open-Meteo forecast 和 geocoding，覆盖：进入地图、搜索杭州、选择、7/14 天、保存点位。
- 真实浏览器人工检查 1440×900 与 375×812；截图加入 QA 记录。
- 不要合并 codex/local-validation-and-hardening 的 debcb68 提交或 `.workbuddy` / `.comet` 内容。
- 完成后提交到独立分支，给出 commit、测试证据、未解决阻塞和下一阶段清单。

先输出你识别到的当前状态和执行顺序，然后直接实现，不要停在方案。
```

## 完成定义

- 地图核心路径有稳定自动化覆盖。
- 光污染/云图均有可审计的数据合同；无数据时明确降级。
- 评分模型的任何变化都有版本升级、权重说明和边界测试。
- 页面不因第三方图层失败而阻断基本天气与点位功能。
