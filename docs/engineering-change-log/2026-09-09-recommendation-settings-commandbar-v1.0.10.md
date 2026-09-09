# 工程修改跟踪：v1.0.10 命令栏评分设置前置

> 基线：`main@d288eac46eeaa90e8bb52dbdd1472c245259c30c`（v1.0.9）
> 分支：`codex/recommendation-settings-commandbar-20260909`

## 变更目的

v1.0.9 已把“仅显示达到推荐门槛的地点”放到顶部命令栏。用户进一步要求图片中的完整设置也能从首屏进入：推荐门槛、评分时次、当前显示/达标数量，以及 85–100、70–84、55–69、0–54 四档筛选。本次采用“状态栏摘要 + 原生折叠设置”前置入口，避免移动端把多个滑块硬挤在一行。

## 实施内容

- `src/components/MapSearchCard.tsx`：在推荐开关后增加原生 `<details>`“评分设置”入口；展开时挂载现有 `ObservingMapControl`，关闭时不额外挂载评分面板。
- `src/app/globals.css`、`src/components/workspace/workspace-shell.css`：为摘要、展开态、焦点态和命令栏宽度提供一致样式；展开面板在桌面/手机均换行并保持可滚动、可聚焦。
- `tests/e2e/workspace-shell.spec.ts`：新增桌面/移动端回归，验证入口顺序、展开后的门槛滑块、评分时次、数量与四档复选框，以及页面无水平溢出。
- `package.json`、`package-lock.json`、`src/components/ChangelogModal.tsx`、根/文档 Changelog 与任务记录同步至 v1.0.10。

## 数据与语义边界

- 本次未调整评分算法、推荐门槛默认值、四档区间、地图 marker 过滤、视口推荐或任何外部数据源。
- 评分设置使用现有 `recommendationThreshold`、`activeForecastTime`、`visibleRecommendationBands` 和 LocalStorage；开关和详细面板只有一套状态来源。
- 数据不足点位仍按既有 unknown 语义处理，不会被当作低分或达标点位。

## 验证记录

- TDD RED：未挂载入口时，桌面/移动端完整评分设置回归因找不到 `recommendation-settings` 失败。
- TDD GREEN：当前源码构建后完整评分设置回归桌面/移动端 2/2 通过。
- `npm run check`：51 个 Vitest 文件 / 302 个测试、Lint、TypeScript、生产构建全部通过。
- `npm run test:e2e`：106 passed / 34 skipped / 0 failed（140 实例）。
- `npm run test:live` required/optional 数据源全部通过；`npm audit --omit=dev --audit-level=high` 为 0 vulnerabilities。
- 合并后按 `docs/ALIYUN_DEPLOYMENT.md` 部署并核对公网入口。
