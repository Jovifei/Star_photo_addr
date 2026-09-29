# P5-A 火烧云专题 IA 与视觉减噪

日期：2026-09-29  
远端规划任务：`c2c_d92e`  
包：`MOBILE-V2-P5A-FIREGLOW-TOPIC-IA`

## 基线与边界

- 基线：`codex/marker-label-disclosure-v2-20260929@21d07ef1f72e3e307cd6f2880f3c1552939ee830`。
- Owner `main@3334e0c` 的未提交修改保持不动；本轮只在隔离 worktree 执行。
- 只调整 Fireglow 的呈现层，不修改 provider、cache、snapshot/API、评分、排行或 CloudSea。
- 保留 `HTTP 200` 空评分不可用、stale fallback 不新鲜、阶段无分与门槛筛空互相区分的事实。

## 技术路线

- 继续消费 `visibleStatus`、`visibleError`、`dataQualityNotice`、`phaseUnavailableNotice`、`hasUsableData`、`hasUsablePhaseData` 和 `filteredRanked`，不创建新的专题状态机或通用 `data-state` 映射器。
- 桌面地图只保留点位、插值层、Leaflet 控件和必要的降级状态；永久色阶和长口径移到排行栏底部默认关闭的原生 `details`。
- 详情中的低频 Field Blueprint 默认关闭；关键云层证据和缺失值提示继续默认可见。
- 移动端继续只有一个 `MobileDataSheet`，peek 结论按 loading、不可用、stale、阶段无分、选中点位和坐标选点的事实优先级展示。
- 移动排行在存在有效阶段评分但门槛筛空时明确显示 `暂无达到 ≥X 分的地点`，不伪装成无数据或阶段不可用。

## 验收证据

- `npm run check`：PASS（65 个 Vitest 文件、379 项；lint、typecheck、build）。
- P5-A 专项 E2E：桌面空快照、披露、失败日期优先级 3 PASS，移动空快照/peek/390×844/812×375 1 PASS（其余项目按设计跳过）。
- Fireglow 完整性 7 PASS，门槛筛选 2 PASS，未知标记 1 PASS，刷新闭环 1 PASS，产品完整性 3 PASS，mobile map-first `/fireglow` 1 PASS。
- `git diff --check`：PASS。
- Full Chromium、cross-browser、真实设备、CI、production：`NOT_RUN`。

## 远端交接

推送后远端 ChatGPT 需要在精确 branch tip 上独立复审：空快照边界、stale/phase/threshold 分离、地图色阶披露、详情披露、移动 peek 真值、Fireglow 数据所有者未改、CloudSea 未改和 Owner 保留。远端返回 `DONE` 后才能启动 P5-B CloudSea Evidence IA。

## 远端复审结果

远端已在 `156c31ec209352328c829df55dd38f432e8197dc` 返回 `DONE`。复审确认移动 threshold-empty 文案与 72/60/40 空列表夹具、HTTP 200 空评分防线、stale/phase 分离、地图和详情 disclosure、Fireglow 受保护 owner、CloudSea 未改及 Owner 保留均通过。该 tip 的产品/测试工作已完成；交接文档的 docs-only 收尾后进入 P5-B 规划。完整 Chromium、跨浏览器、真实设备、CI、production 仍为 `NOT_RUN`。
