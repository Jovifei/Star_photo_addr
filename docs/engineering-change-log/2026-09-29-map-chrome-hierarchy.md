# P4-A 地图画布层级与工具减噪

日期：2026-09-29
远端规划任务：`c2c_d7b2`
包：`MOBILE-V2-P4A-MAP-CHROME-HIERARCHY`

## 基线与边界

- 基线：`codex/data-state-surfaces-v2-20260928@90050e710829ea841b3774105506f27dcbf800b8`。
- Owner `main@3334e0c` 保持 dirty；本轮只在独立 worktree 执行。
- 本轮只处理地图 chrome、legend 和低频工具的呈现位置；不改变 P3 的 Provider Health、Selected Data Validity、Recommendation Eligibility 语义。
- 未进入 P4-B（tile/satellite/error overlay safe zones）、P4-C（marker/label disclosure）或 P5（Fireglow/CloudSea）。

## 落地内容

1. 新增 `src/components/MapReferenceTools.tsx`，以原生 `<details>` 统一收纳 `MapLegend`、`MapViewActions`、`MapBoundaryStatus`，只负责 composition 和 disclosure。
2. 桌面地图画布只保留 `MapLayerBar`、Leaflet 原生控件、渲染层和 markers；`MapBoundaryStatus` 在设置检查器中保留一处。
3. 从当前 `PerseidsApp` 移除 `MapPanelManager` 挂载；保留旧组件、storage key 和文件，避免 destructive migration。
4. 移动端图层抽屉默认仅显示 `MapLayerBar`、`BortleControl` 和折叠入口；打开“地图说明与视图”后才显示低频工具。继续只有 `.mobile-map-panel-body` 负责纵向滚动。
5. 新增 scoped CSS，消除 legacy absolute/transform 规则在 inspector 和 drawer 中的泄漏；summary 保持 48px 触控高度和 focus-visible。

## 验收证据

- `npm run check`：PASS；65 个 Vitest 文件 / 378 项测试，lint、typecheck、production build 均 PASS。
- P4-A focused：`map-chrome-hierarchy.spec.ts` + `mobile-panel-dock.spec.ts`，6 PASS / 6 project skips。
- 远端复审补充：移动端 `MapReferenceTools` summary 高度在 390×844 与 812×375 均 `>=48px`；产品/测试 follow-up 为 `ceea9189fd4a653913cbbaae155f110121eb195a`，最终文档 tip 为 `450e08eb0a0b207ea1c2c59083c8f89a1ea9706e`。
- 回归：`map-readability.spec.ts`、`workspace-shell.spec.ts`、`mobile-map-first.spec.ts`，41 PASS / 25 project skips，0 failed。
- Full Chromium、cross-browser、真实设备、CI、production：`NOT_RUN`。

## 下一轮

远端 ChatGPT 需要独立检查最新推送 tip、桌面 canvas overlay 数量、移动 drawer disclosure、MapPanelManager 是否不再挂载、回归证据及 P3 数据边界，然后返回 `DONE` / `CHANGES_REQUIRED` / `BLOCKED`。只有 `DONE` 后才进入 P4-B。
