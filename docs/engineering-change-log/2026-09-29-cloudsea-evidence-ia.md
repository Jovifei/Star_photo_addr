# P5-B 云海证据 IA 与视觉减噪

日期：2026-09-29  
远端规划任务：`c2c_d92e`，iteration 2  
包：`MOBILE-V2-P5B-CLOUDSEA-EVIDENCE-IA`

## 基线与边界

- 基线：`codex/fireglow-topic-ia-v2-20260929@47779d74b6fe1d160bc2d68c90b9712101b1de33`。
- Owner `main@3334e0c` 的未提交修改保持不动；本轮在新的隔离 worktree 执行。
- 只调整 CloudSea 呈现层和回归契约，不修改 CloudSea 数据、provider/cache、snapshot/pressure API、评分、排行或 Fireglow。
- 保留 surface 必须真实可用、pressure 可 partial、vertical unknown 不等于低分、unknown-only 不等于 threshold-empty 的事实。

## 技术路线

- `CloudSeaApp` 只组合已有快照和窗口事实：全局 coverage/stale/error 进入 evidence status，选中窗口的 score、surface 和 pressureStatus 决定移动主结论。
- 选中窗口直接读取当前快照中的原始 window，避免 score=null 时只留下空占位而丢掉真实 humidity/wind。
- 桌面地图不再常驻 legend；ranking 底部用默认关闭的 native `details` 展示色阶、插值和非实测概率说明。
- 列表卡片保留地点、海拔、条件指数、山顶/云层关系和必要 evidence hint；模式云顶、落差、风速、长 summary 保留在详情。
- 详情默认显示 pressure evidence、surface 指标、垂直证据和逆温；Field Blueprint 默认关闭。移动端继续只有一个 `MobileDataSheet`。

## 验收证据

- `npm run check`：PASS（65 个 Vitest 文件、379 项；lint、typecheck、build）。
- P5-B 专项 E2E：4 PASS / 4 project skips；pressure 4 PASS；unknown-only 1 PASS；threshold desktop/mobile 2 PASS；request-order 1 PASS；day3 1 PASS；mobile map-first `/cloudsea` 1 PASS。
- CloudSea unit/integration/release integrity：41 PASS。
- Follow-up RED→GREEN：三日 winning window 1 PASS、selected fresh winner under another stale date 1 PASS；selected context now binds `window + dateKey + snapshot`.
- `git diff --check`：PASS。
- Full Chromium、cross-browser、真实设备、CI、production：`NOT_RUN`。

## 远端交接

推送后远端 ChatGPT 需要在精确 branch tip 上独立核对 surface/pressure coverage、selected score 在全局 partial 下的保留、pressure unavailable 的 vertical unknown、unknown-only 与 threshold-empty、mobile total failure、桌面 disclosure、受保护文件 blob、Fireglow 未改和 Owner 保留。远端返回 `DONE` 后才进入下一阶段。
