# 当前交接 — 2026-11-03 v1.0.33 上线与云海校准接力

状态：DEPLOYED_AND_VERIFIED / NEXT_PHASE_HANDOFF。
生产运行：v1.0.33，HEAD `af3d94646760782c445378e17eaf7c524d1ad4b9`，镜像 `sha256:3240039532d4…`。

## 精确身份

- 仓库：`Jovifei/Star_photo_addr`
- main 最新 HEAD：`af3d94646760782c445378e17eaf7c524d1ad4b9`
- main tree：`9766bfe8b2ad075752ffa7ae4c2691cbbb8b67ef`
- 已合并 PR #64（v1.0.32 六大山峰机位坐标修正与预热优化）：`d2e42ede`
- 已合并 PR #65（云海降级 30s 沿用与全失败部分数据回退）：`e287d02`
- 已合并 PR #66（火烧云降水排除/无窗口与数据不足语义分离）：`af3d946`
- 云海校准接力方案：`docs/handoff-docs/CLOUDSEA_CALIBRATION_HANDOFF_20261103.md`

## 现网验证结果（v1.0.33）

1. **火烧云现网真机 390px 验收**：
   - 临安大明山（`finder-074-location`，30.022°N, 118.982°E）：
     - 11-03 晚霞：显示 `[降水条件排除]`，真实低云 100%、中高云 100% / 2%、降水 0.5 mm、能见度 0.7 km、参考时次 17:00，条件指数 `—`（null），无最佳拍摄时刻。
     - 11-03 朝霞：显示 `[中烧]`，条件指数 64，最佳时刻 06:00。
     - 11-04 晚霞：显示 `[降水条件排除]`，降水 2.1 mm，评分 null。
   - 截图与报告已归档在 `E:\Claude_allow\Download\starphoto-v1.0.33-damingshan-390px-20261103\`。
2. **云海部分覆盖沿用**：
   - 第二次请求命中 `degraded-reuse`，显示“沿用上次部分结果，未重复请求上游”；彻底避免 429 风暴。

## 下一阶段接力：云海命中率独立真值校准

详见 `docs/handoff-docs/CLOUDSEA_CALIBRATION_HANDOFF_20261103.md`。
远端长任务聚焦：
1. Phase 2 谷底 8–15 km 周边地形多点采样与落差水汽特征计算；
2. 借鉴 FogPy / Satpy 双通道红外亮温差分与 MetPy LCL 补充物理边界；
3. 留出集（Sonnblick + 独立机位）闭环验证门禁：正例 ≥10、≥60推荐 ≥20、精确率 ≥75%、捕获率 ≥40%。
