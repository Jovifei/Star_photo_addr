# 2026-09-23 手机内容密度与信息层级修复

- [x] 识别一加 7 Pro（384 CSS px 估算宽度）；ADB 打开网页被自动审批拒绝，截图当前为其他应用，真机网站验证待完成。
- [x] 生产浏览器 384px 复现：云海 header 239px，地图 y=347px；旧 nth-child 日期规则强制换行。
- [x] 统一轻量导航、单行当前日期/时段、可展开模型说明；手机与平板采用不同网格。
- [x] 检查 320/384/390/430/768/1024 与横屏，查看完整应用截图，测试展开、切页、滚动、焦点。
- [x] 真正复现抽屉正文382px横溢出；新增失败断言后修复隐式网格列，同一用例PASS。
- [x] 完成静态门禁和响应式回归，记录结果及真机边界。
- [ ] 手机浏览器实际访问、滑动与旋转：ADB打开被拒绝，等待手动打开预览。
- [ ] CI中pane.scrollWidth多22px已由截图确认来自表格的预期横向滚动；断言现检查抽屉/pane/card可视边界，推送后完整CI待通过。

Review：368项测试、lint/typecheck/build通过；Firefox/WebKit 4/4。全量Chromium首轮161通过/67跳过/2旧滚动距离断言失败；核实平板最大滚动57/50px并适配断言后，手机专项15通过/1设备跳过。独立只读复查无明确新增回归。详见 `docs/ui-audit/2026-09-23-mobile-density.md`；候选尚未部署，不声称已在连接手机完成网站验收。

# 2026-09-23 再审、发布与生产验收

- [x] 用户授权再次审核、测试后推送、合并、部署；全程不改写 Owner 的脏 main 工作树。
- [x] 核实 `origin/main@3334e0c`、祖先关系及 Owner 脏工作区；全程在独立 worktree 操作。
- [x] 独立审查发现并修复云海覆盖、火烧云日期/阶段、海拔空值、modal 语义、摘要计数与版本记录问题。
- [x] 为前五项添加红测并确认当前实现失败；开始按根因逐项修复。
- [x] 修复并验证 5 项产品/可访问性问题及复审新增覆盖边界。
- [x] `npm run check`：63 files / 368 tests，lint、typecheck、build PASS。
- [x] Chromium 全量：230 total / 163 passed / 67 project-device skips / 0 failed；Firefox/WebKit：4 passed。
- [x] 真实 provider smoke：Open-Meteo 四模型、压力层、geocode、AQI、NASA GIBS、NOAA Kp、VIIRS 全 PASS；生产依赖审计 0 vulnerabilities。
- [x] 按 bugfix 发布假设更新为 v1.0.19；同步 package/lock、root/docs changelog、应用内历史与 README 版本语义。
- [x] 独立最终复审确认指定缺陷均已关闭。
- [x] 推送 release 分支并创建 PR #33；当前 head 为 `09d6e940`。
- [ ] 等待 GitHub CI 全绿后合并。首轮全量 E2E 在 35 分钟 job timeout 被取消（不是断言失败）；已将 E2E job 上限提高到 45 分钟，需推送后重跑并检查完整结果。
- [ ] 在隔离 worktree 验证合并后 main，按 ECS 手动流程部署并核验 app/worker、healthz、data-status、数据源与四个页面。

边界：不在 `E:\project\Star_photo_addr` 覆盖现有未提交修改；不强推；不删快照卷；公网部署仅在主线和 CI 门禁通过后执行。

# 2026-09-23 定位海拔来源与缺失值修复

- [x] 复核用户原始八图并确认“我的位置 0m”未证明是实测海拔。
- [x] 用单元测试复现缺失值伪装 0m、海平面真实 0m 被覆盖、描述性地名误借山峰海拔三个缺陷。
- [x] 修正海拔解析为来源优先、精确目录名称匹配；未知保持 null，并移除坐标近邻代填。
- [x] 将当前位置、地图取样、候选点、天气重试路径的 0 sentinel 改为 unknown；0m 本身仍可显示。
- [x] 海拔解析/格式化单元测试：11 项通过。
- [x] 重建 standalone 后复跑桌面和手机海拔 E2E（2/2）。第一次旧产物的失败未计入当前源码验收。
- [x] 全量静态门禁：62 files / 365 tests、lint、typecheck、build。
- [x] 完整 Chromium：153 passed / 61 project skips / 0 failed；Firefox/WebKit：4 passed。
- [x] 更正此前八图证据阻塞和过期测试结论，写入审计追记与 bug 根因/防重犯 lesson。
- [x] 提交到隔离本地分支；不推送、不合并、不部署，等待 Owner 审核。

Review：未提供设备海拔时 UI 显示“海拔待核验”；明确海平面来源 0m 不丢失；地图取样不借用附近目录海拔。静态、全量 Chromium 与跨浏览器门禁通过。真实手机/平板验收与发布仍需 Owner 后续审核。

# 2026-09-20 发布后四页面浏览器回归与线上数据复核

- [x] 在已部署运行时代码上重新运行 ESLint、TypeScript、Vitest 与生产构建。
- [x] 运行 Chromium 桌面/移动全量 E2E，并覆盖 375/768/1024/1440 宽度与手机横屏。
- [x] 运行 Firefox 桌面与 WebKit 手机跨浏览器冒烟。
- [x] 修正日期按钮紧凑格式与火烧云无有效评分错误态的过期 E2E 契约。
- [x] 复核生产版本、容器健康、火烧云三日与云海三日有效业务数据。

## Review

- Static gates: 60 个测试文件 / 352 项 Vitest、ESLint、TypeScript、生产构建全部通过。
- Browser gates: Chromium `126 passed / 42 skipped / 0 failed`；Firefox/WebKit `4/4`。
- Layout coverage: 主工作台四档宽度无页面级横向溢出；手机横屏不恢复桌面浮窗；云海/火烧云详情使用不压缩卡片的底部对话框。
- Production baseline: `buildRevision=822b85a`，app/worker 均 healthy；火烧云三天均有有效排行；云海三天压力层均 `54/54` 且存在有效评分。
- Boundary: 浏览器设备模拟验证通过；真实 iPhone/Android 仍保持 `MANUAL/PENDING`，由 Jovi 最终验收。

# 2026-09-19 云海后日数据恢复与日期可读性

- [x] 复现后日压力层请求失败、降级缓存和三日总览请求覆盖。
- [x] 补充后日/三日/日期标签及每个云海字段的回归测试并先观察 RED。
- [x] 将截图中的云海详情卡片重叠纳入 320–1280px 逐卡片几何回归，并确认长逆温文案不裁切。
- [x] 修复 provider 并发与降级缓存边界，保持数据不足时 fail-closed。
- [x] 运行云海专项测试、完整静态检查、完整 E2E 和真实上游接口验收。
- [x] 仅在上述证据通过后提交并重新部署 exact SHA。

## Review

- Root cause: 生产基线允许详情 Flex 卡片收缩，弱断言未发现内容裁切；云海客户端又并发请求三天并隐式使用 `icon`，其后日压力层为 `0/54`，降级响应还会进入 30 分钟缓存。
- Repair: 部署将包含 `flex: 0 0 auto` 的详情卡片布局；日期请求串行、单日期压力批次最多并发 2、单次 12 秒超时并退避重试；降级快照不进入新鲜缓存，客户端对部分结果重试并保留可用部分；云海明确使用三天均为 `54/54` 的 GFS。
- Verification: `npm run check` 59 文件 / 346 项通过；Chromium E2E `125 passed / 41 skipped / 0 failed`；Firefox/WebKit `4/4`；真实 GFS 2026-09-19、20、21 均 `54/54`、failed `0`。
- Report: `docs/engineering-change-log/2026-09-19-cloudsea-day3-mobile-layout.md`。
- Authorization: Jovi 已明确要求修复并逐项测试后再提供测试报告。
- Publication: 运行时代码已部署为 `822b85a`，app/worker 健康，后续测试契约提交不改变运行时行为。

# 2026-09-10 UI 统一与专题排行门槛

- [x] 将主页默认图层改为云量预报 + 光污染参考，实况时间轴只在用户主动选择时出现并保持收起。
- [x] 统一顶部控件顺序/边框：评分时间 → B1–B4 → 推荐门槛 → 仅显示推荐地点；B1–B4 与对应推荐分数门槛一一联动。
- [x] 为火烧云与云海排行新增 0–100 分门槛滑块，列表只显示达到门槛的地点，并保留数据不足语义。
- [x] 补充桌面/移动 E2E 与纯函数测试，运行完整门禁和视觉检查。
- [x] 更新 v1.0.12 版本记录、工程日志、项目跟踪和 Obsidian 镜像 DryRun；按映射状态报告同步结果。

## Review

- Scope: 只调整首屏/专题排行筛选呈现与状态联动，不改变天气 Provider、评分算法或地点目录。
- Baseline: `main@a66ad049dfd6`，当前 v1.0.11 已部署；本轮已合并为 `main@d64009276db0`（v1.0.12）。
- Verification: `npm run check` 52 个测试文件 / 304 项通过；`npm run test:e2e` 110 passed / 34 skipped / 0 failed；`npm run test:live` PASS；`npm audit --omit=dev --audit-level=high` 0 vulnerabilities。
- Remaining: 无；Obsidian 实际镜像受项目映射缺失阻断，已完成 DryRun 并保留 `NO_PROJECT_MEMORY` 记录。
- Publication: `main@1e550cdc5a15` 已部署；生产 app/worker healthy，公网 `/healthz` 和 `check:data-sources` 通过。

