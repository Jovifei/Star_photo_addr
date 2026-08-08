# 交付概览 — 跨午夜夜晚标注（Q1）+ 双产品打通（Q2）

**TL;DR**：为星野摄影选址应用补全了「跨午夜夜晚」的清晰标注，并打通了「星野决策（/viirs）」与「逐星深度分析（/）」两个产品页的跳转与地图联动。已提交并纯 fast-forward 推送到 `origin/feature/20260807/local-run-finalization`。

## 交付状态
- 测试通过率：**80 / 80**（新增 27 项，覆盖 AC-1 ~ AC-8）
- 已知问题：**0**（仅存量 eslint/dist 配置项，与本次改动无关）
- `next build` / `tsc` / `eslint`（5 个改动文件）全部绿灯

## Q1 — 跨午夜夜晚标注
- 夜晚锚定到**当晚起始日**：`8月7日 夜间` = 8/7 20:00 → 8/8 05:00。
- 表头/紧凑态：`8/7夜`；hover 完整态：`8月7日 周五 夜间（20:00–次日05:00）`。
- 时间轴读数：当晚时段显示 `21:30`，跨越午夜后显示 `01:15（次日）`，0:00–05:00 正确归属到「次日」日历日。
- 红线：`formatHour` 被 `scoring.ts` 依赖，已字节级保留未改。

## Q2 — 双产品打通
- `/viirs` 侧栏「前往逐星深度分析 →」：先 `selectLocation(选中点)`（写入全局 store + localStorage），再 `router.push("/")`。
- `/` 主图：当选中点更新后，`MapCanvas` 内 `RecenterOnSelected` 子组件自动 `setView` 重定位并放大到该点（最小 zoom 8）。
- `/viirs` 地图自身不联动（传 `recenterOnSelect={false}`），避免误重定位。

## 文件清单
| 文件 | 改动 |
|------|------|
| `src/lib/nighttime.ts` | 重写 `formatNightLabel`、新增 `formatHourWithDate`、保留 `formatHour` |
| `src/components/CloudTimeline.tsx` | 时间轴读数 + hover 完整夜间窗口 |
| `src/components/StarWindowTable.tsx` | 表头 title 加完整窗口说明 |
| `src/app/viirs/page.tsx` | 侧栏按钮跳转 `/` 前写入选中点 |
| `src/components/MapCanvas.tsx` | 新增 `RecenterOnSelected` 重定位子组件 |
| `tests/unit/nighttime.test.ts` | +27 单元测试 |

## 用户下一步建议
1. 本地预览：在 `/` 与 `/viirs` 各选同一地点，确认主图重定位与侧栏跳转。
2. 验收跨午夜：选 8/7 20:00–8/8 05:00 的观测窗，确认 `01:15（次日）` 标注。
3. 提 PR：将 `feature/20260807/local-run-finalization` 向 `main` 发起 PR（本次仅推远端分支，未合 main）。
4. 后续清理：在 `eslint.config.mjs` 的 `globalIgnores` 加 `"dist/**"`，消除存量 `eslint .` 崩溃。
5. 部署：按既有 docker-compose / nginx 流程发布（未改动 CI/部署配置）。
