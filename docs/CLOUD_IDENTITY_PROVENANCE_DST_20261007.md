# 云端身份、来源时间与 DST 阶段 — 2026-10-07

本阶段仅操作 Jovifei/Star_photo_addr。核实 origin 授权分支后，从 `35600636b969704ec8fa5dd9c1bf8ff650ecc0d1` 建立 `codex/cloud-identity-provenance-dst-20261007`。实际代码写入、git push 和 [Draft PR52](https://github.com/Jovifei/Star_photo_addr/pull/52) 已完成，不依赖旧 Project 只读前提。本报告的最终 head/tree 以 PR52 顶部精确记录为准；文档不能自引用自己的提交 SHA。

生产仍为 `5fbf7bac2c925d068f4c04274cbdbe79b0672ead` / 1.0.27；没有部署、合并 PR49、访问生产卷、清缓存或修改 Owner 两份笔记。保留 378 回滚和原快照卷。发布前必须再次运行 `scripts/check-release-frontend.mjs`，健康检查/镜像 SHA 不证明前端内容一致。

## 实际审核与实施

1. 四入口保持同级。入口 URL 传递版本化 LocationIdentity、坐标、名称、范围、选定本地日期、phase 与绝对 epoch。牛背山 observing/Fireglow 29.782/102.582 与 Cloudsea 29.742/102.325 不合并，不猜正确坐标；同 ID/同名不是坐标豁免。只有当前转换涉及冲突目录才提示。目录选择无需先存在天气评分。
2. Fireglow/Cloudsea 逐站保留原始 supplier/model/dataset 与 acquisition；worker generatedAt、response servedAt 分开。采集不是起报/观测，未知保持 null。内存/磁盘复用不改采集时间，缺来源旧缓存 stale，Cloudsea 部分可用覆盖仍展示。
3. 官方 Open-Meteo 仓库实际只读核对 SHA `290493ffb9b5ee66fb1336219487a346eb27d191`：[OpenAPI epoch 契约](https://github.com/open-meteo/open-meteo/blob/290493ffb9b5ee66fb1336219487a346eb27d191/openapi/forecast.yml#L520)、[Writer epoch 分支](https://github.com/open-meteo/open-meteo/blob/290493ffb9b5ee66fb1336219487a346eb27d191/Sources/App/Helper/Writer/ForecastApiResult.swift#L403)。unixtime 是 Unix UTC 秒，不能再加 utc_offset_seconds。surface 显式请求 epoch，IANA 逐小时偏移；重复墙钟小时保留两个 instant，旧 URL 默认较早、显式 epoch 精确选择；春季不存在小时没有假数据。气压层目前中国站点 ISO 契约保持，全球 DST pressure 不宣称已认证。
4. surface v4 与 Fireglow source-v1 新缓存命名空间；旧 v3/v2/原快照只读降级，不删文件、不提升可信度。ICON visibility 缺失维持评分暂缓，独立天文与原始天气可见，禁止混用 GFS/BestMatch。
5. live smoke 碰到 429 立即结束；新增本地实际 HTTP 429 集成测试证明只调用一次。缓存矩阵必须 --cache-only，不能 refresh 或强迫供应商。

## 测试证据与边界

- 基线 npm ci、lint、typecheck、86 文件/496 tests 实际通过。旧 main 的 420 测试/4 高危不是本候选结果。
- RED/GREEN：坐标身份新契约在旧源码失败；snapshot 来源 builder 新断言 1 FAIL/1 PASS 后通过；epoch/DST 新模块在旧源码失败后通过。原有 locationIdentity helper 和六个原测试保留，没有为刷绿删除功能断言。
- 阶段本地完整 npm run check：lint/typecheck/90 文件512 tests/build PASS。后续新增冷却测试与详情小时修复再验，限制并发并允许 localhost socket 后 91 文件513 tests PASS；lint/typecheck PASS。独立最新代码构建 PASS。默认 sandbox 实际 listen EPERM，允许 localhost 后并行争用造成一个旧测试5s超时，限制 maxWorkers=2 后全部通过，没有增加 timeout/删除断言。
- 实际 system Chromium 多进程：地点转换+导航 16 PASS；全量 392 cases 仍在执行时编写本报告。用真实 ffmpeg 记录视频、原断言不变；这是浏览器模拟，不能称 OnePlus/iOS。
- [c56 CI37631936317](https://github.com/Jovifei/Star_photo_addr/actions/runs/37631936317)：quality SUCCESS、container-smoke SUCCESS（包含内容门禁）、live-data-smoke SUCCESS；Firefox/WebKit SUCCESS；Chromium 尚待终态。CI checkout 为 PR merge `d18ac23936c82189ea8c7b2e26a3efc30089dc26`，包含 c56 head 与356 base，不等同生产。
- 真实供应商 smoke 于13:52:59Z：BestMatch/ICON/GFS/AIFS 各48小时、pressure5层、geocoding2结果、AQ24小时、NASA/NOAA/VIIRS 实际成功。这是有限契约/连通性检查，不是下列全地点矩阵或科学准确率。
- 本 VM 的供应商/生产域名 CONNECT403 Domain forbidden；Firefox/WebKit 下载域名 cdn.playwright.dev/prss.microsoft403。没有新增域名/密钥。托管 CI 可下载浏览器并执行其自己的 smoke。
- 本地只读28行天气矩阵实际执行，但缓存为空 HTTP429，因此 NOT_RUN；不能称真实天气矩阵 PASS。生产页面、生产卷、OnePlus、iOS、TalkBack、VoiceOver、预测准确率均 NOT_RUN。

## 每文件原因与风险

| 文件 | 原因 / 风险 |
|---|---|
| `.github/workflows/ci.yml` | 使授权 base 的 Draft PR 实际触发五 job，容器必须通过已验证 HTML 内容门禁。 |
| `Dockerfile` | 复制既有内容门禁脚本进入运行镜像，防健康新 SHA/旧页面。 |
| `scripts/acceptance-weather-matrix.mjs` | 只读缓存矩阵记录真实缺口；不刷新、不请求供应商、不认证预测准确率。 |
| `scripts/live-smoke.mjs` | 贯通绝对时次/地点上下文或紧凑冲突披露；风险是旧 URL 与布局兼容，需跨浏览器/真机回归。 |
| `src/app/api/cloudsea/snapshot/route.ts` | 来源时间/只读旧缓存或相关地点转换披露；风险是 stale/无来源数据不再被误标 fresh。 |
| `src/app/api/fireglow/snapshot/route.ts` | 来源时间/只读旧缓存或相关地点转换披露；风险是 stale/无来源数据不再被误标 fresh。 |
| `src/app/api/forecast/route.ts` | v4 epoch 完整性及坐标绑定，旧 v3/v2 只读 stale；风险是首次新缓存请求及旧 fixture 迁移。 |
| `src/app/cloudsea/CloudSeaApp.tsx` | 来源时间/只读旧缓存或相关地点转换披露；风险是 stale/无来源数据不再被误标 fresh。 |
| `src/app/fireglow/FireglowApp.tsx` | 来源时间/只读旧缓存或相关地点转换披露；风险是 stale/无来源数据不再被误标 fresh。 |
| `src/app/globals.css` | 贯通绝对时次/地点上下文或紧凑冲突披露；风险是旧 URL 与布局兼容，需跨浏览器/真机回归。 |
| `src/components/CloudCanvasOverlay.tsx` | 贯通绝对时次/地点上下文或紧凑冲突披露；风险是旧 URL 与布局兼容，需跨浏览器/真机回归。 |
| `src/components/CloudControl.tsx` | 贯通绝对时次/地点上下文或紧凑冲突披露；风险是旧 URL 与布局兼容，需跨浏览器/真机回归。 |
| `src/components/CloudLayer.tsx` | 贯通绝对时次/地点上下文或紧凑冲突披露；风险是旧 URL 与布局兼容，需跨浏览器/真机回归。 |
| `src/components/CloudTimeline.tsx` | 重复小时 rail/矩阵/键盘/播放使用 epoch；旧本地 URL 仍可用。 |
| `src/components/HomeDataSheet.tsx` | 贯通绝对时次/地点上下文或紧凑冲突披露；风险是旧 URL 与布局兼容，需跨浏览器/真机回归。 |
| `src/components/HourlyForecastMatrix.tsx` | 贯通绝对时次/地点上下文或紧凑冲突披露；风险是旧 URL 与布局兼容，需跨浏览器/真机回归。 |
| `src/components/LocationDetailCharts.tsx` | 详情小时按钮保留 epoch 与偏移，避免回拨小时选择落到首个。 |
| `src/components/NavTabs.tsx` | 四入口传递地点、日期及显式时次，相关坐标冲突才提示；风险是旧裸 URL 缺上下文。 |
| `src/components/PerseidsApp.tsx` | 贯通绝对时次/地点上下文或紧凑冲突披露；风险是旧 URL 与布局兼容，需跨浏览器/真机回归。 |
| `src/components/ProductStateBridge.tsx` | 四入口传递地点、日期及显式时次，相关坐标冲突才提示；风险是旧裸 URL 缺上下文。 |
| `src/components/SnapshotSourceDisclosure.tsx` | 来源时间/只读旧缓存或相关地点转换披露；风险是 stale/无来源数据不再被误标 fresh。 |
| `src/hooks/useTopicContext.ts` | 四入口传递地点、日期及显式时次，相关坐标冲突才提示；风险是旧裸 URL 缺上下文。 |
| `src/lib/absoluteForecastTime.ts` | 官方 UTC epoch 转为 IANA 本地标签；重复小时默认较早、显式 epoch 精确选择，缺失小时不补造；风险是旧无 epoch 缓存只能降级。 |
| `src/lib/cloudGrid.ts` | 贯通绝对时次/地点上下文或紧凑冲突披露；风险是旧 URL 与布局兼容，需跨浏览器/真机回归。 |
| `src/lib/cloudsea.ts` | 来源时间/只读旧缓存或相关地点转换披露；风险是 stale/无来源数据不再被误标 fresh。 |
| `src/lib/fireglow.ts` | 来源时间/只读旧缓存或相关地点转换披露；风险是 stale/无来源数据不再被误标 fresh。 |
| `src/lib/forecast.ts` | v4 epoch 完整性及坐标绑定，旧 v3/v2 只读 stale；风险是首次新缓存请求及旧 fixture 迁移。 |
| `src/lib/forecastClient.ts` | v4 epoch 完整性及坐标绑定，旧 v3/v2 只读 stale；风险是首次新缓存请求及旧 fixture 迁移。 |
| `src/lib/forecastIntegrity.ts` | v4 epoch 完整性及坐标绑定，旧 v3/v2 只读 stale；风险是首次新缓存请求及旧 fixture 迁移。 |
| `src/lib/hourScore.ts` | 持续时间、去重及天文计算使用绝对小时，避免 DST 增减一小时；评分门禁保持。 |
| `src/lib/locationIdentity.ts` | 坐标是身份硬约束，同名/同 sourceId/canonicalId 不能越过冲突；风险是旧 ID 缓存会失效。 |
| `src/lib/nightAstronomyFacts.ts` | 持续时间、去重及天文计算使用绝对小时，避免 DST 增减一小时；评分门禁保持。 |
| `src/lib/pressure.ts` | 现有中国气压层明确 ISO 请求，不套用 surface epoch 解析；全球 DST 气压层仍未认证。 |
| `src/lib/productRoutes.ts` | 四入口传递地点、日期及显式时次，相关坐标冲突才提示；风险是旧裸 URL 缺上下文。 |
| `src/lib/scoring.ts` | 持续时间、去重及天文计算使用绝对小时，避免 DST 增减一小时；评分门禁保持。 |
| `src/lib/snapshotProvenance.ts` | 逐站 supplier/model/dataset 与原始采集时间，未知模型起报/观测时间保持 null；风险是旧来源缺失的快照显示 stale。 |
| `src/lib/store.tsx` | 缓存必须绑定真实请求坐标，时次改变清理旧 epoch；风险是无法验证坐标的旧缓存被拒绝。 |
| `src/lib/types.ts` | 贯通绝对时次/地点上下文或紧凑冲突披露；风险是旧 URL 与布局兼容，需跨浏览器/真机回归。 |
| `tests/contract/openMeteoCloudContract.test.ts` | 保留原功能断言，新增坐标/来源/绝对时间/缓存或 UI 转换回归；风险是 fixture 只证明工程契约，不证明科学准确率。 |
| `tests/e2e/location-transfer.spec.ts` | 保留原功能断言，新增坐标/来源/绝对时间/缓存或 UI 转换回归；风险是 fixture 只证明工程契约，不证明科学准确率。 |
| `tests/fixtures/open-meteo/cloud-contract-cases.json` | 保留原功能断言，新增坐标/来源/绝对时间/缓存或 UI 转换回归；风险是 fixture 只证明工程契约，不证明科学准确率。 |
| `tests/integration/forecastDiskIntegrity.test.ts` | v4 epoch 完整性及坐标绑定，旧 v3/v2 只读 stale；风险是首次新缓存请求及旧 fixture 迁移。 |
| `tests/integration/forecastRoute.test.ts` | v4 epoch 完整性及坐标绑定，旧 v3/v2 只读 stale；风险是首次新缓存请求及旧 fixture 迁移。 |
| `tests/integration/liveSmokeCooldown.test.ts` | 429 立即停止而不重试，避免供应商冷却期间叠加请求。 |
| `tests/integration/topicCacheOnly.test.ts` | 保留原功能断言，新增坐标/来源/绝对时间/缓存或 UI 转换回归；风险是 fixture 只证明工程契约，不证明科学准确率。 |
| `tests/unit/absoluteForecastTime.test.ts` | 官方 UTC epoch 转为 IANA 本地标签；重复小时默认较早、显式 epoch 精确选择，缺失小时不补造；风险是旧无 epoch 缓存只能降级。 |
| `tests/unit/forecast.test.ts` | v4 epoch 完整性及坐标绑定，旧 v3/v2 只读 stale；风险是首次新缓存请求及旧 fixture 迁移。 |
| `tests/unit/locationIdentity.test.ts` | 坐标是身份硬约束，同名/同 sourceId/canonicalId 不能越过冲突；风险是旧 ID 缓存会失效。 |
| `tests/unit/snapshotProvenance.test.ts` | 逐站 supplier/model/dataset 与原始采集时间，未知模型起报/观测时间保持 null；风险是旧来源缺失的快照显示 stale。 |
| `tests/unit/storeCacheCoordinates.test.ts` | 保留原功能断言，新增坐标/来源/绝对时间/缓存或 UI 转换回归；风险是 fixture 只证明工程契约，不证明科学准确率。 |

## 本地接收与验收（只从 GitHub 精确 SHA 接收）

本地只负责安装/编译/测试与获准的部署验收，不代写本阶段业务代码。先 fetch PR52 head，核对 `git rev-parse HEAD` / `HEAD^{tree}` 与 PR 顶部一致，再 `npm ci; npm run check; npm run test:e2e; npm run test:e2e:cross-browser`（逐命令保留退出码和日志）。将设备/CI/科学证据回传云端审核，云端继续修复；不要把历史交接的“已授权测试通过即部署”当成本阶段部署命令。

真实天气矩阵：在已有受信网络环境只读运行 `node scripts/acceptance-weather-matrix.mjs --base=https://photo.joviluma.com --cache-only`，参数为 `--base=URL --cache-only`；脚本不提供 --help。5地点×4模型+两 topic×4模型；两牛背山坐标分行，LA/Kathmandu 日期与 timezone 单独核实。缓存缺口 NOT_RUN；429 停止任何供应商刷新并遵从 Retry-After。若需供应商新数据，沿既有 worker 冷却采集，不增加密钥/额度或强制刷新。记录 requested coords、实际 model、acquisition、generated、served、未知run/observation null、epoch 单调、repeat/gap、visibility count、stale。绝不能借其他模型填 ICON visibility。

真机矩阵每台记录精确SHA/HTML门禁、设备/OS/浏览器/AT版本和屏录：OnePlus Chrome+TalkBack、iPhone Safari+VoiceOver。四入口触摸切换和直接日期选择；屏幕放大200%；一处文档滚动、弹层焦点进入/循环/关闭归还、后台不可聚焦；地图单次触摸/拖动/双指缩放不截获文档滚动；牛背山仅相关转换提示并保留原始点，普通转换无虚假冲突；日期/夜晚/phase跨入口保留；读屏分别读出两次01:00的UTC偏移，春季02:00不可选择假天气。提供失败步骤与实际/预期，未测试行明确NOT_RUN。

云端科学验收已完成的是数学/来源工程不变量（绝对时长、坐标模型绑定、未知时间不推断、独立天文），不是准确率。科学准确率需预注册未来拍摄事件样本、精确坐标/观测UTC、独立现场照片/云层能见度实测、预测发布前的固定数据快照与lead time。按模型/地形/季节分层统计覆盖率、缺失率和阈值事件混淆矩阵；只对真实校准概率使用Brier/可靠性图，现有启发式分数不冒充概率。禁止事后换模型/起报、拿fixtures/模拟截图作科学真值。起报未知时只能按采集 lead time 报告限制。

## 迁移与回滚

新缓存惰性创建；旧缓存保留且只读 stale。旧本地日期URL继续接受，不存在小时无数据，重复默认较早可用forecastEpoch指定较晚。回滚仅回到已验收5fbf产品/保留378镜像与既有配置，卷保持原样；不逆写新epoch缓存到旧schema。不在本任务实施回滚或部署。发布流程必须 clean-runtime、内容一致性门禁和精确SHA/tree/静态HTML证据，发现旧目录残留时停止发布并保留证据。

## 文档提交时的精确代码资格

代码 head `40ef7b96bed3a9354a63f11dc8995e8534e67d40`，tree `fa07558252ea72d79d3a98837d704eaf2f5508cb`，本报告/交接提交在其后。来源披露与方法说明的 CSS 类冲突已由完整 Chromium 真实失败发现并修复，不改原响应式断言；最新回归/最终 CI 终态在 PR52 更新。日期超范围保留修复专测 desktop/mobile 6 PASS，ICON 无能见度独立事实/URL时次 mobile 2 PASS，合计8 PASS2适用性SKIP（8ecdf源码构建）。之后40ef源码隔离构建也PASS。

[CI37631936317](https://github.com/Jovifei/Star_photo_addr/actions/runs/37631936317) 的质量日志为91文件513tests PASS，production audit0 vulnerabilities；Firefox/WebKit12 PASS；容器3个路由servedSHA等于packagedSHA。它包含c56，不冒充40ef完整CI。所有后续精确head/终态记录于PR52，非通过结果也保留。

| 交接文件 | 原因 / 风险 |
|---|---|
| `LOCAL_CODEX_HANDOFF.md` | 置顶本阶段未部署状态并保留历史；避免旧交接部署授权误用于本阶段。 |
| `docs/CLOUD_IDENTITY_PROVENANCE_DST_20261007.md` | 逐文件、契约、真实结果、NOT_RUN、设备/科学验收与回滚；文档证据不替代真机/准确率。 |

## 后续真实矩阵实施

托管CI已实际具备供应商访问能力，所以既有live-smoke每模型的一次请求扩成五坐标batch，不增加模型请求次数；四模型顺序执行，429立即停止。记录每行原始UTC epoch/时区、requested与provider grid坐标分别保留、采集时间及未知run/observation null、visibility count。上海、两处牛背山、LA、Kathmandu共20行的真实结果以最终CI日志为准；此处编写时仍PENDING，不伪造PASS。既有28行cache-only产品矩阵仍NOT_RUN，两者不能混称。最新429实际HTTP测试PASS。

40ef源码构建的响应式/地图触摸/文档单滚动/地点日期回归在执行；原desktop宽矮方法说明定位器问题已修复；随后真实回归又发现地图y=207.59超过200门禁及首触区域受顶部新行影响，现将来源披露移到主工作区之后，原断言未改。最终完整结果在PR52。

最后来源边界RED：空Fireglow快照2PASS/1FAIL（stale原为false）；GREEN将空来源与无可信采集时间保持stale，重新跑原缓存集成门禁。主工作区之后的来源披露仍可键盘/触摸展开，不挤占顶部日期和地图。最终测试数量因新增该断言为514，真实结果以PR52/CI终态为准。

在底图域名受限的真实浏览器环境，原触摸用例仍失败；追踪显示地图图层失败横幅文字拦截首触，而不是地图数据/scroll失效。主题地图横幅静态文字透传手势，retry按钮继续pointer-events:auto与Leaflet事件隔离。保留错误事实/重试，不隐藏横幅，不删除原触摸断言。CSS原因/风险补充：确保失败图层时仍可选点/拖动，重试按钮与读屏状态仍需原测试验证。
