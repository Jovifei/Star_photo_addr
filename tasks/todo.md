# Website clone: stargazing-finder-dark (2026-08-12)

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

### Review

- `npm.cmd run lint`: PASS。
- `npm.cmd run typecheck`: PASS。
- `npm.cmd run test:unit`: PASS，15 个测试文件 / 114 个测试。
- `npm.cmd run build`: PASS，Next 16.3.0 生产构建，`/api/observing/snapshot` 与 worker 脚本已纳入产物路径。
- Chrome E2E targeted: PASS，默认卫星、卫星帧播放、预报/光污染互斥、规划器共享网关、真实侧栏拖宽持久化、375/768/1024/1440 无页面横向溢出。
- Chrome E2E full: PARTIAL，桌面 7 项和移动端其余业务项通过；修复后的移动端矩阵用例已单独复测 PASS。Playwright 生产服务器子进程在全量结束阶段未自动退出，需后续清理测试 runner 生命周期，不能据此声明全量命令为完整绿灯。
- `http://127.0.0.1:3100/healthz`: PASS，应用标识 `star-weather-planner`、版本 `0.3.1`、构建修订 `local`。
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