# 2026-09-10 项目知识文档与 Obsidian 同步

- [x] 读取当前源码、README、部署/测试/跟踪文档，确认 v1.0.11 制造与发布事实。
- [x] 新增 `docs/README.md`、项目制造与交付流程文档、文档地图；补充低内存部署经验与证据边界。
- [x] 将当前主线、测试、发布和剩余 MANUAL/BLOCKED 项目同步到 tracking/testing 文档。
- [x] 运行 `codex-memory` 文档镜像 DryRun；若项目映射缺失，保留 `NO_PROJECT_MEMORY`/`MEMORY_SYNC_BLOCKED`，不创建新 Vault 项目。
- [x] 执行链接/路径/敏感内容/Markdown 校验，审阅 diff 并提交文档变更。

## Review

- Scope: 只更新项目知识文档和文档索引，不改应用源码、评分算法、数据源或生产配置。
- Baseline: `main@a66ad049dfd6`，v1.0.11 已部署。

# v1.0.11 顶部直接筛选控件纠正（2026-09-09）

- [x] 先补充顶部直接控件回归：四档参考 B1–B4、评分时间滑块、推荐门槛滑块均默认可见，命令栏不再包含评分设置展开面板。
- [x] 将 B1–B4 参考档位及含义（极暗 / 自然暗夜 / 乡村夜空 / 乡村-郊区过渡）与两个滑块放入顶部命令栏，复用现有状态与 LocalStorage。
- [x] 移除命令栏里的完整 `ObservingMapControl` 展开面板和地图重复的 Bortle 筛选条，保留右侧/移动端详细面板作为低频检查入口。
- [x] 完成窄屏堆叠、1280/1440 单行、键盘与无水平溢出回归；更新 v1.0.11 版本、Changelog、工程记录和 lessons。
- [x] 运行完整本地门禁，提交 `codex:` commit，推送分支并合并 `main`，按部署文档上线后完成公网验收。

## Review

- Plan: `tasks/plans/2026-09-09-direct-commandbar-filters.md`。
- Baseline: `main@fed0565dbe9ff3c978a383663e800f73e77ef92a`，当前生产 v1.0.10。
- Scope: 只调整首屏命令栏筛选呈现与响应式布局；评分算法、天气数据、点位目录和状态持久化契约不变。
- Verification: `npm run check`（51 文件 / 302 测试）通过；完整 E2E `106 passed / 34 skipped / 0 failed`；命令栏 focused `5 passed`；live sources 与生产依赖审计通过。
- Publication: `codex/direct-commandbar-filters-20260909` 与 `codex/direct-bortle-labels-20260909` 均已推送；最终 `main@db830ee834ca` 已部署到 `/opt/star-photo`，app/worker healthy。
- Public acceptance: `https://photo.joviluma.com/healthz` 返回 v1.0.11 / `db830ee834ca`；公网数据源检查通过，页面截图确认顶部单行控件与四档 Bortle 文案完整可读。

# v1.0.10 命令栏评分设置前置（2026-09-09）

- [x] 确认 `main@d288eac` 干净基线和截图对应的现有评分设置。
- [x] 采用“摘要 + 可展开设置”方案，避免把多个滑块与四档复选框硬挤进单行。
- [x] 先补充命令栏评分设置的桌面/移动端 E2E 回归并观察 RED。
- [x] 在“我的位置”后增加评分设置入口，复用现有 `ObservingMapControl` 状态与数据逻辑。
- [x] 调整展开面板的层级、响应式布局和无障碍焦点。
- [x] 更新版本至 v1.0.10、Changelog、工程记录和测试门禁。
- [ ] 推送 `codex/` 分支、等待 CI、合并 `main`，按部署文档部署并完成公网验收。

## Review

- Plan: `tasks/plans/2026-09-09-recommendation-settings-commandbar.md`。
- Baseline: `main@d288eac46eeaa90e8bb52dbdd1472c245259c30c`，v1.0.9 已部署。
- Scope: 只前置评分设置入口与展示，不改变评分算法、地点目录、数据源和 LocalStorage 契约。

# v1.0.9 顶部推荐地点筛选开关（2026-09-09）

- [x] 确认 v1.0.8 `main` 干净基线，并定位已有推荐门槛状态与地图过滤契约。
- [x] 创建 `codex/recommended-only-filter-20260909` 分支。
- [x] 先补充顶部命令栏开关的桌面/移动端回归测试并观察 RED。
- [x] 将“仅显示达到推荐门槛的地点”放到“我的位置”后，并保持现有筛选状态单一来源。
- [x] 调整窄屏布局、无障碍语义和相关文档/版本记录为 v1.0.9。
- [x] 运行 focused/full gates、审阅 diff 并确认无回归。
- [ ] 推送 `codex/` 分支、等待 CI、合并到 `main`，按部署文档上线并完成公网验证。

## Review

- Plan: `tasks/plans/2026-09-09-recommended-only-filter.md`。
- Baseline: `main@a578dab65e22e3cbe823d0f1f79f56bf53c58f0f`，v1.0.8 已部署。
- Scope: 顶部入口与既有推荐过滤状态的 UI 接线；不改评分算法、点位数据和数据源契约。

# v1.0.8 Zhoushan island photography-location expansion (2026-09-09)

- [x] Complete source-backed candidate research and deduplicate existing `东极岛东福山`.
- [x] Add five Zhoushan/Shengsi general catalog locations with conservative reference metadata.
- [x] Expand the default shortlist with representative sea-island photography spots without overwriting user-owned candidates.
- [x] Bump version records, changelogs, engineering log, tests and dynamic counts.
- [x] Run focused tests, full local gates, live/data-source checks and browser acceptance.
- [ ] Push the `codex/` branch, wait for CI, merge to `main`, deploy and verify the public domain.

## Review

- Plan: `tasks/plans/2026-09-09-zhoushan-location-expansion.md`.
- Baseline: `main@21051b7409e34ec5ef578e7b27a2233a08723e90`, already deployed as v1.0.7.
- Scope: curated location data and release records only; no score/provider contract changes.
- Verification: focused unit 23/23; `npm run check` 51 files / 302 tests PASS; `npm run test:live` PASS; local data-source probe PASS; Chromium E2E 102 passed / 34 skipped / 0 failed; npm audit 0 vulnerabilities.
- The first E2E run used a stale standalone build and exposed a candidate-cap false failure; after rebuilding from current v1.0.8 source, the isolated 2/2 test and full suite passed.

# v1.0.7 curated location expansion (2026-09-09)

- [x] Confirm clean `main@5900bd8` and audit catalog/CloudSea entry points.
- [x] Research public, source-backed popular destinations and record caveats.
- [x] Add 10 general photography locations, 10 CloudSea locations, and expand the default shortlist to 10.
- [x] Synchronize dynamic catalog counts and regression fixtures.
- [x] Fix the rolling score-window clamp so a selected night-matrix hour is preserved.
- [x] Apply the non-force dependency security update and verify production audit is clean.
- [x] Increase only slow-CI E2E condition-wait budgets after reproducing the timeout root cause.
- [x] Align the remaining initial cloud-canvas gate with the same 30-second condition wait.
- [x] Align the initial visible-marker gate with the same 30-second condition wait.
- [x] Run full local gates, live smoke, and local E2E.
- [ ] Publish `codex/location-expansion-20260909` and wait for CI before merge/deploy.

## Review

- Plan: `tasks/plans/2026-09-09-location-expansion.md`.
- Research record: `docs/engineering-change-log/2026-09-09-location-expansion-v1.0.7.md`.
- Source-backed candidates are recommendations only; Bortle remains reference metadata and no score algorithm changes are planned.
- Verification: `npm run check` PASS; `npm run test:live` PASS; `npm run check:data-sources` PASS on local standalone; Chromium E2E `102 passed / 34 skipped / 0 failed`.

# v1.0.6 production hotfix (2026-09-08)

- [x] Confirm clean `main` and exact `origin/main@cee9dde` baseline.
- [x] Create `fix/v1.0.6-production-hotfix-20260908` from the baseline.
- [x] Add RED regression coverage for version consistency, unknown markers, and DataV fallback.
- [x] Implement only the scoped hotfix changes and align docs/changelog.
- [x] Run local gates, live smoke, and permitted local E2E (`102 passed / 34 skipped / 0 failed`).
- [ ] Push branch, open PR, wait for all five CI gates, and merge.
- [ ] Deploy merged `main` and complete production API/page/network verification.

## Review

- Plan: `tasks/plans/2026-09-08-v1.0.6-production-hotfix.md`.
- Baseline evidence: local and remote `main` both equal `cee9dde09ed7a4d6e8736dc2ea020b244d49cd95`; worktree was clean before branching.

# v1.0.4 release and main integration (2026-09-06)

- [x] Bump package and lock metadata from 1.0.3 to 1.0.4.
- [x] Add the v1.0.4 Keep a Changelog entry and in-app version record.
- [x] Verify release gates after the version update.
- [x] Fast-forward merge the codex branch into `main`, push `main`, and redeploy the exact main SHA.

## Review

