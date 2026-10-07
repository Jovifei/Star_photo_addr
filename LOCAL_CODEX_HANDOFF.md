## 2026-10-07 remote follow-up — v2 stale weather migration

STATE: READY_FOR_LOCAL_VALIDATION
TASK: starphoto-378-postrelease-acceptance
ITERATION: 3

Remote branch: `codex/postrelease-v2-stale-fallback-20261007`
Base CODE_HEAD: `bb4fb9744828268dd55cfb65a0628eacd1aa2b4c`

### Exact commits

- RED test commit: `ed74ff53ccc7fc4005624d1eac88cf51d41035a5`
- CODE_HEAD: `53ea1d015664738abd5a10eaab260dd5d26bfe3b`
- CODE_HEAD tree: `a102adbf2ea3dfdb5b50bc3942e0b445c0fe28e0`

### Decision

The prior v3 migration correctly prevents ambiguous pre-offset records from becoming fresh. Rejecting v2 entirely, however, creates an avoidable data-availability regression during provider cooldown: recent cloud/rain/wind facts with valid original timestamps can disappear even though stale recommendations are already fail-closed.

The follow-up therefore allows v2 only as a read-only stale-facts source. It never becomes fresh, never enters the in-memory v3 cache, never rewrites/deletes old files, and cache-only reads do not call the provider.

For v2 specifically, reuse requires:
- exact model and location count through `usableDiskForecast`;
- original source age within the existing retention limit;
- finite recorded `requestedLatitude/requestedLongitude` for every location;
- coordinate equality to the current request within 1e-5.

The potentially ambiguous `utcOffsetSeconds: 0` is preserved as raw historical evidence but cannot publish an astronomy/recommendation result because the returned response is force-marked stale and `forecastTrustIssue` rejects stale forecasts before scoring.

### Local RED/GREEN

Use locked project dependencies.

1. At `ed74ff53ccc7fc4005624d1eac88cf51d41035a5`:
   `npm run test -- tests/integration/forecastDiskIntegrity.test.ts`
   Capture the exact failing cases/count.
2. At `53ea1d015664738abd5a10eaab260dd5d26bfe3b`:
   rerun the same file; all cases must pass.
3. Then at CODE_HEAD run:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`
   - `npm run build`
4. Confirm `bb4fb9744828268dd55cfb65a0628eacd1aa2b4c..${fix.result.commit_sha}` changes only:
   - `tests/integration/forecastDiskIntegrity.test.ts`
   - `src/app/api/forecast/route.ts`

Do not deploy, merge Draft PR49, alter network/credentials, or touch Owner notes.

Still PENDING: physical phone, broad a11y, global selected-location timezone/DST, scientific forecast accuracy, and terrain-obstruction astronomy.


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
