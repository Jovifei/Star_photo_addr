## 2026-10-07 remote review follow-up — cache + astronomy

STATE: READY_FOR_LOCAL_VALIDATION
TASK: starphoto-378-postrelease-acceptance
ITERATION: 2

Remote branch: `codex/postrelease-cache-astro-20261007`
Base/evidence head: `d3dc923a325eaa53d2d77575ea6863aeaecae8ab`

### Follow-up commits

- Cache RED: `20d75bf7e440c0012044e06f2a7282c9a2e399ad`
- Cache fix: `343252c9135d4c2572effe3212ab266231188f2e`
- Moon-phase RED: `e27cc57c73f9b8d206bf1dbb2c85e915455a0dcf`
- Astronomy implementation: `4b44981c90271f54733fae43e1c44adf6660d778`
- Type evidence: `99aa0bd13962d97a135af8751ed93917c851959c`
- CODE_HEAD: `bb4fb9744828268dd55cfb65a0628eacd1aa2b4c`

### Why cache migration is required

The original missing-offset repair prevents NEW unknown offsets from becoming zero. It cannot identify an OLD disk record that was already normalized to `utcOffsetSeconds: 0`. Such a record is numerically finite and can pass current disk/client/scoring gates. We do not infer timezone offsets from coordinates or names.

The fix bumps the surface cache namespace from `surface-v2-past1` to `surface-v3-offset`. This leaves old files intact but makes pre-offset-contract v2 records unreachable as fresh input after the repaired process starts. Explicit UTC zero remains valid in v3.

### Proven astronomy defect

`moonPhaseName(fraction, waxing = true)` was called without a waxing/waning input, so the night summary could only emit waxing names for quarter/crescent/gibbous phases. Astronomy Engine exposes `MoonPhase(date)` as a 0..360 phase angle; the repair carries that angle through hourly astronomy evidence and uses <180 for waxing, >180 for waning. Illumination-based scoring is unchanged.

### Required local RED/GREEN proof

Use locked project dependencies; do not count transient npx versions.

1. At cache RED `20d75bf7e440c0012044e06f2a7282c9a2e399ad`, run:
   `npx vitest run tests/integration/forecastDiskIntegrity.test.ts`
   The two new cache-contract tests are expected to fail on the pre-migration implementation.
2. At cache fix `343252c9135d4c2572effe3212ab266231188f2e`, rerun the same file; it must pass.
3. At moon RED `e27cc57c73f9b8d206bf1dbb2c85e915455a0dcf`, run:
   `npx vitest run tests/unit/astronomy.test.ts`
   Waning-name/phase-angle assertions are expected to fail.
4. At CODE_HEAD `bb4fb9744828268dd55cfb65a0628eacd1aa2b4c`, rerun the astronomy test and then:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`
   - `npm run build`
5. Compare `d3dc923a325eaa53d2d77575ea6863aeaecae8ab..${codeHead}` and confirm only:
   - `src/app/api/forecast/route.ts`
   - `tests/integration/forecastDiskIntegrity.test.ts`
   - `src/lib/astronomy.ts`
   - `src/lib/types.ts`
   - `src/lib/scoring.ts`
   - `tests/unit/astronomy.test.ts`
   changed.

Do not deploy, merge Draft PR49, alter credentials/network, or overwrite Owner notes.

### Still open

Global selected-location date/time remains a separate architecture issue: store initialization/home URL filtering uses fixed Asia/Shanghai while Open-Meteo surface forecast uses `timezone=auto`. This is source-proven inconsistency for arbitrary overseas map/search coordinates, but the correct repair must synchronize selected-point clocks from forecast timezone without changing China observing-catalog night semantics. Physical-phone, broad a11y, slow/interrupted/repeated UX, overseas/DST acceptance, forecast accuracy, and terrain-obstruction astronomy remain PENDING.


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
