# 当前云端交接 — 2026-10-08 全球压力时序与证据资格（未部署）

本条优先于下方历史。授权main父基线 `f167501c0f52270d0a6f14268ab6274ca33265bb`；独立分支 `codex/decision-evidence-20261008`。最终精确head/tree和CI终态以本阶段Draft PR顶部为准（普通push，未合main）。报告：[REMOTE_PRESSURE_EVIDENCE_STAGE_20261008](docs/REMOTE_PRESSURE_EVIDENCE_STAGE_20261008.md)。已实际完成压力epoch/IANA/重复小时、旧ISOstale、地点模型归属、当前小时六层门禁、四入口模型传递与429停止、48行只读输入资格工具。下方e057/旧发布只是历史。

本地只在 `E:/project/Star_photo_addr` 接收，不创建C盘worktree、不代写业务代码：

1. 保留Owner本地未提交文件；`git fetch origin` 后核对PR最终完整SHA，`git rev-parse <SHA>`及 `<SHA>^{tree}` 必须逐字匹配。独立接收分支可用 `git switch -c verify/remote-pressure-20261008 <SHA>`；如已有本地改动先保护，不覆盖。不得凭浮动branch名直接部署。
2. Node24，`npm ci`；`npm audit --omit=dev --audit-level=high`；`npm run check`；生产构建后 `npm run test:e2e`、`npm run test:e2e:cross-browser`。记录命令/时间/退出码/原始日志，不用旧main结果冒充新SHA。
3. 非生产临时服务运行 `RELEASE_CHECK_BASE_URL=http://127.0.0.1:<测试端口> node scripts/check-release-frontend.mjs <仓库目录>`，三HTML逐字节门禁不得跳过。没有部署授权，不动原生产卷/缓存/凭据/镜像。
4. 生产只读天气：`node scripts/acceptance-weather-matrix.mjs --base=https://photo.joviluma.com --cache-only --output=<本地证据路径>`。工具先读取不触发天气的 `/api/acceptance-capabilities`；旧版本/未知服务自动整批NOT_RUN、零天气请求。标明实际运行SHA；可在精确候选非生产服务运行以验证48行读取。429/Retry-After即停止，不加refresh，NOT_RUN不改PASS。
5. OnePlus/iOS实际设备（非Playwright模拟）：四入口同级/直接日期、选点和真实手指地图拖放、单滚动、弹层开关/旋转、系统字体200%；记录型号/OS/浏览器、候选实际服务SHA、屏幕与操作证据。TalkBack/VoiceOver实际朗读控件、焦点循环/返回、重复小时UTC偏移和失效状态。无设备/读屏则NOT_RUN。
6. 科学验收：保留来源/providerRunAt null语义；ICON缺能见度检查raw事实与独立天文可见且评分暂缓。LA两个回拨1时由各自epoch选不同压力剖面，春跳2时无剖面，Kathmandu分钟偏移；这仍只是时序/算法验收。长期实际预报误差需独立实拍/探空/台站标签、位置与时次/模型分层样本，不用fixture或供应商smoke宣布准确率。
7. 回传GitHub证据：接收HEAD/tree、命令/退出码、实际结果/截图/日志、48行JSON、设备/读屏状态、发现问题和运行SHA。云端继续审核/修复；不得要求本地写下一阶段业务代码。

保护：Owner `tasks/todo.md`/`tasks/lessons.md`、`scripts/check-release-frontend.mjs`无修改；main新增日期CSS/测试时钟保留；无部署/清缓存/网络或凭据修改/force push。VM真实供应商/生产CONNECT403，真机工具缺失，原始NOT_RUN见报告。

---

# 当前交接 — 2026-10-08 主线整合与仓库整理

本条优先于历史。最新e057云端功能及九历史tip已整合，本地全套测试通过。当前任务将已验证源码归并main并同步E:/project/Star_photo_addr；精确Git状态以main实际HEAD为准。此前的Draft49禁止合并记录已由Jovi本次主线合并授权取代。此轮未部署，定时循环保持PAUSED。

接力Prompt：docs/NEXT_SESSION_PROMPT_20261008.md；功能/测试/清理证据：docs/MAIN_BRANCH_RECONCILIATION_20261008.md。仍需真实设备/读屏/科学验收；生成目录清理被自动审批拒绝，未绕过。

---

# 当前云端阶段交接 — 2026-10-07（未部署）