- [x] `main@20393b15bcd5` merged and pushed; ECS `main` and public `/healthz` report `20393b15bcd5` / `1.0.4`.
- [x] Public `/`, `/cloudsea`, `/fireglow` return HTTP 200; data-source probe is healthy; worker snapshot logs are fresh.

# E2E contract and health version metadata (2026-09-06)

- [x] Add a regression test proving `/healthz` falls back to the package version outside an npm lifecycle.
- [x] Migrate desktop E2E helpers and assertions to the two-tab unified inspector while preserving the mobile tool drawer contract.
- [x] Replace retired Planner-page coverage with compatibility-redirect and unified-workspace assertions.
- [x] Replace retired score-panel coverage with the sites-workspace B1-B4 filter contract.
- [x] Make the health route read the package version as its fallback.
- [x] Run targeted RED/GREEN tests, `npm run check`, and the full E2E suite on an isolated port.

## Review

- [x] `healthzRoute.test.ts` RED (`1.0.0` received) then GREEN (`1.0.3` received).
- [x] `npm run check`: lint, TypeScript, 43 Vitest files / 244 tests, and Next.js production build pass.
- [x] `PORT=3187 npm run test:e2e`: 99 passed / 31 project-specific skips / 0 failed.
- [x] Review the final diff and commit only this work package.

# Cloudsea workspace deployment (2026-09-04)

- [x] Verify cloudsea feature state on `main`: dedicated `/cloudsea` workspace (map + ranked sidebar), 5-tab nav, theme-switch navigation fix, 44 sites, retry/loading hardening (`5e83b4d`, `f6d7c24`, `c1b6e9f`).
- [x] Local gates: `npm run check` PASS; full E2E 66 passed / 29 skipped by design / 0 failed (PORT=3101); cloudsea unit 9/9.
- [x] ECS deploy `c1b6e9f772b8`: pull ff-only, `.env` BUILD_REVISION updated, worker stopped + 2G temp swap for the build, compose rebuild, containers healthy.
- [x] Verification: public `/healthz` → `c1b6e9f772b8`; `https://photo.joviluma.com/cloudsea` → 200; local standalone cold API 200 (~10s for 44-site fan-out); worker observing snapshot `gfs 7d fresh` + fireglow prewarm loop running.
- [x] Cleanup: temp swapfile removed; server back to 2G swap.

Version record: deployed build `c1b6e9f772b8` (main) on 2026-09-04, superseding `5e83b4ddebc9` (2026-09-03).

Known follow-ups (not blockers): cloudsea has no E2E coverage yet (unit-only); cloudsea API has no `refresh=1` force channel or worker prewarm (44-site cold start ≈ 10s); local→ECS network is intermittently flaky (SSH/HTTPS timeouts that recover on retry).

# UI information architecture batch 0 (2026-08-29)

- [x] Replace the watermarked anonymous CARTO default with one configurable basemap boundary and a zero-config OSM fallback.
- [x] Deduplicate candidate locations by stable coordinate identity across Store, deep links and Planner.
- [x] Stop Planner deep links from silently persisting a candidate.
- [x] Repair blocker-only copy, Planner empty copy and header chip wrapping.
- [x] Remove the duplicate fixed nearby-ranking overlay; keep one in-flow 10/50/100/200 km control.
- [x] Add unit/E2E regression coverage and engineering change record.
- [x] Complete local quality, E2E, and production visual review on 2026-08-30.
- [ ] Mark PR #15 ready after GitHub Actions on the close-out SHA are green. Do not merge.
- [x] Close batch-0 regressions found in 2026-08-30 review: candidate persist clobber, 44px targets, landscape nearby grid, ranking-pool identity.

# Website clone: stargazing-finder-dark (2026-08-12)

## Full product integrity fixes (2026-08-26)

- [x] Confirm current `main@bc8a964` and preserve user-owned mobile landscape edits.
- [x] Write and run RED tests for Bortle multi-select, nearest-site fallback, and satellite refresh preservation.
- [x] Finish production implementation and browser regression coverage for score semantics, cloud degradation, nearby recommendations, and Fireglow geometry.
- [x] Run local quality gates and publish one unified change to `main`.
- [x] Rebuild the ECS `star-photo` Compose project and verify HTTP health/build revision.

### Review (2026-08-29 verification pass)

- `main@85bc933` 与 origin/main 一致；`npm run check`（lint/typecheck/单测/构建）与 `npm run test:e2e`（70 passed, 10 skipped by design）全绿。
- ECS `/opt/star-photo` 运行镜像确认由 85bc933 构建；`.env` 补 `BUILD_REVISION=85bc9336cdf8` 后重建，公网 `/healthz` 返回真实版本号。
- 线上 `check:data-sources` 全部 available（weather/satellite/light-pollution），Himawari 143 帧，预报 48 小时；worker healthy 且完成 gfs 7d 刷新。
- 运维注意：ECS 仅 1.8GiB 内存，构建期间曾触发 OOM kill；本次通过「先停 worker + 临时 2G swapfile」完成重建，结束后已清理。后续部署建议沿用该顺序。

### Review

- RED confirmed before implementation: missing Bortle helper, nearest fallback, and satellite preservation behavior each failed for the intended reason.
- Targeted unit tests now pass; full browser and deployment evidence remain outstanding until the implementation is complete.

- [x] Install and read the `clone-website` skill from `JCodesMore/ai-website-cloner-template`.
- [x] Capture desktop/mobile reference screenshots and extract the target page behavior/topology.
- [x] Build the isolated `/stargazing-finder-dark` route without replacing existing product routes.
- [x] Implement the map/filter/list interactions, responsive layout, and route-scoped visual system.
- [x] Verify the clone with desktop/mobile browser checks, `npm run check`, and existing E2E coverage.

## Review

- Clone skill installed at `C:\Users\Admin\.codex\skills\clone-website` from `JCodesMore/ai-website-cloner-template` (`master`, `3040f9c`).
- Target reconnaissance and screenshots are stored under `docs/research/stargazing-finder-dark-com-a038da11/root-8a5edab2/` and `docs/design-references/stargazing-finder-dark-com-a038da11/root-8a5edab2/`.
- New surface is isolated at `/stargazing-finder-dark`; existing `/`, `/planner`, `/sites`, and `/viirs` product routes were not replaced.
- Browser acceptance: PASS at 1440×1000 and 390×844 — 18 markers, search 2→18, legend resize, photo/visual mode switch, marker detail open/close, VIIRS toggle, no page overflow, no console errors.
- `npm run check`: PASS — ESLint, TypeScript, 14 Vitest files / 108 tests, and Next 16.3.0 production build.
- `npm run test:e2e` on an isolated 3101 server: PARTIAL — 8 passed, 4 failed, 2 skipped. The failures are existing dynamic-date/matrix assertions on the original product (`8月9日` fixture drift and current-hour selection reset); no clone-route test failed because the clone route is outside the existing suite.
- Boundary: the clone uses the project-owned recommendation records and CARTO dark basemap with a route-scoped VIIRS-style demo presentation; it does not copy the target site's backend, analytics, or private/proprietary raster service.

# Branch consolidation correction

- [x] Compare every visible development branch by tree, ancestry, and unique commits
- [x] Select the latest complete product tree and define the single surviving branch topology
- [x] Consolidate the required branches without losing unique work
- [x] Re-run relevant validation and verify local/remote branch refs

## Review

- Latest complete product tree: local `main@6645856`; it is tree-identical to local `codex/product-integration-final@62387c9`.
- Surviving branch: `main` (current remote default). The accidental parallel `master` and all historical development refs will be merged as ancestry, then removed.
- `feature/20260807/local-run-finalization` is stale and polluted with agent/OpenSpec runtime files; preserve its commits as ancestry but do not apply its tree over the current product.
- Pre-publication `npm run check`: PASS — lint 0 errors (3 existing warnings), typecheck PASS, 12/12 Vitest files and 95/95 tests PASS, Next production build PASS.
- Consolidation commit: `b7976fa merge: consolidate repository history into main`; all former branch tips are reachable from its merge parents.
- Removed 10 superseded remote branch refs and 4 local branch refs after ancestry verification. Remote and local branch lists now contain only `main`.

## Hourly matrix and satellite integration (2026-08-09)

- [x] Establish the implementation branch and capture the current baseline.
- [x] Fix the fixed 3100 local runtime, app-identity health check, E2E isolation, and Docker port/configuration.
- [x] Upgrade Next.js to 16.3.0 and re-run the production dependency audit.
- [x] Unify forecast access behind same-origin APIs, add model selection, null-safe fields, metadata, retries, and source gateways.
- [x] Fix planner query bridging so missing coordinates never become `0,0`.
- [x] Replace the visible cloud slider with the shared ten-hour hourly forecast matrix and ISO active time.
- [x] Add mutually-exclusive numerical cloud, satellite cloud, and satellite night-light layers with source status.
- [x] Run unit, API, component, E2E, live-data, Docker, and responsive overflow verification.

### Review

