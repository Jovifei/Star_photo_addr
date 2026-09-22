# D01–D05 数据展示问题跟进

> 后续复核修正：D05 原图现已成功读取全部八张；瓦片恢复、火烧云失败后的旧数据一致性仍需后续补丁，本轮已继续完善。原文记录的是该提交时的状态，最新事实见 `2026-09-22-recovery-and-original-screenshots.md`。

状态：`D01–D04 FIXED_AND_TESTED / D05 EVIDENCE_BLOCKED`

## D01：评分字段完整性

根因是 `CloudTimeline.forecastQualityLabel` 过去只判断来源字符串和 `stale`，没有检查当前时次的评分输入字段。现在使用 `missingNightInputs` 检查云量分层、降水、风、阵风、能见度、天气代码、温度、湿度和露点，分别显示：

- `评分字段完整，可用`
- `天气可展示；评分字段缺失：...`
- `过期/降级，禁止推荐`

新增单元断言覆盖完整字段和缺少能见度字段。

## D02：云海跨日期旧请求

根因是日期切换共享 `snapshots` 状态，但请求没有统一的 AbortController 和请求代次；旧日期可能晚于新日期回写 `snapshots`、`dataNotice`、loading 状态。现在每次加载：

- 递增请求代次；
- 取消上一代请求；
- 只有当前代次允许写入状态；
- effect 清理时取消请求并阻止旧 finally 修改 loading。

新增延迟乱序 E2E：明日请求故意慢于今日，最终排行和日期必须仍是今日。

## D03：火烧云 stale 地图/排行/详情一致性

旧逻辑虽保留 stale 快照和降级提示，但地图、排行和详情没有共享明确的降级语义。现在活动日期任一快照 stale 或有 refreshError 时，地图、排行标题和详情共同显示：

`数据已降级：地图、排行与详情仅供参考，禁止作为新鲜推荐`

现有 stale 快照 E2E 扩展为地图状态、排行状态和详情状态三处断言。

## D04：黑/白画布原因

已有天气网格和卫星目录错误提示，但底图 tile 失败没有统一提示，CloudCanvas 当前时次有效数不足时也会静默返回。现在：

- 所有 Leaflet 地图监听具体 TileLayer 的 `tileerror`，显示底图/图层失败状态；
- CloudCanvas 区分容器等待重绘和当前时次无足够数值；
- 天气网格错误继续显示独立的 API 失败和重试操作；
- 卫星目录错误继续保留“上一帧/数据目录降级”语义。

故障注入 E2E 同时注入 tile 503 和天气网格 502，确认两种原因分别出现。

## D05：八张原始截图

本轮仍没有可由本地工具读取的原始八张截图文件，无法对旧截图中的每个标签、单位和遮挡位置做逐项证据闭环。新增的完整应用截图只能证明当前候选页面在 mock 数据下的布局，不替代原图对照。

## 验证

- Node `v24.18.0`、独立依赖。
- `npm run check`：PASS，60 files / 352 tests / build。
- D01：timelineTrack unit PASS，6 tests。
- D02：cloudsea request-order E2E PASS。
- D03：fireglow stale consistency E2E PASS，2 tests。
- D04：map tile 503 + forecast 502 E2E PASS。
- 完整 Chromium：`145 passed / 61 skipped / 0 failed`；已包含 D02/D03/D04 故障注入、候选专项、截图和旋转测试。
- 真实 provider smoke：PASS；应用 data-source 初次探测遇到一次瞬时 satellite degraded，重试 PASS。
- 未合并 main，未部署生产。
