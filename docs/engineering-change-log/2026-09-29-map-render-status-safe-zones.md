# P4-B 地图渲染状态安全区与徽章减噪

日期：2026-09-29
远端规划任务：`c2c_7b2f`
包：`MOBILE-V2-P4B-MAP-RENDER-STATUS-SAFE-ZONES`

## 边界

- 基线：`codex/map-chrome-hierarchy-v2-20260929@4c7fc1dc18487e2679cb1eb7428fadeb1041a9d9`。
- Owner `main@3334e0c` 保持 dirty；本轮在新隔离 worktree 执行。
- MapTileStatus 继续拥有 tileerror/tileload/重试事实；SatelliteLayer 继续拥有目录、帧保留和卫星加载事实。
- 不新增 MapHealthProvider、共享状态 store、P3 `data-state`，也不修改 scoring、provider/cache、snapshot/API/store、P4-C marker 或 P5 专题逻辑。

## 技术路线

- 新增纯视觉 `map-render-status`、`map-render-status--tile`、`map-render-status--satellite` class；不把 render failure 映射成天气数据失效。
- 桌面 tile 状态放在 MapLayerBar 下方的 top-right lane；卫星状态固定 bottom-left lane，移除 `bottom: 285px` magic number。
- 移动端 tile 右上并避让 Leaflet zoom，卫星左下并避让右侧工具 rail；短横屏继续使用同一 safe zone，drawer 以更高 stacking context 覆盖地图状态。
- Satellite `frame + catalogue.error` 只渲染一张 `role=status` badge，保留“数据目录降级”和“已保留上一帧”语义。
- Tile 错误原文“地图底图或图层加载失败；当前画布不代表天气数据为空。”和重试按钮保持。

## 验收证据

- `npm run check`：PASS — 65 Vitest files / 378 tests，lint、typecheck、build。
- P4-B safe-zone E2E：3 PASS / 3 project skips，覆盖 desktop、390×844、812×375，含 rail/viewport/overflow 与 drawer stacking。
- `map-canvas-status.spec.ts`：5 PASS / 5 project skips。
- 卫星 degraded/product-integrity focused：PASS；普通 satellite app regressions：PASS。
- Full Chromium、cross-browser、真实设备、CI、production：`NOT_RUN`。
- Final tip：`c208a0b7d0a4419f03deccc51ca7dd67cf8795e6`。

远端复审已确认最终 tip、单 badge、safe-zone geometry、tile truth boundary、P3/data owners 和 Owner preservation 均通过，返回 `DONE`。下一包进入 P4-C marker/label disclosure。
