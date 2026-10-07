## 2026-10-07 remote follow-up — v2 stale weather migration

STATE: READY_FOR_LOCAL_VALIDATION
TASK: starphoto-378-postrelease-acceptance
ITERATION: 3

Remote branch: `codex/postrelease-v2-stale-fallback-v2-20261007`
Base CODE_HEAD: `bb4fb9744828268dd55cfb65a0628eacd1aa2b4c`

### Exact commits

- RED test commit: `ed74ff53ccc7fc4005624d1eac88cf51d41035a5`
- CODE_HEAD: `15282daf8daebe1bac06115f0b814cecf5307e0b`
- CODE_HEAD tree: `c2de62d5fe8eb35503901e7ef6a6468c011191e0`

### Review decision

The v3 namespace remains the only fresh offset-integrity cache. A pre-offset v2 file may contain an ambiguous historical `utcOffsetSeconds: 0`, so it is never eligible for fresh use or astronomy/recommendation scoring.

Completely ignoring v2 would also hide still-valid recent provider weather facts during cooldown. This follow-up therefore permits v2 only as read-only stale raw facts.

A v2 fallback must pass:
- existing exact model and location-count validation;
- original source-age retention gate (filesystem mtime never rejuvenates it);
- finite recorded `requestedLatitude/requestedLongitude` on every location;
- equality of those recorded coordinates to the current request within 1e-5.

Behavior:
- v3 remains the only fresh disk namespace;
- v2 is force-marked stale in envelope and per-location metadata;
- original timestamps and raw cloud/rain/wind values are preserved;
- cache-only v2 reads never call the provider;
- v2 is never written into the server v3 memory cache and old files are not deleted/re-written;
- `forecastTrustIssue` rejects stale forecasts before night scoring, so ambiguous offset evidence cannot publish recommendations;
- existing bare-legacy cache header names remain unchanged; only v2 uses `cache-only-pre-offset-disk` / `stale-pre-offset-disk`.

### Required local proof

Use the project's locked dependencies.

1. At RED `ed74ff53ccc7fc4005624d1eac88cf51d41035a5`:
   `npm run test -- tests/integration/forecastDiskIntegrity.test.ts`
   Capture exact failure count/cases.
2. At CODE_HEAD `15282daf8daebe1bac06115f0b814cecf5307e0b`:
   rerun the same focused test; all cases must pass.
3. Then run:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`
   - `npm run build`
4. Confirm `bb4fb9744828268dd55cfb65a0628eacd1aa2b4c..${cleanCommit.result.sha}` changes only:
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