- Implementation branch: `codex/hourly-satellite-integration`.
- `npm run check`: PASS — lint, typecheck, 13 Vitest files / 99 tests, Next 16.3.0 build.
- `npm run test:live`: PASS — 2 Open-Meteo locations, 48 surface hours, 10 pressure levels, including wind direction.
- `npm run test:e2e`: PASS — 7 passed, 1 skipped (desktop-only responsive loop under the mobile project); desktop and mobile matrix/planner/satellite checks passed.
- `npm audit --omit=dev`: PASS — 0 high / 0 critical production vulnerabilities.
- `docker compose build`: PASS; `APP_PORT=3100 docker compose up -d`: PASS; `/healthz` identifies `star-weather-planner`, and the container became healthy.
- `scripts/start-local.ps1 -Port 3101 -NoBrowser -SmokeTest`: PASS; startup probe identifies `star-weather-planner` and cleans up the temporary dev process.
- Satellite live probes: Himawari returned 145 ten-minute observation frames; VIIRS night-light returned the nearest available date after local-date fallback.

## Map-first hourly panel refinement (2026-08-09)

- [x] Move the hourly panel outside the map viewport so it cannot obscure the primary map.
- [x] Add default collapsed state, bounded expanded height, independent vertical scroll, and horizontal-only matrix scrolling.
- [x] Normalize table typography, row height, summary cards, control touch targets, and dark-theme tokens.
- [x] Verify desktop and mobile behavior with E2E plus a real expanded-state screenshot review.

### Review

- `npm run check`: PASS — lint, typecheck, 13 Vitest files / 99 tests, Next 16.3.0 build.
- `PORT=3101 npm run test:e2e`: PASS — 7 passed, 1 skipped; matrix expansion and map viewport assertions passed on desktop and mobile.
- Screenshot review at 1440×1000: expanded map viewport 513px high; forecast panel 420px bounded with an internal scroll region.

## Tonight-first home outlook and satellite refresh (2026-08-09)

- [x] Replace the fixed 8/12 home night with the current local night and current/future forecast hour.
- [x] Make the primary map headline describe tonight's cloud change, with astronomy events as auxiliary context.
- [x] Add a reviewed latest-events list containing the Perseids, the August total solar eclipse, and the August partial lunar eclipse.
- [x] Refresh satellite observations on mode change, map viewport changes, and a ten-minute timer; disable browser response caching.
- [x] Show the selected satellite observation timestamp and a degraded state when no night-light frame is available.
- [x] Run the full check, E2E, Docker health probe, and final screenshot review.

### Review

- `npm run check`: PASS — lint, typecheck, 14 Vitest files / 104 tests, Next 16.3.0 build.
- `PORT=3101 npm run test:e2e`: PASS — 7 passed, 1 skipped; desktop/mobile homepage, planner, satellite entry, and overflow checks passed.
- `docker compose up --build -d`: PASS — container healthy on 3100; `/healthz` returned app identity `star-weather-planner` version `0.3.1`.
- Screenshot review at 1440×1000: PASS — primary map remains visible, event context is bounded at top-left, and the hourly panel stays below the map.

## Map, sidebar, date, and cloud rendering correction (2026-08-09)

- [x] Repair desktop observation panel control rail and mobile drawer behavior.
- [x] Fix planner typography scope, heading line-height, and repeated event presentation.
- [x] Make current-hour and tonight selection state explicit and remove stale home query state.
- [x] Replace IDW/additive cloud rendering with null-safe total-cloud/layer rendering.
- [x] Separate forecast, Himawari observation, and Black Marble baseline modes.
- [x] Add build revision visibility and complete browser, API, responsive, and live-data verification.

### Review

- `npm run check`: PASS — ESLint, TypeScript, 14 Vitest files / 106 tests, Next 16.3.0 production build.
- `npm run test:live`: PASS — Open-Meteo returned 2 locations, 48 surface hours, and 10 pressure levels with wind direction.
- `npm run test:e2e`: PASS — 7 passed, 1 skipped (desktop-only responsive loop under the mobile project); desktop/mobile matrix, planner, satellite, and overflow checks passed.
- `npm audit --omit=dev`: PASS — 0 production vulnerabilities.
- `docker compose up --build -d`: PASS — 3100 container healthy; `/healthz` returned `star-weather-planner`, version `0.3.1`, build revision `local`, `Cache-Control: no-store`.
- Live API probes: best_match/icon/gfs/aifs all returned 200 with model-isolated metadata; Himawari returned 145 observation frames and Black Marble returned one 2016 baseline frame. The first Himawari probe transiently timed out, and the immediate retry succeeded.
- Browser geometry: 1440px panel left edge and control-rail right edge both measured at `x=864`; 375px collapsed map/timeline measured `642px/64px`, expanded `470.85px/235.48px` (map ratio `66.66%`). Planner 54px heading line-height measured `60.48px`; stale home `night` was removed and the page remained on 8/9 tonight.

## Satellite workstation repeat repair (2026-08-09)

- [x] Use the ui-ux-pro-max rules to keep the map-first dark data workspace, semantic colors, keyboard targets, and reduced-motion-safe interactions consistent.
- [x] Repair the detail panel drag race so trusted pointer drag changes the rendered width in both directions and persists the result.
- [x] Keep the cloud control panel values inside their bounded container and expose a 0–100% legend with numeric ticks.
- [x] Keep forecast controls, timeline cards, canvas time, and selected-point forecast values on the same ISO hour.
- [x] Restore a selected point's single-location forecast after localStorage hydration and pass the requested model through planner deep links.
- [x] Add explicit Enter/Space selection for matrix cells so keyboard acceptance is deterministic.
- [x] Align planner E2E URL/expectations with the current shared shell while preserving manual deep-link verification.

### Review

- `npm run check`: PASS — ESLint, TypeScript, 14 Vitest files / 106 tests, Next 16.3.0 production build.
- `npm run test:live`: PASS — Open-Meteo returned 2 locations, 48 surface hours, and 10 pressure levels.
- Browser desktop: PASS — default satellite mode loaded NASA GIBS Himawari AHI Band 13; forecast playback advanced the timeline, card, control value, and Canvas from 21:00 to 04:00; cloud control had no measured overflow.
- Detail panel: PASS — trusted drag measured 560→420px and 420→622px, with matching `aria-valuenow` and localStorage persistence.
- Browser mobile: PASS — emulated 375×900 had document width 375px, no page-level horizontal overflow, no desktop resizer, and a 112px timeline cap.
- Cross-product: PASS — planner deep link preserved 牵牛岗, 8/9 night, GFS, 21:00, and forecast-cloud; returning home intentionally removed the legacy `night` query while preserving the shared state.
- `npm run test:e2e`: PARTIAL — 5 passed, 2 planner cases reached the browser's intermittent “This page couldn’t load” state, and 1 mobile responsive loop skipped by design. The same planner deep link passed in the live browser; no full-green claim is made.

## Cloud workstation and cross-product unification (2026-08-09)

- [x] Default the map to Himawari observed cloud frames with a separate 24-hour observation timeline.
- [x] Add an independent 72-hour forecast timeline with visible cloud legend, forecast wind vectors and precipitation overlay.
- [x] Make satellite playback, forecast playback, data cards and map layers advance from the same time-domain state.
- [x] Move side-panel width ownership to the workspace parent and verify real pointer drag changes the rendered width.
- [x] Fix cloud-control numeric overflow and make map controls avoid an open detail panel.
- [x] Share location, night, model, time and cache state between 逐星 and 星野决策 while preserving both routes.
- [x] Run unit, browser, live-data, responsive and Docker acceptance checks.

### Review

- `npm run check`: PASS after the final app changes — ESLint, TypeScript, 14 Vitest files / 106 tests, Next 16.3.0 production build.
- `npm run test:live`: PASS — Open-Meteo returned 2 locations, 48 surface hours, and 10 pressure levels with wind direction.
- `docker compose build`: PASS; `APP_PORT=3110 docker compose up -d` and `/healthz` PASS with `star-weather-planner`, version `0.3.1`, build revision `local`.
- Browser verification at 1440px and 375px: PASS — Himawari tile URLs changed during playback, forecast canvas/data card changed during playback, 375px document width had no horizontal overflow, and the expanded timeline stayed bounded.
- Side-panel verification: PASS — trusted drag changed the rendered panel from about 577px to 420px and persisted `perseids-side-panel-width-v1=420`; keyboard focus/ArrowLeft also changed the rendered width.
- Cross-product verification: PASS — planner deep link displayed the specified `取样点 35.1802, 110.4785`, tonight 8/9, and the shared model/time/overlay links; the planner showed the ten-hour detail matrix.
- E2E: PARTIAL — updated desktop suite reached 3/4 passing (satellite default/forecast matrix, mutually-exclusive layer modes, and overflow); the planner test remains flaky because the browser restores to “This page couldn’t load” after the initial hero render. Manual browser validation of the same planner route passed, so this remains a test-environment blocker rather than a claimed full-green gate.

## Matrix data availability and vertical interaction correction (2026-08-09)

- [x] Verify why the expanded matrix renders weather parameters as `—` and keep forecast data tied to the selected ISO hour/location.
- [x] Add an intentional vertical scroll region for the expanded matrix while preserving horizontal hour scrolling and the sticky indicator column/header.
- [x] Keep missing upstream fields as `—`, but expose a clear loading/degraded explanation instead of an apparently empty matrix.
- [x] Add regression coverage for populated parameters, missing fields, vertical scroll, and horizontal matrix scrolling.

### Review

