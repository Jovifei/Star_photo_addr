# 工程修改跟踪：v1.0.6 生产验收一致性 Hotfix

> 基线：`main@cee9dde09ed7a4d6e8736dc2ea020b244d49cd95`
> 分支：`fix/v1.0.6-production-hotfix-20260908`

## 目的

修复生产验收发现的版本徽标漂移、CloudSea/Fireglow 空评分被着色为最低等级，以及 DataV 行政边界自动请求 403。此次不改变任何评分权重、pressure profile 算法或数据门限。

## 修改范围

- `package.json`、`package-lock.json` 升至 `1.0.6`；新增 `src/lib/appVersion.ts` 作为唯一版本源。
- `ProductHeader`、`healthz`、`ChangelogModal` 复用包版本；更新 v1.0.6 记录并修正 v1.0.5 的 pressure-level 说明。
- CloudSea/Fireglow 的 null score 通过纯函数归类为 `unknown`，使用 muted 灰色、低透明度、虚线 marker；图例、popup 和详情显示“数据不足”。
- `BoundaryLayers` 仅加载本地授权 GeoJSON；天地图官方 `ibo_w`/`cia_w` 逻辑保持不变；无授权边界时不发起 DataV 请求。
- README、运维说明和测试台账同步实际字段与 fail-closed 语义。

## 未改变与验证边界

- CloudSea pressure 层完整性（每小时至少 6 层）、严格多数窗口、逆温不加分和 8–15 km Phase 2 均保持原实现。
- CloudSea/Fireglow IDW overlay 仍过滤 null score；本地与生产验证必须继续区分真实数据、模型证据和可选边界能力。
- 回滚目标为 `cee9dde09ed7a4d6e8736dc2ea020b244d49cd95`。
