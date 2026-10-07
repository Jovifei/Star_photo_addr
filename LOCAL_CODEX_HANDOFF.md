## 2026-10-07 remote follow-up — MapSetup stale status semantics

STATE: READY_FOR_LOCAL_VALIDATION
TASK: starphoto-378-postrelease-acceptance
ITERATION: 4

Remote branch: `codex/postrelease-mapsetup-a11y-20261007`
Base CODE_HEAD: `15282daf8daebe1bac06115f0b814cecf5307e0b`

### Exact commits

- RED test commit: `f5badf69b2ee21289aaa6d3dda37f6b969cd7fd8`
- CODE_HEAD: `fadf68c127d23a15dc4b3d413c6dee037dbc39dc`
- CODE_HEAD tree: `886ebd561c365db215c8140c4e381a8a0ccf4ef8`

### Proven issue and minimal repair

`MapSetup` always rendered `role="status"`. The ready state only added the CSS class `.hidden`, whose current CSS changes `opacity` and `pointer-events` but not accessibility-tree exposure. Therefore the visually faded loading copy can remain an active status node after the map is ready.

The repair preserves the DOM node and existing 0.6s opacity fade. It adds `aria-hidden=true` only while `hidden/ready` is true. During active loading, `aria-hidden` is absent and `role=status` remains available for the loading announcement.

No focus-management behavior, map readiness logic, CSS animation, network/data code, scoring, or Owner files are changed.

### Required local RED/GREEN

Use locked project dependencies.

1. At RED `f5badf69b2ee21289aaa6d3dda37f6b969cd7fd8`:
   `npm run test -- tests/unit/mapSetupA11y.test.tsx`
   The ready-state accessibility test should fail because the hidden overlay still exposes `role=status`.
2. At CODE_HEAD `fadf68c127d23a15dc4b3d413c6dee037dbc39dc`:
   rerun the same test; both lifecycle cases must pass.
3. Then run:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`
   - `npm run build`
4. Confirm `15282daf8daebe1bac06115f0b814cecf5307e0b..${fix.result.commit_sha}` changes only:
   - `src/components/MapSetup.tsx`
   - `tests/unit/mapSetupA11y.test.tsx`

Optional browser evidence after integration: after `.map-setup.hidden`, the accessibility snapshot must no longer contain the loading status while the element remains in the DOM for the visual fade.

Do not deploy, merge Draft PR49, alter network/credentials, or touch Owner notes.

Still PENDING: physical screen-reader/device proof, broad a11y, global selected-location timezone/DST, scientific forecast accuracy, terrain-obstruction astronomy, and independent astronomy-fact availability when weather fields are incomplete.

### Staged next work after this a11y fix validates

#### Stage T1 — selected-point local calendar semantics

Source evidence: home initialization and clock resync call `currentNightKey()` / `initialForecastTime()`, and those helpers currently hard-code `Asia/Shanghai`. The selected forecast already carries an IANA `timezone`, but `selectLocation()` does not synchronize the selected-location clock from it.

Plan:
- make `currentNightKey`, `initialForecastTime`, and any relevant date helper accept an explicit IANA timezone while retaining Shanghai as the catalog/default compatibility value;
- add explicit store clock-basis state so an automatic location-timezone sync cannot overwrite a user-selected historical night/hour;
- after a successful selected-point forecast, bind the selected arbitrary point to `forecast.timezone` and recompute only auto-owned `nightKeys/selectedNight/forecastWindowStart/activeForecastTime`;
- do not switch the China observing-site catalog snapshot date away from its current China-date semantics;
- defer home deep-link forecastTime rejection until the selected point timezone is known instead of validating arbitrary overseas coordinates against Shanghai.

Tests:
- same instant yields different correct evening date/hour for Asia/Shanghai and America/Los_Angeles;
- pre-dawn ownership still maps to the previous evening in each timezone;
- changing selected point across timezones updates only auto clock state;
- explicit historical night/hour survives forecast hydration;
- URL forecastTime validation is relative to resolved selected-point timezone, not browser/process timezone.

#### Stage T2 — DST-safe absolute hourly identity

Current hourly identity is a provider-local wall-clock string and scoring recovers UTC with one response-level offset. This needs a dedicated DST proof before global acceptance.

Provider contract to evaluate: Open-Meteo supports `timeformat=unixtime`, returning hourly timestamps as GMT+0 epoch seconds while still returning the resolved timezone identifier. Prefer carrying an absolute instant alongside the location-local display label rather than guessing DST offsets from geography or a single static offset.

Plan:
- first add contract fixtures for America/Los_Angeles spring-forward and fall-back nights;
- if the current ISO-local representation cannot uniquely preserve repeated/missing DST hours, add a canonical absolute `instant` to normalized hours and use it for ordering/astronomy identity;
- keep local wall-clock labels for UI/night grouping, derived from the resolved IANA timezone;
- never collapse two distinct fall-back instants merely because their local HH:mm labels match;
- only retire response-level offset arithmetic from astronomy after equivalent China/UTC/negative-offset/DST regressions are green.

#### Stage A1 — independent astronomical facts

Source evidence: `evaluateNight()` returns null when any `missingNightInputs` field is absent, including ICON visibility. `ObservationDetails` then reads Moon illumination, dark hours and Galactic maximum only from that nullable weather-scored evaluation, so valid geometric facts disappear with an unrelated meteorological field.

Plan, after the timezone/instant foundation:
- add a separate `NightAstronomyFacts` projection computed from selected location + canonical night instants using `astronomyAt`; it must not calculate or imply a weather score;
- include Moon illumination/phase, astronomical-dark-hour count/duration, Galactic-center maximum altitude, and enough provenance to state the timezone/time basis;
- keep score/window/confidence fail-closed when weather inputs such as visibility are incomplete;
- update `ObservationDetails` and the CloudTimeline Moon summary to use astronomy facts independently from `NightEvaluation`;
- preserve the displayed selected-location elevation as unknown when unknown. If Astronomy Engine receives its existing 0 m computational fallback, label that as a geometric calculation fallback, never as actual site elevation;
- keep terrain/building horizon obstruction explicitly out of scope, so altitude above the mathematical horizon is not called guaranteed photographic visibility.

Tests:
- ICON night with visibility=null => weather evaluation null, score/window/confidence withheld, but Moon/dark-duration/Galactic facts present;
- stale/missing weather values do not fabricate any weather recommendation;
- unknown elevation remains unknown in UI while astronomy calculation still completes with an explicit fallback note;
- waxing/waning labels remain correct from the already repaired phase angle;
- astronomy facts remain identical across browser/process timezones for the same absolute instants and selected IANA timezone.


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