- `npm run check`: PASS — ESLint, TypeScript, 14 Vitest files / 107 tests, Next 16.3.0 production build.
- `npm run test:live`: PASS — Open-Meteo returned 2 locations, 48 surface hours, and 10 pressure levels.
- Root cause: grid fallback aggregated only cloud fields; temperature, dew point, precipitation, visibility, wind speed, and wind direction were discarded.
- Browser desktop: PASS — matrix scroll region measured `clientHeight=220`, `scrollHeight=670`; setting `scrollTop=180` moved the parameter view.
- Browser mobile: PASS — at 375px, matrix measured `198×346` with `scrollHeight=670` and `scrollWidth=960`; both `scrollTop=150` and `scrollLeft=180` moved while document width stayed 375px.
- Data rule: current ICON response returns visibility `null`; visibility and moon height/illumination remain `—` instead of being fabricated.

## Planner detail drawer missing-hour guard (2026-08-09)

- [x] Trace the `formatHour(undefined)` crash from the detail drawer's pressure profile section.
- [x] Make planner time formatting null-safe and retain an explicit `—` empty marker.
- [x] Add regression coverage for missing, malformed, and valid provider times.

### Review

- `formatHour` now safely handles `undefined`, `null`, short strings, and malformed hour segments without hiding valid `HH:mm` values.
- `npm run check`: PASS — ESLint, TypeScript, 14 Vitest files / 108 tests, Next 16.3.0 production build.
- Browser planner deep link: PASS — detail drawer opened with an empty-hour evaluation, rendered the explicit empty state, and produced no console errors.

## Hydration, sampling data, timeline, and detail drawer audit (2026-08-09)

- [x] Read the Next.js hydration guidance and capture the server/client determinism rule.
- [x] Dispatch a read-only sub-agent audit for hydration, sampling-point refresh, legend semantics, hourly range, and detail-drawer resizing.
- [x] Make the initial navigation href/time deterministic across SSR and client hydration.
- [x] Trace selected sampling-point forecast refreshes and keep location, model, and ISO time synchronized.
- [x] Explain every numeric cloud value with channel, percent unit, model, forecast time, and source metadata.
- [x] Extend the visible hourly weather range without breaking the fixed tonight matrix.
- [x] Make the planner detail drawer resize from its real left edge in both directions and persist the width.
- [x] Run check, build, targeted browser checks, and responsive overflow verification.

### Review

- Next.js hydration guidance: PASS — first-render navigation is deterministic; browser state is restored after hydration.
- Read-only sub-agent audit: PASS — Peirce (`019fe701-3222-7612-8e23-4ed5a1a38928`) reviewed hydration, sampling, legend, timeline, and drawer behavior; no edits were delegated.
- Sampling/legend: PASS — selected model is propagated through point and grid requests; cloud values are labeled as Open-Meteo cloud-cover percentages with channel, model, time, and source.
- Timeline: PASS — forecast rail covers current through 72 hours; fixed 20:00–05:00 matrix remains ten columns; the E2E fixture is anchored to 2026-08-09 so selected matrix hours cannot be reset by stale test data.
- Detail drawer: PASS — desktop trusted pointer drag changes the rendered width in both directions and persists across reload; mobile uses the bottom drawer without desktop resize controls.
- `npm run check`: PASS — ESLint, TypeScript, 14 Vitest files / 108 tests, Next 16.3.0 production build.
- `npm run test:e2e`: PASS — desktop 7/7 and mobile 5/5 passed; 2 mobile-inapplicable cases skipped by design; 0 failures.
- `http://127.0.0.1:3100/healthz`: PASS — `star-weather-planner`, version `0.3.1`, build revision `local`.

## 地点详情范围选择与数据源配置说明 (2026-08-09)

- [x] 核对 Open-Meteo、NASA GIBS、天地图 Token 和 Bortle/SQM 的实际配置状态。
- [x] 在详情页增加今日、3 天、5 天、7 天范围选择。
- [x] 让未来夜次卡片、评分、逐小时天气、天文轨迹、云层剖面和小时矩阵同步选中夜次。
- [x] 增加配置说明折叠面板，并明确可选 Token 与未安装授权资源的边界。
- [x] 修复右侧详情恢复按钮遮挡地图图层控制的问题。
- [x] 完成静态检查和浏览器范围切换验收。

### Review

- `npm run check`: PASS — ESLint、TypeScript、14 个 Vitest 文件 / 108 个测试、Next 生产构建。
- 规划详情 E2E: PASS — 7 天显示 7 个未来夜次，点击第 3 夜后详情状态和小时矩阵同步切换。
- 图层配置 E2E: PASS — 详情恢复按钮避让后，卫星实况、云量预报和夜光基准可连续切换。
- 配置结论: Open-Meteo 与 NASA GIBS 无需用户 Token；天地图 Token 可选；Bortle/SQM 需要授权本地资源，当前保持未安装。

## 星野决策多夜趋势与逐星共享状态修正 (2026-08-10)

- [x] 复现“3/5/7 天标签改变但图表不变”，确认旧实现只扩大夜次卡数量。
- [x] 增加多夜趋势图，展示星空分、平均总云量与连续窗口，并随范围改变真实数据集。
- [x] 保留单夜逐小时下钻，明确当前夜晚与小时，避免把多夜和单夜语义混在一张图里。
- [x] 将详情夜晚、小时、模型与地点同步回逐星共享会话和导航链接。
- [x] 统一刷新时间、陈旧状态、语义颜色、44px 交互目标和图表数值说明。
- [x] 完成 targeted E2E、完整 check、全量 E2E 和响应式浏览器复核。

### Review

- 根因修复：范围按钮现在驱动 1/3/5/7 夜趋势图的数据集合；单夜逐小时图只负责当前夜下钻，不再用同一张图混淆两个时间尺度。
- 跨产品状态：点击夜次或小时后，地点、夜晚、模型、预报时次和预报图层写回共享会话，逐星导航链接同步更新。
- `npm run check`: PASS — ESLint、TypeScript、14 个 Vitest 文件 / 108 个测试、Next 16.3.0 生产构建。
- 定向 E2E: PASS — 1→7 夜使趋势图 `data-night-count` 和图表键变化；第三夜及具体小时使单夜图和逐星 URL 状态变化。
- `npm run test:e2e`（PORT=3101，避免干扰已运行的 3100 服务）: PASS — 桌面 7/7、手机 5/5，2 项移动端不适用测试按设计跳过；0 失败。
- 子 Agent 只读复核：无 P0；指出深链地点优先级、无数据夜晚旧时次残留和移动详情几何测试缺口，均已修正或补充定向 E2E。
- 最终定向 E2E: PASS — 多夜数据联动与 375/768/1024/1440 深链详情抽屉几何验收 2/2 通过。
- `npm run test:live`: PASS — Open-Meteo 返回 2 个地点、48 个地面小时和 10 个气压层。
- `http://127.0.0.1:3100/healthz`: PASS — `star-weather-planner` 0.3.1，build revision `local`。

## 观星地点查询站点完整复刻与数据补全（2026-08-12，最新）

- [x] 将 `/stargazing-finder-dark` 地点快照扩展为 242 个稳定地点，默认 Bortle 3 显示 222 个，Bortle 4 显示 242 个。
- [x] 保存目标站 35 个省级边界为本地 GeoJSON，并统一地图、筛选、详情、复查和导出的地点数据源。
- [x] 移除访问量字段、接口、弹窗、统计逻辑和分析脚本，不把非业务统计带入复刻。
- [x] 新增同源 `/api/stargazing-finder/weather?date=YYYY-MM-DD`，按地点批量请求 Open-Meteo，返回 33 小时序列、状态、陈旧标记和空值。
- [x] 接入目标站 VIIRS 2023 WMTS，失败时降级 CARTO 暗色底图；地图明确显示光污染底图来源，不误称云图或实时天气。
- [x] 完成 Bortle、标签模式、VIIRS 开关、观星/摄影、地点搜索、今晚及未来 4 天、复查和 Excel 兼容导出。
- [x] 完成地点详情底部工作台：评分、风险、33 小时图表/表格、夜间高亮、风雨标记、上下拖动和内部横向/纵向滚动。
- [x] 用同一评分/风险/空值规则驱动地图标记、详情、复查和导出；缺失数据显示 `—` 或“暂无天气数据”。
- [x] 更新观星快照单测、动态上海日期 E2E 断言和 ui-ux-pro-max 设计系统文档。

### Review

- `npm run check`: PASS — ESLint、TypeScript、15 个 Vitest 文件 / 113 个测试、Next 16.3.0 生产构建。
- `PORT=3101 npm run test:e2e`: PASS — 12 passed、2 个移动端不适用用例按设计跳过；首次失败的旧 `8月9日` 硬编码断言已改为 Asia/Shanghai 动态日期后全绿。
- 浏览器桌面 1440×900: PASS — 默认摄影模式、无访问量内容、Bortle 3 地点标记 222、Bortle 4 地点标记 242、详情面板 520→673px 真实拖动、复查弹窗和 `.xls` 下载。
- 浏览器移动 390×844: PASS — 地点标记 222、页面宽度 390/390，打开 33 小时详情后仍无页面级横向溢出。
- API: PASS — `/healthz` 返回 `star-weather-planner`、`0.3.1`、`local`；天气接口返回 242 个地点和 33 个小时；非法日期返回 400。
- 数据语义: PASS — Open-Meteo 天气、darkmap.cn/IUCN/中国绿发会/VIIRS 地点来源、CARTO 降级状态均在界面标注；访问量和 Cloudflare 分析不接入。