本条优先于下方历史。独立分支 `codex/cloud-identity-provenance-dst-20261007`，授权base `35600636b969704ec8fa5dd9c1bf8ff650ecc0d1`；[Draft PR52](https://github.com/Jovifei/Star_photo_addr/pull/52) 顶部记录最终精确head/tree。已实际云端实现地点身份/相关坐标冲突/四入口日期、原始来源时间与传输分离、官方epoch/DST和版本化只读旧缓存，以及测试/CI门禁。逐文件原因风险、真实结果、设备/科学矩阵、迁移回滚见 [阶段报告](docs/CLOUD_IDENTITY_PROVENANCE_DST_20261007.md)。

生产仍为5fbf7bac2c925d068f4c04274cbdbe79b0672ead；PR49未合并，无部署/清缓存/生产卷修改，Owner两份任务笔记不变。本地从GitHub精确SHA安装测试和真机取证，回传云端审核；不代写业务代码。真OnePlus/iOS/TalkBack/VoiceOver及科学准确率NOT_RUN；供应商 smoke 成功不等于全部矩阵/科学通过。`scripts/check-release-frontend.mjs`保持，CI运行容器亦检查页面内容。下方正式发布与旧候选仅是历史。

---

# 当前交接 — 2026-10-07 正式发布完成

已部署5fbf7bac2c925d068f4c04274cbdbe79b0672ead，版本1.0.27，clean-runtime镜像aa57d67d…；app/worker healthy重启0。CI37607724883五任务SUCCESS。主报告：docs/DEPLOYED_5FBF_ACCEPTANCE_20261007.md。

修复发布覆盖目录残留导致“健康新版/页面旧版”的实际缺陷；正式服务首页/火烧云/云海与打包HTML逐字节匹配。新版504屏实测地图440px、溢出0、实际GFS原值及score93/暗夜估算9h。截图工具失败，使用实际DOM记录，不冒充真机。

原卷、原378镜像/配置及一致备份保留。原目录Owner两份笔记仍保护。已授权测试通过即部署，不能重复索取许可。Git push正常；gh未登录与公开GET限流单独记录，服务器GET已完成CI读数。

接下来通过原Project接力聊天审核此次精确SHA/报告，继续跨产品身份、快照来源时间、DST和真机/读屏阶段；不把待做科学验收包装为已完成。PR49仍Draft/main未合并。下方旧记录仅作历史，不覆盖本条精确版本。

---

# Latest 2026-10-07 follow-up candidate

LOCAL_CODEX_AUTHORED CODE_HEAD10e25655db4146b306ca6c38abd4597e72a174f0/tree99d54ada52dd91c5e9a7951dee6bc33127709360. Adds candidate cache identity and independent elapsed-duration fallback guards; fixed actual768 modal close stacking via portals and aligned actual document-scroll/map-density contracts. Full86files496tests/lint/types/buildPASS; CI-failure reproduction35PASS4applicableSKIP. Prior95fed16 CI37596735320 FAILED6Chromium/256PASS, other4jobsSUCCESS, not release proof. New exactCI and remote actual-source review PENDING. Production remains378; noDraft49merge/deploy. Owner notes preserved. Evidence: docs/COMPACT_MOBILE_A1_LOCAL_ACCEPTANCE_20261007.md. Coordinate conflicts/source-time/DST/device/reader/science remain scoped pending.

# 2026-10-07 latest local repair candidate

LOCAL_CODEX_AUTHORED product commit5854a1604d8517b48c7120f805ed3a157d6c1347/tree088d6cfd0f5c3d1e6fd1f057c09df46e5e2ed487. Current source includes remote478 base plus corrected explicit clock ownership/refresh/catalog handoff, strict coordinate identity binding, independent astronomy/raw weather, compact portrait document scrolling, marker first-touch and200% input shrink repairs. Parent full85files494tests/lint/types/buildPASS; targeted mobile31PASS2applicableSKIP. Actual bounded LA GFS72hours72visibility/source08:21:12.87Z/stalefalse and candidate real-response calculation1PASS.

Production remains378161ffe6aa21989ef48e63c9d077343d276a95. No deploy orDraft49merge. Exact hostedCI/remote-source-review/newproductionphone acceptance PENDING. Remote current tools are read-only; do not falsely attribute local commits to remote. Owner tasks/lessons andtasks/todo preserved. Detailed evidence and remaining point-identity/source-time/DST/raster/science boundaries: docs/COMPACT_MOBILE_A1_LOCAL_ACCEPTANCE_20261007.md.

## 2026-10-07 当前候选更新
当前原授权源码15282daf8daebe1bac06115f0b814cecf5307e0b已经完成父会话锁定依赖475测试/build、三组真实RED/GREEN。包括严格UTC偏移、v3fresh/v2stale事实保留、月相盈亏正确方向；尚未部署，生产仍378。细证据docs/POST_RELEASE_ACCEPTANCE_378_20261007.md。MapSetup隐藏loading语义缺陷已交远端；手机/全a11y/全球时区/DST/预报准确率仍未闭合。Owner两处文档dirty保护保留，Draft49未合并。

## 2026-10-07 当前接手状态（优先于下方历史）
DEPLOYED_ACCEPTANCE_INCOMPLETE：当前运行378161ffe6aa21989ef48e63c9d077343d276a95，app/worker精确镜像82f5a0ba…健康restart0。原卷、备份校验及回滚已独立重核；未重部署。
本地授权分支已接收远端真实offset修复d543fff637c561da9bc8197ef282495081a6601e，完成锁定依赖RED/GREEN和468测试/build。此修复尚未部署、尚待远端审核；不能把源码候选当运行SHA。
详细证据与待验收项：docs/POST_RELEASE_ACCEPTANCE_378_20261007.md。Owner追加文档在9331bd0快照/zip保护并保留。C2C同Project接力6ac5c47d-2a7c-83ea-ad99-696dba6482b8已验证workspace_info。手机真机、广泛无障碍、海外/DST、慢网/中断和科学准确率仍未完整验收。DraftPR49不合并。

# Current engineering handoff

Repository: `Jovifei/Star_photo_addr`
Branch: `codex/overnight-forecast-coverage-20261003`
Review: [Draft PR 49](https://github.com/Jovifei/Star_photo_addr/pull/49)

## Published baseline

Exact head `5a46046ba6470fca6493a19dfe0866a2f182e60b`, tree `3fdc04905885feb7f9d37fb27f22a04c140d9b62`. The tooltip fixture synchronization and concise handoff are published.

[CI 37404323556](https://github.com/Jovifei/Star_photo_addr/actions/runs/37404323556) stopped at one high production dependency finding in source-map-js 1.2.1. Quality checks after audit and all dependent browser/container jobs did not run; live-data smoke passed.

Prior head `7a1e6b13bfec647591845c7790ea9fb798c75a18`:
[CI 37343815232](https://github.com/Jovifei/Star_photo_addr/actions/runs/37343815232) finished with Chromium 259 passed / 124 applicability skips / 1 failed. The other four jobs succeeded: quality (82 files / 466 tests; production audit zero), Firefox/WebKit (12 passed), container and live-data smoke.

All desktop/mobile 100%/200% readability and map-retry cases passed. Original-resolution screenshots confirmed the candidate names, timeline controls, map-error copy and layers controls in their tested states. The full run still failed; physical-phone settings and actual browser zoom were not verified.

## Reviewed fixture and pending dependency patch

The mobile tooltip lifecycle test clicked during an already-running initial map-positioning animation. The test now waits for the expected fixture center, zoom 8, an existing map pane and no zoom/pan animation in one observable snapshot. Its two strict zoom-plus-one checks and every tooltip naming assertion remain unchanged. Product map behavior is unchanged.

This nine-line test repair passed local lint, types, 82 files / 466 tests and production build, plus independent trace and diff review. These checks apply to the unchanged test source in the current candidate; documentation minimization does not establish a new browser result.

The current follow-up locks only source-map-js to upstream-patched 1.2.2 within all existing version ranges. See [dependency repair evidence](docs/engineering-change-log/2026-10-06-source-map-js-audit.md). Clean install, production audit zero, all three dependency-boundary checks, and lint/types/82 files/466 tests/build passed for this patch. Its exact-candidate CI is still required.

## Remaining release gates

Publish the reviewed candidate on the same branch without force, verify its exact SHA/tree and run its full CI. Inspect that run's actual screenshots and metadata before release. Previous successful jobs are not acceptance of a different candidate.

Deployment has not occurred for this repair. Before the approved release, verify the current running version and a usable rollback point through the existing deployment process; preserve application data. See [deployment guidance](docs/DEPLOYMENT.md) and [current repair evidence](docs/engineering-change-log/2026-10-05-candidate-lines-and-map-retry.md).
# 2026-10-07 latest acceptance update (supersedes earlier status below)

Production remains 378161ffe6aa21989ef48e63c9d077343d276a95; no redeployment or Draft PR49 merge. Original authorized branch received corrected MapSetup CODE_HEAD 36a9bf923c895dd13766d20c9dc41fb668222702 after local locked RED e6b0c645 (1 FAIL/1 PASS), GREEN (2 PASS), complete lint/types/84 files477 tests/build PASS. Earlier undiscovered tsx test was not valid RED; package manifest actually already includes RTL/jsdom, correcting the earlier dependency claim.

Physical phone now partially exercised: OnePlus7Pro/Android11, Jovi manually opened public site after automatic browser launch was blocked. Actual map selection of 巴中光雾山, expansion and upward swipe succeeded. ICON facts cloud21%/rain0.0mm/wind1.9m/s; original sourceFetchedAt2026-10-07T06:16:41.313Z. Visibility missing, score withheld. Large summary, delayed facts and nested scrolling need redesign; separate map-layer error remains untraced. This is not full phone or screen-reader acceptance.

Next remote stage: finish exact T1 timezone repair and corrected test handoff, then implement compact mobile and independent astronomy/raw-fact display per docs/MOBILE_DENSITY_REDESIGN_20261007.md. Local precise-SHA tests and real-device checks precede release. Owner tasks notes remain protected and uncommitted.

