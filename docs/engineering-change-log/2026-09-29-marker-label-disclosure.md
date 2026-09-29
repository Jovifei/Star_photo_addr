# P4-C Marker / Label Disclosure

日期：2026-09-29
远端规划任务：`c2c_c6d3`
包：`MOBILE-V2-P4C-MARKER-LABEL-DISCLOSURE`

## 边界与路线

- 基线：`codex/map-status-safe-zones-v2-20260929@8d672172fbeee14f3a4b035935e03bfb4e39e184`。
- Owner `main@3334e0c` 保持 dirty；本轮只在独立 worktree 执行。
- 参考目录点位由 `ObservingSitesLayer` 保持 selected marker 与唯一永久标签；`SampleMarker` 继续负责搜索、地图取样和自定义坐标。
- 选中的目录点位被筛选排除时只 pin 当前 context，不改 `data-observing-site-count` 或筛选结果。
- `ViewportRecommendationMarkers` 保持 Leaflet 原生 Tooltip 的 hover/focus/click 临时披露；不引入 clustering、全局 tooltip state 或新地图引擎。
- `spacedLabelIndices` 算法不改，只增加单元保护；Fireglow/CloudSea P5 不混入。

## 落地内容

- MapCanvas 在 `ObservingSitesLayer` 确实拥有目录选择时抑制重复 `SampleMarker`，否则保持普通 SampleMarker。
- ObservingSitesLayer 将被过滤掉的当前目录选择追加为最多一个 pinned context marker；浏览计数仍反映原 filtered set。
- 新增 `marker-label-disclosure.spec.ts` 覆盖目录选中单 owner、筛选 pin、搜索/custom SampleMarker 和排名 Tooltip；补充 labelLayout priority/collision 单测。

## 验收证据

- `npm run check`：PASS — 65 Vitest files / 379 tests，lint、typecheck、build。
- Marker focused：目录/筛选/search 5 PASS / 1 project skip；rank Tooltip 1 PASS；viewport recommendations 2 PASS。
- 回归：app、mobile-map-first、map-render-status-safe-zones 31 PASS / 19 project skips。
- Full Chromium、cross-browser、真实设备、CI、production：`NOT_RUN`。

远端复审需确认 selected marker owner、筛选 pin、rank temporary tooltip、spacedLabelIndices 未改、P4-B/P5 未混入及 Owner preservation。