## 地图信息降噪与跨产品合并方案（2026-08-12）

- [x] 删除地图永久天气详情，地点标记只保留名称；雨量、云量、评级和风险统一放入点击后的地点详情。
- [x] 从地点查询头部删除作者与版本号展示。
- [x] 对照目标站当前公开页面，记录已覆盖、主动排除和下一步细节，避免把“核心功能覆盖”误报为“逐像素完全复制”。
- [x] 新增 `/integration-plan` 方案页，展示三入口职责、共享观测会话、功能审计和分阶段合并路径。
- [x] 在地点查询页增加进入合并方案的入口，保留 `/`、`/planner`、`/stargazing-finder-dark` 原有深链。

### Review

- 浏览器复核目标站：确认其业务表面包括地图/VIIRS、Bortle、标签、摄影/肉眼、搜索、日期、详情、复查和导出；访问量属于按需求排除项。
- 当前实现结论：核心业务功能已覆盖；目标站搜索弹窗微交互和原生 `.xlsx` 工作簿属于下一步，不伪装成已经完全一致。

## 地点名称标签最终收敛（2026-08-12）

- [x] 保留筛选范围内每个地点的常驻名称标签，例如“牵牛岗”“太子尖”。
- [x] 删除地点标签旁的天气详情、下雨时刻、评级说明、风险说明和警告徽标。
- [x] 保留小型颜色点作为空间定位和当前评级的轻量语义，完整数据仍只在点击详情中展示。

## 中国观星地图与星野决策统一闭环（2026-08-13）

- [x] 建立共享 `ObservingSite` 适配器、推荐评分类型和 1/3/5/7 天 `/api/observing/snapshot` 接口。
- [x] 地图默认卫星云图，并提供光污染、综合决策三种互斥模式；保留 242 个地点，默认 Bortle 1–3 为 222 个。
- [x] 地图常驻点位收敛为名称 + 评分点，天气/雨量/风险详情只进入选中地点抽屉。
- [x] 候选清单限制 12 个并持久化完整共享候选，跨 `/` 与 `/planner` 保持地点、模型、夜晚和时次。
- [x] 决策页范围切换真正改变共享快照天数、夜晚列和评分索引，矩阵/夜间轨/排行卡绑定对应夜晚。
- [x] 增加快照磁盘缓存、原子写入和 30 分钟 worker，失败时回退陈旧快照并标记降级。
- [x] 按 `sites-building` 能力路径完成生产构建和 Chrome 浏览器回归；修复移动端矩阵点击与首帧保护竞争。

## 全国地图标签、评分筛选与刷新修复（2026-08-13）

- [x] 删除全国地图 222 个地点的永久白色 Tooltip，常态只保留评分点，选中地点才显示名称。
- [x] 将蓝/青、绿、黄、红四个评分档位改为真实复选筛选，并持久化用户选择。
- [x] 缩小左上筛选面板和评分点，避免控件与地图内容互相遮挡。
- [x] 云量/卫星错误改为可理解的本地服务提示，增加云图重试按钮，切层时取消旧请求。
- [x] 修复观星快照共享请求被某一个已离开的浏览器请求中止的问题。
- [x] 为 VIIRS 图层增加 tileerror 降级状态；本地未配置的 World Atlas 继续明确显示为未配置，不发起 404 请求。
- [x] 增加 E2E：验证无密集永久文字气泡、评分复选会实际减少点位。

### Review

- `npm.cmd run lint`: PASS。
- `npm.cmd run typecheck`: PASS。
- `npm.cmd run test:unit`: PASS，16 个测试文件 / 119 个测试。
- `npm.cmd run build`: PASS，Next 16.3.0 生产构建。
- 浏览器现场（3100）：PASS，地图不再出现 222 个白色详情气泡；取消“优先”后点位由 222 降至 205；综合决策显示当前时次、云量百分比、色阶和 72 小时轨道；375px 评分筛选可真实点击。
- `npm.cmd run test:e2e`: PASS，16 passed、2 skipped（移动端不适用的桌面拖宽与桌面断点循环）。
- `npm.cmd run test:live`: PASS，Open-Meteo 返回 2 个地点、48 小时地面数据和 10 个气压层。
- 端口诊断：`3100/healthz` 为 `star-weather-planner`；`3190` 当前无监听，直接访问会失败，不能误判为页面刷新 bug。

### Review

- `npm.cmd run lint`: PASS。
- `npm.cmd run typecheck`: PASS。
- `npm.cmd run test:unit`: PASS，15 个测试文件 / 114 个测试。
- `npm.cmd run build`: PASS，Next 16.3.0 生产构建，`/api/observing/snapshot` 与 worker 脚本已纳入产物路径。
- Chrome E2E targeted: PASS，默认卫星、卫星帧播放、预报/光污染互斥、规划器共享网关、真实侧栏拖宽持久化、375/768/1024/1440 无页面横向溢出。
- Chrome E2E full: PARTIAL，桌面 7 项和移动端其余业务项通过；修复后的移动端矩阵用例已单独复测 PASS。Playwright 生产服务器子进程在全量结束阶段未自动退出，需后续清理测试 runner 生命周期，不能据此声明全量命令为完整绿灯。
- `http://127.0.0.1:3100/healthz`: PASS，应用标识 `star-weather-planner`、版本 `0.3.1`、构建修订 `local`。

## 评分时间滑窗与档位数量联动（2026-08-13）

- [x] 在地图筛选面板增加当前至未来 72 小时的评分时间滑窗，并显示“现在 / 明天 / 后天”参照。
- [x] 将推荐门槛数量、四档评分数量、当前显示数量绑定到选中的 ISO 预报时次。
- [x] 为每个时次使用独立快照缓存键与 `focusScores`，切换时间时不复用上一时次结果。
- [x] 让地图评分点、档位勾选和时间滑窗共用同一份时次评分数据。
- [x] 增加动态 E2E mock 和单测，验证 24/48 小时切换会真实改变评分分布。

### Review

- 评分语义：分数来自 Open-Meteo 数值预报的选定小时；卫星云图仍是独立的历史观测时间域，不被包装成未来评分。
- 加载或失败时显示 `—`，不把上一小时的统计伪装成当前时次；地图点在新快照返回前保持空间点位但不使用旧颜色。
- 旧请求中止或晚到失败不会覆盖新时次的可用状态；评分面板与点位层都用请求代次保护异步结果。
# 夜间发布候选审计与收敛（2026-08-13）

- [x] 修复 Playwright 生产服务器的进程生命周期，确保全量 E2E 正常退出并返回真实状态码。
- [x] 补充“地图加入候选 → 星野决策保留候选”的跨页面闭环验收。
- [x] 将 README 与 `/integration-plan` 从旧三入口方案更新为当前两页产品闭环和真实完成状态。
- [x] 复核生产依赖安全公告、真实数据链、Docker web/worker 构建及健康状态。
- [x] 汇总 Luna Max 独立审计发现，修复 P0/P1 问题并记录最终发布候选结论。

### Review

- `npm.cmd run check`: PASS — ESLint、TypeScript、16 个 Vitest 文件 / 119 个测试、Next 16.3.0 生产构建。
- `npm.cmd run test:e2e`: PASS — 14 passed、2 skipped（移动端不适用的桌面拖宽与桌面断点循环）；新增地图候选跨页闭环在 desktop/mobile 均通过，runner exit 0 且 3187 无遗留监听。
- `npm.cmd run test:live`: PASS — Open-Meteo 返回 2 个地点、48 小时地面数据和 10 个气压层。
- `npm.cmd audit --omit=dev`: PASS — 0 high / 0 critical；Docker 缓存中的旧安装提示不代表当前锁文件审计结果。
- Docker：PASS — `APP_PORT=3190 docker compose up --build -d` 后 Web 与 worker 均 healthy；worker 输出 `2026-08-13 icon 7d fresh`。
- NASA GIBS 现场探针：PASS — Himawari AHI Band 13 返回 143 个唯一真实观测帧，覆盖 24 小时；能力清单中的缺帧被保留，不再机械伪造 145 帧。
- Luna Max 独立审计后已修复：缺失云量仍评分、候选模型缓存串用、批量响应复制首地点、损坏快照浅校验、临时文件碰撞和空值显示为 0。其余架构增强（评分加入月亮权重、VIIRS tileerror 状态联动、worker 重叠锁）进入下一阶段，不阻塞当前可验收功能。
- 阶段说明：README 与 `/integration-plan` 已从旧“三入口/下一步共享 session”更新为当前“观星地图 + 星野决策”两页闭环，旧地址仅保留兼容重定向。
- Obsidian：`codex-memory load` 返回 `NO_PROJECT_MEMORY`，本轮未凭空创建知识库项目；仓库文档、当前树和测试作为阶段事实来源。
## 未知海拔地点评测崩溃修复（2026-08-13）

- [x] 复现地图取点 `elevation: null` 传入 Astronomy Engine 导致 `Value is not a finite number: null`。
- [x] 在共享首页与规划器天文计算边界加入海平面几何兜底，保留地点原始未知海拔，不伪造显示或评分来源。
- [x] 增加共享评分与规划器评分回归测试，覆盖未知海拔地点。
- [x] 通过真实浏览器地图取点评测、控制台错误检查、完整 `npm run check` 与独立 3110 端口 E2E。

### Review

