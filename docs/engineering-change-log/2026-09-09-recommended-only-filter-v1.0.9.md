# 工程修改跟踪：v1.0.9 首屏推荐地点筛选入口

> 基线：`main@a578dab65e22e3cbe823d0f1f79f56bf53c58f0f`（v1.0.8）
> 分支：`codex/recommended-only-filter-20260909`

## 变更目的

用户需要在打开星空摄影观测平台后立即决定是否只显示达到推荐门槛的地点。原有开关已存在于“图层与偏好”中的观星地点面板，本次将它移动到顶部命令栏，并紧跟“我的位置”按钮；评分与数据契约不变。

## 实施内容

- `src/components/MapSearchCard.tsx`：复用 `state.recommendedOnly`、`state.recommendationThreshold` 与 `setRecommendedOnly`，在搜索/定位行中新增无障碍复选框。
- `src/components/ObservingMapControl.tsx`：移除重复的面板开关，保留推荐门槛滑块、评分时次、四档评分筛选和数量说明。
- `src/app/globals.css`、`src/components/workspace/workspace-shell.css`：新增命令栏开关的选中/焦点样式，1023px 以下让搜索独占一行并将定位与筛选并排，避免窄屏横向溢出。
- `tests/e2e/workspace-shell.spec.ts`：覆盖开关位于“我的位置”之后、默认关闭、点击后 marker 数量下降及 LocalStorage 持久化（桌面/移动端）。
- 版本元数据、根/文档 Changelog 与交互式版本记录同步至 v1.0.9。

## 数据与语义边界

- “推荐门槛”仍由右侧“推荐门槛”滑块决定，默认值和现有用户偏好不变；本次未调整 85–100/70–84/55–69/0–54 的评分档位。
- 开关开启时沿用现有逻辑：无当前时次评分或分数低于门槛的点位不显示；数据不足不会被当作低分或合格点位。
- Bortle/VIIRS、天气、卫星和视口推荐仍使用既有数据源及真实性边界；没有新增外部数据或评分算法。

## 验证记录

- TDD RED：未接线的命令栏回归在桌面/移动端均因找不到复选框失败。
- TDD GREEN：当前源码构建后同一回归 2/2 通过；包含顺序、状态、marker 数量和 LocalStorage 断言。
- 版本一致性、Lint、TypeScript、全量 Vitest、生产构建和完整 E2E 将在合并前执行；公网部署沿用 `docs/ALIYUN_DEPLOYMENT.md` 的低内存流程。
