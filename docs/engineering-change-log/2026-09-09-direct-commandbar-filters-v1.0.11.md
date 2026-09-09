# 工程修改跟踪：v1.0.11 顶部直接筛选控件纠正

> 基线：`main@fed0565dbe9ff3c978a383663e800f73e77ef92a`（v1.0.10）
> 分支：`codex/direct-commandbar-filters-20260909`

## 变更目的

用户明确要求首屏直接看到必要参数，不再点击“评分设置”打开大面板：四档参考暗空筛选、评分时间和推荐分数门槛都应位于顶部状态栏；同时需要把 B1–B4 的含义讲清楚。

## 实施内容

- `src/components/RecommendationQuickControls.tsx`：新增轻量顶部控件，直接渲染 B1–B4、评分时间滑块和推荐门槛滑块，复用现有 store 状态。
- `src/components/BortleFilterBar.tsx`：补充可见的 B1 极暗、B2 自然暗夜、B3 乡村夜空、B4 乡村/郊区过渡文案，并支持命令栏紧凑变体。
- `src/components/MapSearchCard.tsx`：移除命令栏 `<details>` 与完整 `ObservingMapControl`，保留推荐开关并挂载直接控件。
- `src/components/PerseidsApp.tsx`：移除地图重复的 Bortle 筛选条，避免顶部与地图双重入口；右侧/移动端详细面板保持不变。
- `src/app/globals.css`、`src/components/workspace/workspace-shell.css`：搜索框收窄至约 220px，桌面 1280/1440 同排呈现，B1–B4 按文案自然分配宽度，窄屏按可读顺序堆叠，控件满足键盘焦点与无水平溢出要求。
- `src/lib/store.tsx`：读取推荐门槛时区分缺失 key 与数值 0，避免新用户默认值 70 被错误夹到 50。
- 测试、版本记录、Changelog、任务计划同步至 v1.0.11。

## 数据与语义边界

- B1–B4 是整理点位目录的暗空参考标签，只用于点位筛选与着色，不是当前坐标的现场 SQM/Bortle 实测，也不进入实时天气评分。
- 评分时间继续使用 `cloudState.activeForecastTime`；推荐门槛继续使用 `recommendationThreshold` 和既有 LocalStorage；未修改评分算法、天气接口或地点目录。
- 详细统计、四档实时推荐颜色筛选等低频信息仍由既有地点设置面板提供。

## 验证记录

- TDD RED：旧 v1.0.10 构建在桌面/移动端均因仍存在 `recommendation-settings` 失败（2/2）。
- TDD GREEN：新构建后顶部直接控件回归桌面/移动端 2/2 通过；`/sites` B1 与 B1–B4 组合点位回归 2/2 通过；最终命令栏 focused 回归 5/5 通过。
- `npm run check`：51 个 Vitest 文件 / 302 个测试、Lint、TypeScript、生产构建全部通过。
- `npm run test:e2e`：106 passed / 34 skipped / 0 failed（140 实例）；`npm run test:live` required/optional 全部通过；`npm audit --omit=dev --audit-level=high` 为 0 vulnerabilities。
- 合并后的主线 SHA、远端部署 SHA 与公网 `/healthz` 将在发布后补录。