- 根因：地图点击点和部分地理搜索结果的海拔为 `null`，被直接传给 `new Astronomy.Observer(...)`。
- 修复：`src/lib/astronomy.ts` 与 `src/features/planner/lib/astronomy.js` 只在计算边界将非有限海拔归一到 `0`；地点对象仍保留 `null`，界面继续显示未知/模型地形语义。
- 定向回归：2 个测试文件、11 个测试通过。
- 完整检查：`npm run check` 通过，16 个 Vitest 文件 / 121 个测试、Lint、TypeScript、Next 16.3.0 构建均通过。
- E2E：独立 `PORT=3110` 运行，桌面 9/9、移动端 7/7 通过，2 个移动端不适用用例按设计跳过。
- 浏览器现场：`/planner` 地图直接点击生成“地图选点 30.643, 119.309”，完成评分与天气渲染；控制台错误 0。
# WorkspaceShell display architecture close-out (2026-08-30)

- [x] Audit the interrupted `refactor/ui-workspace-shell-v1` implementation against the local plan and current `main`.
- [x] Close the inspector lazy-mount/focus, mobile drawer, Fireglow shell/palette, Planner geometry, and migrated E2E gaps.
- [x] Pass the full Chromium suite with the current working tree (90 passed, 18 skipped by project, 0 failed).
- [x] Fix the production visual-smoke regression where direct Planner map entry leaked Leaflet tiles outside the map viewport, and lock it with E2E coverage.
- [x] Install the required Firefox/WebKit runtimes in the approved download directory and pass cross-browser smoke tests (4 passed).
- [x] Re-run `npm run check`, inspect the current production UI at desktop/mobile sizes, and record final evidence.
- [x] Commit and push the completed branch, then open PR #16 against `main` without merging it.
- [x] Close the CI-only WebKit source-dialog focus-loop failure and rerun PR checks.

## Review

- `npm run check`: PASS — ESLint, TypeScript, 40 Vitest files / 231 tests, Next.js 16.3 production build.
- `npm run test:e2e`: PASS — 91 passed, 19 project-specific skips, 0 failed in 2.2 minutes.
- Local `npm run test:e2e:cross-browser`: PASS — Firefox desktop and WebKit mobile, 4 passed, 0 failed. The CI-only WebKit Shift+Tab race was fixed at the dialog capture boundary and also passed 6 repeated focus-loop runs.
- Production visual smoke: PASS — 24 desktop/tablet/phone/landscape states, all with zero page overflow, zero CARTO requests, and zero duplicate nearby panels.
- Visual smoke found and closed one extra defect through RED/GREEN: direct Planner map entry lacked Leaflet CSS and leaked tiles; the final Planner map overflow is 0.
- Integration boundary: push this branch and create a PR against `main`; do not merge without Jovi's explicit approval.

# Adjustable inspector and hourly lift (2026-08-30)

- [x] Use the approved A layout: desktop evidence rail defaults to 360px, supports pointer/keyboard/preset adjustment, and keeps the map in flow.
- [x] Re-space the decision summary with a 12/16/20px type hierarchy and grouped evidence rows.
- [x] Automatically raise the hourly forecast for every newly selected location; retain an explicit 44px control and keep it unobscured on mobile.
- [x] Keep static VIIRS night-light reference collapsed and free of misleading hourly-forecast controls.
- [x] Add RED/GREEN browser coverage for width defaults, left/right drag, keyboard/preset alternatives, text metrics, selection expansion, static-reference semantics, and mobile lift geometry.
- [x] Pass local check, full Chromium E2E, Firefox/WebKit smoke, and visual review.
- [ ] Commit/push the exact UI change, await PR #16 CI, then deploy that exact SHA to ECS without merging the PR.

## Review

- `npm run check`: PASS — ESLint, TypeScript, 40 Vitest files / 231 tests, production build.
- `npm run test:e2e`: PASS — 95 passed, 23 project-specific skips, 0 failed.
- `npm run test:e2e:cross-browser`: PASS — Firefox desktop plus WebKit mobile, 4 passed.
- Visual review: PASS at 1440×1000, 390×844 and 844×390. Desktop inspector defaults to 360px; mobile control remains inside the timeline; static night-light mode has no false hourly expansion.
- Source dialog focus recovery: PASS — Chromium core 4/4, Firefox/WebKit core 4/4, and Firefox/WebKit focus-loop repeat 8/8.

# Data refresh and map controls follow-up (2026-08-30)

- [x] Diagnose local/public API, browser requests, fireglow phase behavior, worker scope, asset flags, and deployment state.
- [x] Write the evidence-first repair plan at `docs/superpowers/plans/2026-08-30-data-refresh-and-map-controls.md` (local ignored plan; do not depend on GitHub visibility).
- [ ] Get Jovi's approval for the follow-up plan before changing source code.
# 2026-09-10 搜索“太子尖”空结果排查

- [x] 复现搜索输入、候选列表和 API 请求，确认断点位置。
- [x] 对比可搜索城市/已有点位与“太子尖”的匹配数据，形成单一根因假设。
- [x] 先补充失败回归测试，再做最小范围修复。
- [x] 运行 lint/typecheck/单元与搜索专项 E2E，更新工程记录和 lessons。

## Review

- Scope: 仅修复地点搜索无法命中已有点位的问题，不调整评分、地图图层或地点目录。
- Baseline: `main@1f61690`，生产 v1.0.12 已部署；本轮已合并为 `main@14ad3a49cf1`（v1.0.13）。
- Evidence: `https://photo.joviluma.com/api/geocode?q=太子尖&count=8&language=zh` 返回 `{"results":[]}`；同接口搜索“杭州”返回 2 条；本地 `catalog.json` 包含 `finder-232-location / 临安太子尖`。
- Hypothesis: 搜索链路只代理 Open-Meteo，未把本地观星点目录作为候选；山峰/网红机位不在 GeoNames 时因此必然空结果。
- Verification: `npm run check` 53 个测试文件 / 306 项通过；`npm run test:e2e` 112 passed / 34 skipped / 0 failed；`npm run test:live` PASS；`npm audit --omit=dev --audit-level=high` 0 vulnerabilities。
- Remaining: 无；分支已 push、main 已合并、生产已部署，公网搜索和健康检查通过。
- Publication: `main@14ad3a49cf1` 已上线；`/api/geocode?q=太子尖` 返回“临安太子尖”，app/worker healthy。
# 2026-09-10 省级网红观星地点扩充

- [x] 按省份检索公开来源，整理适合银河/暗夜、晚霞和云海的候选机位，记录来源与安全边界。
- [x] 与现有 257 个观星目录、CloudSea 专用目录和 11 个默认候选去重，确定新增目录点与默认候选点。
- [x] 先补充目录/候选数量与字段回归测试，再实现最小数据变更。
- [x] 运行数据校验、lint/typecheck/单元/E2E，更新 v1.0.14 版本记录、工程日志和项目文档。
- [x] 按授权流程提交 `codex/` 分支、合并 main、部署并做公网健康与页面验收。

## Review

- Scope: 只扩充有公开来源的摄影/观星地点和默认候选入口；不改评分算法、天气 Provider、地图图层或推荐门槛。
- Baseline: `main@7651302`，生产 v1.0.13 已部署。
- Evidence: 通用目录 282 条、31 个省级行政区、B1 37 / B2 180 / B3 21 / B4 44；默认精选 17 条；`npm run check` 53 个测试文件 / 308 项通过；Chromium E2E 112 passed / 34 skipped / 0 failed；`npm run test:live` 和生产依赖审计通过。
- Boundary: 新增点位是公开资料交叉核对的候选参考，坐标/海拔可能为 POI 或景区范围近似；夜间开放、保护区、票务、道路、海况、高反和防火仍需人工确认。
- Evidence update: 省级覆盖断言补齐后最终 `npm run check` 为 53 个测试文件 / 308 项通过；`main@39338495db0d` 已 push、生产构建 revision 为 `39338495db0d`，ECS app/worker healthy，公网 `/healthz`、`/api/data-status`、`check:data-sources` 和浏览器页面验收通过。
- Remaining: 无本轮代码/部署剩余项；真机、性能、授权暗夜栅格和现场科学校准仍按测试台账保持 MANUAL/BLOCKED/DEFERRED。
# 2026-09-13 生产观星指数与全数据源审计

- [x] 复现“网页 94 分、现场低/中层云较多”的评分输入、时间和地点上下文。
- [x] 审查 Open-Meteo 各模型/总云/低云/中云/高云/降水/能见度字段映射与评分门禁。
- [x] 审查 forecast、observing snapshot、worker、客户端缓存、强刷冷却和 stale 降级的时效性。
- [x] 审查 NASA GIBS/Himawari、VIIRS、NOAA Kp、AQI、pressure-level、geocode 与 `/api/data-status` 来源边界。
- [x] 核对 ECS 容器、构建 revision、日志、快照卷和公网 API 是否与当前 `main` 一致。
- [x] 汇总证据、风险分级和修复计划；本轮不在未确认根因前修改评分算法或部署代码。

## Review

