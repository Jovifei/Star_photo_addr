# 2026-10-07 T1 selected-point timezone handoff

STATE: READY_FOR_LOCAL_VALIDATION
TASK: starphoto-378-postrelease-acceptance
ITERATION: 6

Production remains `378161ffe6aa21989ef48e63c9d077343d276a95`. No deployment or Draft PR49 merge was performed.

## Exact current-base chain

- Current authorized/source baseline: `755a1fe1ee16f2fda47c337b7e6c72255a3bd1d6`
- T1 RED: `63a3147d2f2d71fb709ad1cd8798bb82df7d3b65`
- T1 CODE_HEAD: `478e008e3d8be74b87e114f831ac830737a9a959`
- T1 CODE_HEAD tree: `11ec3fa008906e6c1d3ba145e4155cb0fb61e563`
- Remote branch: `codex/postrelease-selected-point-timezone-t1-final-20261007`

The provisional `2727d8ba039c33f786c1b6c33bd9fb92c318c33d` candidate is superseded. It exercised the intended T1 behavior but local typecheck found five TS2345 calls because `CloudState.activeForecastTime` is optional (`string | null | undefined`) while the async clock guard contract is `string | null`.

The exact fix is intentionally narrow: all three captures now normalize with `state.cloudState.activeForecastTime ?? null`. This removes the optional-`undefined` boundary without widening the reducer/action contract.

## RED/GREEN structure

RED `63a3147d2f2d71fb709ad1cd8798bb82df7d3b65` is based directly on the current `755a1fe` baseline and changes only:
- `tests/unit/nighttime.test.ts`
- `tests/unit/storeHydration.test.ts`

It locks:
- the same absolute instant resolving to Shanghai Oct 7 13:xx but Los Angeles Oct 6 22:xx;
- selected-point pre-dawn ownership of the previous observation night;
- selected LA forecast timezone updating point night/hour/window;
- China catalog night/hour remaining on Shanghai;
- a user-explicit night/hour chosen while forecast is in flight not being overwritten.

GREEN `478e008e3d8be74b87e114f831ac830737a9a959` changes only nine product files:
- `src/lib/nighttime.ts`
- `src/lib/store.tsx`
- `src/components/ProductStateBridge.tsx`
- `src/components/CandidateList.tsx`
- `src/components/StarWindowTable.tsx`
- `src/components/ObservingMapControl.tsx`
- `src/components/RecommendationQuickControls.tsx`
- `src/components/ObservingSitesLayer.tsx`
- `src/components/ViewportRecommendationPanel.tsx`

## Architecture boundary

The selected point and China catalog intentionally use separate clocks.

Selected-point domain:
- `selectedNight`
- `nightKeys`
- `forecastWindowStart`
- `cloudState.activeForecastTime`
- selected `Location.timezone`

These are synchronized from the trusted selected forecast's IANA timezone only while the point clock is still automatic.

China catalog domain:
- `catalogSelectedNight`
- `catalogNightKeys`
- `catalogForecastWindowStart`
- `catalogForecastTime`

Candidate comparisons and nationwide observing-snapshot/recommendation consumers use this catalog clock and therefore do not shift to Los Angeles when the user selects an LA point.

Explicit point selections are preserved:
- if the user changes night/hour while forecast hydration is in flight, timezone hydration only records the location timezone and does not replace those explicit values;
- a coordinate-bound URL `forecastTime` is not rejected against the pre-hydration Shanghai calendar.

This stage does NOT claim DST repeated-hour correctness. T2 canonical-instant/DST work remains separate.

## Required local proof

Use exact locked project dependencies.

1. RED:
   `npm run test -- tests/unit/nighttime.test.ts tests/unit/storeHydration.test.ts`
   The new T1 cases must be discovered and fail on the old clock behavior. Record exact FAIL/PASS counts.
2. GREEN at `478e008e3d8be74b87e114f831ac830737a9a959`:
   rerun the exact focused command; all tests must pass.
3. Run `npm run typecheck` first and confirm the five former TS2345 errors are gone.
4. Run full `npm run check`.
5. Inspect `755a1fe1ee16f2fda47c337b7e6c72255a3bd1d6..${code}` and confirm only the 11 files listed above changed.
6. Fixture/browser validation before integration:
   - at instant `2026-10-07T05:58:59.788Z`, a mocked/selected LA point with `America/Los_Angeles` must show point-local Oct 6 / about 22:00;
   - China candidate/snapshot controls must remain on Shanghai Oct 7 / about 13:00;
   - an explicit coordinate-bound forecastTime must survive hydration.

Do not deploy, merge Draft PR49, modify network/credentials, or overwrite Owner notes.

After this exact T1 candidate is locally accepted and integrated, the next authorized remote stage is the compact mobile + independent astronomy/raw-fact work specified in `docs/MOBILE_DENSITY_REDESIGN_20261007.md`. Do not start T2 DST canonical-instant redesign in that stage.


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

