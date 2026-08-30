# 工程修改跟踪：UI 重构地基批次 0

> 日期：2026-08-29
> 基线：`main@6b649ab2a2b07fb2af0df7c2df4e28126821744d`
> 分支：`fix/ui-foundation-batch0-20260829`

## 1. 目的

在 WorkspaceShell 重构前先清理会污染新壳层的数据和视觉缺陷：

- 匿名 CARTO 瓦片在全部地图上显示 `API KEY REQUIRED`；
- 相同坐标可因来源 ID 不同进入候选两次；
- Planner 深链会静默写入候选；
- 单字串“降水风险/雷暴风险”缺少标题和行动建议；
- Planner 页头视图按钮被压成竖排；
- 独立固定“附近排行”与 Planner 已有附近推荐重复并遮挡观测夜内容；
- 空状态文案不完整。

## 2. 完成内容

### 2.1 底图供应商边界

- 新增 `NEXT_PUBLIC_BASEMAP_TILE_URL` 与 `NEXT_PUBLIC_BASEMAP_ATTRIBUTION`；
- 默认不再请求匿名 CARTO；零配置时使用 OpenStreetMap 标准瓦片并在客户端暗色化；
- 所有 Leaflet 工作区统一使用同一底图配置；
- Dockerfile、Compose、`.env.example` 完整透传构建时变量；
- 后续高流量生产应切换到自有/授权瓦片或 OpenFreeMap/PMTiles，不把公共 OSM 当无限 CDN。

### 2.2 候选地点唯一性

- 新增 `locationIdentity.ts`，ID 相同或经纬度到 5 位小数相同均视为同一地点；
- Store 的导入、添加和 localStorage 回写统一去重；
- Planner 合并共享候选、深链点和本地自定义点时按坐标去重；
- 深链地点仅参与当前会话，不再静默收藏；
- 地图重复点击同一点产生稳定 ID；
- `CityCandidate` 可选保存海拔，兼容旧记录。

### 2.3 四项界面快修

- 风险原因改成“主要风险/当前结论”结构卡，已知风险附行动建议；
- Planner 空状态明确说明输入来源和 3/5/7 夜比较；
- Planner 页头控件设置 `max-content + nowrap`，视图按钮和刷新按钮最小高度 44px，避免按钮竖排；
- 删除 PlannerClient 中重复的固定附近排行挂载，统一使用页面内 10/50/100/200 km 推荐；
- 附近推荐在窄屏与短横屏（max-width 768px 或 max-height 520px）使用 3 列网格，避免 100 km 挡住 200 km。

### 2.4 候选恢复与排行身份

- Store 在水合完成前不会用空数组覆盖已保存的候选；
- Planner 附近推荐和最终排行池按坐标身份去重，避免同站两行。

## 3. 测试

新增：

- `tests/unit/locationIdentity.test.ts`；
- `tests/e2e/ui-foundation-batch0.spec.ts`；
- 更新 Planner 附近推荐 E2E 和底图请求 Mock。

发布门禁：`npm run check`、Chromium 全量 E2E、Firefox/WebKit 核心冒烟、live-data、container smoke。

2026-08-30 收口复核（本机 Node v24.18.0）：

- `npm audit --omit=dev`：0 vulnerabilities
- `npm run check`：ESLint PASS，TypeScript PASS，Vitest 38 files / 227 tests PASS，Next.js 16.3.0 production build PASS
- `npm run test:e2e`：94 tests，83 passed，11 skipped，0 failed，2.2m
- `npm run test:e2e:cross-browser`：4 passed（Firefox 2 + WebKit 2），19.2s
- production 截图（未提交）写入 `tmp/ui-batch0-validation/`：桌面 1440×1000、平板 1024×768、手机 390×844、横屏 844×390；四入口均请求 OSM、0 次 `cartocdn.com`、署名含 OpenStreetMap、无 `API KEY REQUIRED`
- Planner 地图视图的 `documentElement.scrollWidth` 会被 Leaflet `.leaflet-proxy` 撑大，但 `body { overflow-x: hidden }`，截图无用户可滚动的横向溢出

## 4. 明确不在本批次

- WorkspaceShell、DecisionSummary、ContextInspector；
- 暗夜选址 2–3 点对比托盘；
- 火烧云执行建议和最终计划卡；
- 道路风险、驾车距离、可达性（当前没有真实数据源）；
- OSM 公共瓦片的长期高流量生产承诺。

这些内容按后续独立 PR 实施，避免把快速地基修复和大规模布局重构混在一个回滚单元。