- Evidence: 生产复现 `2026-09-12T21:00` 的 `finder-088-location / 利川星斗山` 返回 `stale=true + score=94 + cloud=8`；同地点同时间多模型总云量 8–100；ECS 日志出现 Open-Meteo 429；候选页单次访问约 164 个 forecast 请求。
- Evidence: 生产 v1.0.14/build `39338495db0d`，app/worker healthy、worker 重启 0；数据源 API 连通和字段探测通过，但这不等于单点预报准确。
- Findings: P0 为请求风暴、超龄磁盘 forecast fallback、stale 高分仍显示、地图评分忽略分层云；P1 为双评分链、乐观缺失值、worker/首页模型键不一致、provider 时间/网格元数据不足、健康探测覆盖不足。
- Next: 等 Jovi 确认后另开 `codex/` 分支实施 P0 失败测试与最小修复；修复前不调整生产评分或删除快照。

# 2026-09-13 观星数据完整性 P0 接收与收敛

- [x] 接收 `codex/data-source-integrity-audit-20260913` 候选，核对祖先关系、依赖版本与交接边界。
- [x] 在 Node24 下运行新增完整性测试与 `npm run check`，记录第一个真实失败和最小修复。
- [x] 修复选中地点 store 的 metadata/stale/model/sourceFetchedAt 传播与模型切换隔离。
- [x] 统一同地点同模型同时次的核心小时评分输入与可见 `scoreBasis/scoreTime/aggregation` 契约。
- [x] 补齐 store、cloudGrid、observing snapshot、worker 的请求去重、批量校验、时间轴和故障冷却。
- [x] 完成 React/Playwright 回归；未执行项明确标记 `NOT_RUN`，不以隔离检查代替真实验证。
- [x] 完成本地完整门禁、真实数据源冒烟、依赖审计和 PR #29 的五项 GitHub CI；开始准备 v1.0.15 发布记录。
- [ ] 版本提交推送后重新通过最终 CI，再合并 `main`、按部署手册上线并完成公网四工作区验收。

## Review

- 接收基线：候选 `ee313b9d1da61a177fbd07f152283cc262b17408` 已核对为当前审计分支 HEAD 的祖先。
- 代码证据：Node24、定向完整性 22 项、全量 Vitest 58 文件/337 项、lint、typecheck、Next 构建均通过；P0 React/Chromium 故障注入与候选并发回归通过。
- 浏览器门禁：完整 Chromium `118 passed / 36 designed skips / 0 failed`；Firefox/WebKit `4 passed / 0 failed`；P0 stale94、低云61、候选并发/模型切换/429 冷却和云图强刷回归均通过。
- GitHub CI：PR #29 的 `quality`、`live-data-smoke`、`container-smoke`、`e2e`、`cross-browser-smoke` 全部成功；版本提交后的最终 CI 仍需重新执行。
- 准确率校准、生产部署和最终 main SHA 仍保持阻断；版本记录已先写明未校准边界，不把代码绿灯写成现场预报准确。

# 2026-09-13 Worker stale 语义纠正

- [x] 复现生产 HTTP 200 stale 快照被 worker 误记为 fresh、且空 `sourceFetchedAt` 的问题。
- [x] 让 worker 核验 stale/integrity/sourceFetchedAt，stale 时跳过专题预热并退避；快照缺少源时间时省略字段。
- [x] 增加 worker stale 合同测试并完成 Node 语法、P0 定向测试；版本记录升级为 v1.0.16。
- [ ] 重新通过最终 CI、合并本 hotfix、按回滚保护部署并完成公网天气配额恢复后的验收。

## Review

- 生产复现：`v1.0.15 / 0e25bb1961bf` 的 worker 日志为 `fresh`，对应快照为 `stale: true`、`sourceFetchedAt` 缺失；天气探针 HTTP 429。
- 当前部署仍保留 `v1.0.15 / 0e25bb1961bf` 回滚镜像，active snapshot volume 未删除；本 hotfix 尚未合并或部署。

# 2026-09-13 时间轴数据质量标签纠正

- [x] 复现生产时间轴“暂无有效预报/原始抓取未提供”与“数据质量：可用”并存的问题。
- [x] 让质量标签按 stale、无有效预报、匹配可用预报三态显示，并补充 HTTP 502 真实浏览器回归；版本升级为 v1.0.17。
- [ ] 重新通过最终 CI、合并本 hotfix、按当前回滚镜像部署并完成公网复核。

## Review

- 生产基线：v1.0.16 / 106155b9cf3a；天气探针仍为 Open-Meteo HTTP 429，其他数据源状态保持明确。
- 本分支只改时间轴质量文案与测试，不放宽天气完整性门槛、不伪造数据恢复。

# 2026-09-14 跨午夜验证稳定性

- [x] 复现凌晨 00:00–05:00 低云 61 E2E 门禁因 fixture 日期锚点错误而落到“数据不足”。
- [x] 让 E2E 合成预报按当前进行中的观测夜起点生成完整 20:00–05:00 时间轴。
- [x] 逐个运行 52 个 unit 文件与 6 个 integration 文件；专项桌面/移动回归通过。
- [ ] 完成最终全量 E2E、跨浏览器、CI、合并和生产部署后，回填发布证据。

## Review

- 根因：上海时间凌晨仍属于前一晚观测夜，静态按当天 00:00 起始会漏掉 20:00–23:00。
- 变更边界：仅测试夹具和版本记录；生产评分、天气 Provider、完整性门槛保持不变。
# 2026-09-21 手机/平板纵向滚动与顶部精简

- [x] 读取 UI 规范，实际查看手机/平板布局并定位 viewport 锁定和筛选过高。
- [x] 默认折叠筛选，页头随文档滚动，地图触摸模式可切换，时间轴分行。
- [x] 静态、352 项测试、生产构建与相关桌面/移动回归。
- [ ] 提交并部署后核对生产布局。
- [ ] 真机滑动：ADB 打开网页被自动审批拒绝，保留 NOT_RUN。
# 2026-09-22 数据恢复与交互收尾

- [x] 核对本地候选 772487d 和 Owner 脏工作区；读取移动专项规范。
- [x] 修复瓦片错误按图层/瓦片恢复，增加重试及恢复回归。
- [x] 火烧云逐日请求结果独立处理，刷新失败旧数据在地图/排行/详情一致标记。
- [x] 取消云海过时请求的后续重试，校验响应日期和模型。
- [x] 添加不改变布局的点击反馈，尊重 reduced-motion。
- [x] 当前候选 check、故障恢复 E2E、跨浏览器与截图审查；记录实际未完成项。

Review：62 文件/362 项测试、lint/typecheck/build 通过；212项 Chromium 全量最后一次149通过/61条件跳过/2条对齐测试失败，改成中心对齐断言后2项复跑通过。Firefox/WebKit 4通过。八张原图已读、ScoreRing未知值与城市标签避让补齐，详见 `docs/ui-audit/2026-09-22-recovery-and-original-screenshots.md`。

边界：仅本地验证和提交，等待 Jovi 审核；不合并、不部署。评分公式保持原有科学口径。

## 2026-09-24 短高宽屏仪表盘密度

- [x] 以已发布 `main@b2517427`（v1.0.19）为基线，隔离在 `codex/widescreen-dashboard-density-20260924`；不碰 Owner 主工作区。
- [x] 为 1200px 以上、520px 以下短高视口压缩云海/火烧云页头与选择控件，保留日期、阶段、导航语义。
- [x] 添加 1653×413 云海/火烧云响应式回归，覆盖页头占高、地图可视高度、横向溢出、阶段/日期/刷新间距、日期选中态和说明折叠。
- [x] 重建后检查两页实际截图；复核焦点、按钮尺寸和完整日期文案。
- [x] 完成代码门禁与短高/手机/平板回归，记录 PASS / NOT_RUN。
- [x] 生成供 Jovi 检视的候选与结果；物理手机验收只在浏览器能实际打开时报告，不以模拟视口代替。

### Review

- 本轮开始时仅有 `src/app/mobile-document-scroll.css` 与 `tests/e2e/responsive-layout.spec.ts` 两项源码差异；`git diff --check` 通过。
- `npm run check`：PASS — ESLint、TypeScript、63 个 Vitest 文件 / 368 项测试、Next.js 16.3.4 生产构建。
- `responsive-layout.spec.ts`：PASS — 5 passed / 5 按项目条件跳过；1653×413 桌面短高屏覆盖云海、火烧云日期完整性、阶段/日期/刷新间距、地图区域、横向溢出、键盘焦点、13px 控件文字及 48px 点击目标；手机主页与两类详情抽屉回归通过。
- 两页浏览器截图已逐张目视核验，天气/瓦片使用 E2E 合成 fixture，不是实时数据验收。
- 真机手机浏览：NOT_RUN — 当前桌面连接设备的浏览器启动受策略阻止；未声称真机通过。
- PR #35 已创建，远端分支内容 SHA 经逐 blob 对齐；CI run #312 首轮 quality/live-data/cross-browser/container 均 PASS。
- 首轮 Chromium 全量 162 passed / 68 skipped / 2 failed；两项都复现同一版本历史测试回归（v1.0.19 写死、且未保留为历史条目）。本地改为读取当前 package version、补回 v1.0.19 历史卡后，专项桌面/手机测试 2/2 PASS；完整 PR CI 重跑待完成。
- 生产 `https://photo.joviluma.com/healthz` 实测仍为 v1.0.19 / `b25174276f997dd3a3c16eddf7c10600857fa35a`；PR 未合并、候选未部署。
- 独立复核子任务未在等待窗口内返回；已完成人工逐文件复核，不记为独立审查通过。
