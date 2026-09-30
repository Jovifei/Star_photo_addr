# Mobile Browser v2 — Local Codex Handoff

## Remote review source

- Repository: `Jovifei/Star_photo_addr`
- Source branch: `codex/mobile-browser-ia-v2-20260927`
- Source HEAD: `1a0a746ba6c38770e615a1f4f052eb4af8b60334`
- Product implementation commit: `ac6b425c75fe0d6131fb1d8be23e51fef6999dbe`
- Remote branch: `codex/mobile-home-priority-v2-20260927`
- Remote reviewed tip: `3fa6446c1a9957e5b67958bec6224916694070ae` (resolve the branch tip again before receiving work)
- Base: `origin/main@5a054fd31bda0f743bdc68345ebb3916d0199294`
- Owner workspace: `E:\project\Star_photo_addr` (dirty; preserve it)

## Completed and reviewed

- `52036ed`: portrait/tablet document-scroll contract.
- `e0a68df`: reusable `AdaptiveSheet` and mobile map-tools migration.
- `1a0a746`: baseline/review documents.
- Mobile filter remained the open content-priority gap: it used the old absolute `.location-filter-controls` popup in the received branch.

## This handoff implementation — complete

`MOBILE-V2-P1-HOME-CONTENT-PRIORITY` moves mobile/tablet filter controls into `AdaptiveSheet` while keeping desktop inline controls. It preserves the search/location/filter 48px row, current store state, localStorage semantics, map selection, and all fail-closed data rules.

Files changed:

- `src/components/MapSearchCard.tsx`
- `src/app/mobile-map-first.css`
- `tests/e2e/mobile-content-flow.spec.ts`
- `tests/e2e/mobile-home-priority.spec.ts`

PR: not created because local `gh` is not authenticated. The implementation branch is pushed and ready for a draft PR.

## Acceptance

- Mobile 320/390/768/1024: filter sheet has `role=dialog`, `aria-modal=true`, focus restore, Escape/backdrop close, stable `scrollY`, and one internal vertical scroll body.
- Desktop 1200/1440: recommendation controls remain inline and no mobile filter dialog appears.
- `npm run typecheck`, `npm run lint`, `npm run build` pass.
- Focused mobile and desktop E2E pass.
- No changes to provider, cache, snapshot, score, `.env`, or fail-closed semantics.
- Verification: typecheck PASS, lint PASS, build PASS, mobile 11 passed, desktop inline 2 passed.

## Next remote review

LOCAL_CODEX_NEXT:

1. Fetch `origin` and resolve `origin/codex/mobile-home-priority-v2-20260927` again.
2. Do not modify, reset, clean, stash, or overwrite Owner dirty `main`.
3. Use a new isolated worktree from the resolved remote tip.
4. Rerun the focused tests and `npm run check`; run full Chromium/cross-browser only for merge review.
5. Keep physical-device validation manual and separate from Playwright.
6. Record execution output and send `EXECUTED` to remote ChatGPT for review.

Do not merge `main` or deploy from this handoff.

## Next cycle — P2-A home context hierarchy

Remote planning/review task: `c2c_9a7e`
Source branch: `codex/mobile-home-priority-v2-20260927`
Source head: `667f16746c4982624673ce7491b93ca977d3379c`
Implementation branch: `codex/mobile-home-context-v2-20260928`
Base tip: `667f16746c4982624673ce7491b93ca977d3379c`
Package: `MOBILE-V2-P2A-HOME-CONTEXT-HIERARCHY`

### Product result

`HomeContextStrip` is a read-only mobile context line rendered before the map.
It shows the selected night, existing forecast model, active forecast time, and
known update time. Unknown values stay explicit. The command row remains one
48px search/location/filter row, the map-first budget remains intact, and
desktop inline controls are unchanged.

### Files

- `src/components/HomeContextStrip.tsx`
- `src/components/PerseidsApp.tsx`
- `src/app/mobile-map-first.css`
- `tests/e2e/mobile-home-context.spec.ts`
- `tasks/plans/2026-09-27-mobile-browser-architecture-v2.md`
- `docs/engineering-change-log/2026-09-28-mobile-home-context-hierarchy.md`

### Evidence

- `npm run check`: PASS — lint, typecheck, 64 Vitest files / 370 tests, build.
- Focused E2E: mobile context 4 PASS; desktop context 2 PASS; map-first 16
  PASS; content-flow/home-priority 11 PASS; related desktop inline 4 PASS.
- `git diff --check`: PASS.
- Provider/cache/snapshot/score/fail-closed rules: unchanged.
- Full Chromium/cross-browser, real device, CI, and production: `NOT_RUN`.

### Remote review handoff

The final pushed tip must be resolved from
`origin/codex/mobile-home-context-v2-20260928` after push; this handoff does
not self-reference its own commit. Remote ChatGPT should independently read
the branch diff and the latest execution output, verify that the context strip
does not add command-bar height or data semantics, and return `DONE`,
`CHANGES_REQUIRED`, or `BLOCKED`.

PR: `NOT_CREATED — gh auth unavailable locally`
Merged: `NO`
Deployed: `NO`

## Next cycle — P5-B CloudSea evidence IA

Remote planning task: `c2c_d92e`, iteration 2
Base: `codex/fireglow-topic-ia-v2-20260929@47779d74b6fe1d160bc2d68c90b9712101b1de33`
Implementation branch: `codex/cloudsea-evidence-ia-v2-20260929`
Package: `MOBILE-V2-P5B-CLOUDSEA-EVIDENCE-IA`
Final reviewed product/test tip: `27510270edbff21cbc5fe997c0bacc436bf3ea29`
Final handoff tip: pending docs-only close

### Product result

CloudSea now keeps three facts separate: surface evidence, pressure coverage,
and the selected mountain/window's publishable score and vertical conclusion.
Global partial coverage remains an evidence/status row while a selected site
with a real score keeps its score. A selected pressure-unavailable site keeps
surface humidity/wind and shows vertical evidence unknown. Unknown-only data is
not threshold-empty. The desktop legend and low-frequency card/detail content
use native disclosures; mobile keeps one `MobileDataSheet`.

### Files changed

- `src/app/cloudsea/CloudSeaApp.tsx`
- `src/app/cloudsea/CloudSeaSiteDetail.tsx`
- `src/app/cloudsea/cloudsea.css`
- `tests/e2e/cloudsea-topic-ia.spec.ts`
- `tests/e2e/cloudsea-request-order.spec.ts`
- `tests/e2e/score-threshold-filters.spec.ts`
- `tests/e2e/unknown-marker-semantics.spec.ts`
- `tasks/todo.md`
- `docs/engineering-change-log/2026-09-29-cloudsea-evidence-ia.md`

### Protected boundaries

Do not modify `src/lib/cloudsea.ts`, `src/lib/cloudLayers.ts`,
`src/lib/pressure.ts`, `src/lib/cloudseaOverlay.ts`, `src/lib/scoreThreshold.ts`,
CloudSea snapshot/pressure API routes, provider/cache/request batching, score,
ranking algorithm, pressure majority rule, Fireglow, or `MobileDataSheet`.
Missing values remain missing; pressure partial is not unavailable; vertical
unknown is not low score; no synthetic cloud base/top or heuristic conclusion
is introduced.

### Evidence

- `npm run check`: PASS — 65 Vitest files / 379 tests; lint, typecheck, build.
- P5-B topic IA: 4 PASS / 4 project skips; CloudSea pressure: 4 PASS;
  unknown-only: 1 PASS; CloudSea threshold desktop/mobile: 2 PASS;
  request-order: 1 PASS; day3: 1 PASS; mobile map-first `/cloudsea`: 1 PASS.
- Follow-up winning-date/stale-scope E2E: 2 PASS; selected context now binds
  the winning `dateKey`, raw window and snapshot for mobile/detail output.
- CloudSea unit/integration/release integrity: 41 PASS.
- `git diff --check`: PASS.
- Full Chromium, cross-browser, real device, CI, production: `NOT_RUN`.

### Remote review result

Remote ChatGPT independently reviewed `0d80b8f` → `2751027` and returned
`DONE`. It confirmed the three-day winning window/date/snapshot consistency,
selected versus global stale scope, CloudSea truth boundaries, protected blob
SHA, Fireglow untouched and Owner preservation. Product/test work is complete;
the docs-only close records the final handoff tip.

### Remote review handoff

Remote ChatGPT has independently resolved and approved the product/test tip.
After this docs-only close it should confirm the final handoff tip; verify surface /
pressure semantics, unknown-only versus threshold-empty, selected score under
global partial coverage, mobile vertical-unknown and total-failure copy,
desktop disclosures, protected blobs, Fireglow untouched and Owner
preservation. Return `DONE`, `CHANGES_REQUIRED`, or `BLOCKED` before the next
phase.

PR: `NOT_CREATED — gh auth unavailable locally`
Merged: `NO`
Deployed: `NO`

### Protected rules

Do not alter `forecastIntegrity.ts`, scoring, provider/cache/snapshot/API code,
Fireglow/CloudSea data semantics, or the map-first gesture contract in this
package. Preserve `missing != 0`, `stale != fresh`, and `partial != available`.

## Next cycle — P2-B decision/provenance disclosure

Remote planning task: `c2c_5d1b`
Source branch: `codex/mobile-home-context-v2-20260928`
Source head: `2c551b485553bbe7bfc69dfbf896f23be3957b83`
Implementation branch: `codex/mobile-decision-summary-v2-20260928`
Base tip: `2c551b485553bbe7bfc69dfbf896f23be3957b83`
Package: `MOBILE-V2-P2B-DECISION-PROVENANCE`

### Product result

Keep the L2 decision and trust reason visible. Put long forecast-instance
metadata in one native `details` disclosure with keyboard-visible summary;
remove the duplicate `.observation-provenance` from `ObservationDetails`.
`ForecastAvailability` stays in place. Do not move provenance into an
`AdaptiveSheet`, change score/integrity semantics, or start P3.

### Files

- `src/components/workspace/DecisionSummary.tsx`
- `src/components/ObservationDetails.tsx`
- `src/components/PerseidsApp.tsx`
- `src/components/workspace/workspace-shell.css`
- `src/app/mobile-map-first.css`
- `tests/e2e/decision-summary-disclosure.spec.ts`
- `tests/e2e/forecast-integrity-p0.spec.ts`
- `tasks/plans/2026-09-27-mobile-browser-architecture-v2.md`
- `docs/engineering-change-log/2026-09-28-mobile-decision-summary-provenance.md`

### Evidence

- RED captured before implementation.
- `npm run check`: PASS — lint, typecheck, 64 Vitest files / 370 tests, build.
- P2-B focused mobile/desktop disclosure: PASS.
- P0 stale/integrity: 8 PASS; workspace/content regression: 23 PASS.
- `git diff --check`: PASS.
- Full Chromium/cross-browser/device/CI/production: `NOT_RUN`.

Remote review must resolve the pushed branch tip again after commit. Do not
merge or deploy.

## Next cycle — P3-A data presentation contract

Remote planning task: `c2c_8f4c`
Source branch: `codex/mobile-decision-summary-v2-20260928`
Source head: `952577fa38851e3ea2f9cf993383e941cd512851`
Implementation branch: `codex/data-state-presentation-v2-20260928`
Base tip: `952577fa38851e3ea2f9cf993383e941cd512851`
Package: `MOBILE-V2-P3A-DATA-PRESENTATION-CONTRACT`

### Product result

Three presentation axes now remain separate: Provider Health, Selected Data
Validity, and Recommendation Eligibility. L2 shows current data and gate
states; provider probes remain in the L3 provider panel. Optional unconfigured
sources stay neutral. Existing integrity and scoring facts are only mapped to
labels; they are not recomputed.

### Files

- `src/lib/dataPresentation.ts`
- `src/components/workspace/DecisionSummary.tsx`
- `src/components/CloudControl.tsx`
- `src/app/globals.css`
- `src/app/mobile-map-first.css`
- `tests/unit/dataPresentation.test.ts`
- `tests/e2e/data-state-presentation.spec.ts`
- `tests/e2e/forecast-integrity-p0.spec.ts`
- `docs/engineering-change-log/2026-09-28-data-presentation-contract.md`

### Evidence

- Mapper unit: 7 PASS.
- P3A data-state E2E: 4 PASS.
- P0/data-refresh/workspace refresh E2E: 13 PASS.
- `npm run check`: PASS — 65 Vitest files / 377 tests and build.
- `git diff --check`: PASS.
- Full Chromium/cross-browser/device/CI/production: `NOT_RUN`.

### Protected rules

Do not modify `forecastIntegrity.ts`, scoring, hour scoring, store request or
cache behavior, API routes, provider probes, snapshot worker, Fireglow/CloudSea
semantics, or merge/deploy without separate authorization. P3-B will later
align CloudTimeline and ObservingMapControl; P4/P5 remain separate.

Review follow-up: the invalid/model-mismatch classification and stale-fallback
priority were corrected after remote review. `DecisionSummary` now passes raw
forecast facts to the authoritative integrity function while keeping evaluation
restricted to the matching model. P0 and refresh E2E assert unavailable/stale
and withheld states. Re-resolve the branch tip after this follow-up commit.

Review follow-up: the mobile disclosure test now explicitly checks
`scrollWidth <= clientWidth + 1` after expanding provenance. This is a test-only
contract addition; no product or data semantics changed.

### Review follow-up

Remote review identified a presentation-only UTC timestamp issue in
`HomeContextStrip`. The follow-up parses ISO timestamps and formats them with
the explicit `Asia/Shanghai` timezone; it does not change forecast data or
validity. The focused E2E now checks the displayed update time against the
timestamp conversion. Re-resolve the branch tip after the follow-up commit;
the prior implementation evidence remains valid.

## Next cycle — P3-B state surface alignment

Remote planning task: `c2c_b3e8`
Source branch: `codex/data-state-presentation-v2-20260928`
Source head: `7462417466711b3d5d45c29ca7ff028338bf4b00`
Implementation branch: `codex/data-state-surfaces-v2-20260928`
Base tip: `7462417466711b3d5d45c29ca7ff028338bf4b00`
Package: `MOBILE-V2-P3B-STATE-SURFACE-ALIGNMENT`

P3-B shares only presentation mappers: CloudTimeline maps hourly source/stale/
hour/missing-field facts; ObservingMapControl maps snapshot request/stale/
publishable-count facts. Keep raw `data-score-status`, unknown-score semantics,
and all integrity/scoring/snapshot owners. Provider Health remains CloudControl.

Evidence: unit 15 PASS; P3-B surface tests pass individually; P0/data refresh/
workspace refresh 13 PASS; `npm run check` PASS; full Chromium, cross-browser,
device, CI, and production `NOT_RUN`. Do not merge or deploy.

Review follow-up: removed the unused legacy `forecastQualityLabel` export and
its old presentation assertions so `dataPresentation.ts` is the single
hourly vocabulary owner. Track geometry tests remain in `timelineTrack.test.ts`.

The product-integrity stale/unknown assertion now checks
`map-recommendation-eligibility=data-state="withheld"` and keeps the raw
`data-score-status` plus “灰色点为当前时次数据不足，不代表低分” contract.

## Next cycle — P4-A map chrome hierarchy

Remote planning task: `c2c_d7b2`
Base: `codex/data-state-surfaces-v2-20260928@90050e710829ea841b3774105506f27dcbf800b8`
Implementation branch: `codex/map-chrome-hierarchy-v2-20260929`
Latest follow-up tip: `450e08eb0a0b207ea1c2c59083c8f89a1ea9706e`

P4-A moves low-frequency map references into the new `MapReferenceTools`
native details wrapper. Desktop canvas no longer mounts the duplicate
`MapBoundaryStatus` or legacy `MapPanelManager`; the inspector keeps one
collapsed “地图说明与视图” section. Mobile layers show only the map layer
bar, Bortle control and collapsed disclosure until the user opens it. The
wrapper is composition-only and does not own provider, forecast, snapshot,
score, or recommendation state.

Files changed:

- `src/components/MapReferenceTools.tsx`
- `src/components/ResponsiveMapControls.tsx`
- `src/components/PerseidsApp.tsx`
- `src/app/ux-map-v2.css`
- `src/app/mobile-map-controls.css`
- `tests/e2e/map-chrome-hierarchy.spec.ts`
- `tests/e2e/mobile-panel-dock.spec.ts`
- `docs/engineering-change-log/2026-09-29-map-chrome-hierarchy.md`

Evidence:

- `npm run check`: PASS — 65 Vitest files / 378 tests; lint, typecheck, build.
- P4-A focused E2E: 6 PASS / 6 project skips.
- Remote review follow-up: mobile disclosure summary now has a measured
  `min-height >= 48px` contract at 390×844 and 812×375; focused E2E 6 PASS / 6
  project skips; `npm run check` remains PASS.
- Map/readability/workspace/map-first regression: 41 PASS / 25 project skips.
- Full Chromium, cross-browser, real device, CI and production: `NOT_RUN`.

Remote review must resolve the final pushed branch tip and independently
check overlay counts, details disclosure, no nested scroll, no old
MapPanelManager mount, and unchanged P3/data owners. Do not merge or deploy.

## Next cycle — P4-B map render status safe zones

Remote planning task: `c2c_7b2f`
Base: `codex/map-chrome-hierarchy-v2-20260929@4c7fc1dc18487e2679cb1eb7428fadeb1041a9d9`
Implementation branch: `codex/map-status-safe-zones-v2-20260929`
Final reviewed tip: `c208a0b7d0a4419f03deccc51ca7dd67cf8795e6`

P4-B keeps MapTileStatus and SatelliteLayer as separate fact owners and
shares only scoped visual lanes. Tile errors use a top-right lane below the
MapLayerBar and retain the message that a render failure is not weather data
absence. Satellite status uses a bottom-left lane; a preserved frame plus
catalogue error is one status badge containing the degradation and
“已保留上一帧”, rather than two role=status elements. Mobile and short
landscape lanes avoid the Leaflet zoom, tool rail, and sibling MobileDataSheet;
the drawer stacking context remains above map status.

Files changed:

- `src/components/MapTileStatus.tsx`
- `src/components/SatelliteLayer.tsx`
- `src/app/globals.css`
- `src/app/ux-map-v2.css`
- `src/app/mobile-map-first.css`
- `tests/e2e/map-render-status-safe-zones.spec.ts`
- `tests/e2e/product-integrity.spec.ts`
- `docs/engineering-change-log/2026-09-29-map-render-status-safe-zones.md`

P4-B must not modify P3 data semantics, scoring, provider/cache, snapshot/API,
store requests, or begin P4-C/P5. Full Chromium, cross-browser, real device,
CI and production remain `NOT_RUN` until separately authorized and executed.

## Next cycle — P4-C marker / label disclosure

Remote planning task: `c2c_c6d3`
Base: `codex/map-status-safe-zones-v2-20260929@8d672172fbeee14f3a4b035935e03bfb4e39e184`
Implementation branch: `codex/marker-label-disclosure-v2-20260929`
Final reviewed tip: `a02aea9711072b9bbd8960dbbc066b1641dbe0ee`
Final reviewed tip: `a02aea9711072b9bbd8960dbbc066b1641dbe0ee`

P4-C keeps ObservingSitesLayer as the selected catalog marker and permanent
label owner. SampleMarker remains for search/custom/map-sampling locations and
is suppressed only when the catalog layer is mounted and truly owns the
selected catalog reference. A selected catalog site is pinned through filters
without changing `data-observing-site-count`. Rank markers keep Leaflet 1.9.4
native temporary Tooltip behavior; no clustering, new engine, or global
tooltip state.

Evidence: `npm run check` PASS — 65 Vitest files / 379 tests; marker focused
7 PASS / 3 project skips; viewport recommendations 2 PASS; app/map-first/P4-B
regressions 31 PASS / 19 project skips. Full Chromium, cross-browser, real
device, CI and production: `NOT_RUN`. Remote verdict: `DONE`.

P5 is the next package: Fireglow / CloudSea topic IA, while preserving their
empty-snapshot and pressure-partial/degraded data semantics.

## Next cycle — P5-A Fireglow topic IA and visual declutter

Remote planning task: `c2c_d92e`
Base: `codex/marker-label-disclosure-v2-20260929@21d07ef1f72e3e307cd6f2880f3c1552939ee830`
Implementation branch: `codex/fireglow-topic-ia-v2-20260929`
Package: `MOBILE-V2-P5A-FIREGLOW-TOPIC-IA`
Final reviewed product tip: `156c31ec209352328c829df55dd38f432e8197dc`
Final handoff tip: pending docs-only review

### Product result

Fireglow presentation now keeps the existing data owners and fail-closed
facts while separating loading, unavailable, stale/fallback, phase-empty and
threshold-empty at the task surface. The permanent desktop colour legend and
long scoring note move into a closed native `details` disclosure in the
ranking panel. The selected detail keeps cloud-layer missing values explicit;
the low-frequency Field Blueprint is a closed disclosure. Mobile keeps one
`MobileDataSheet`; its peek conclusion says “数据不可用 · 请刷新重试” for a
real empty/error snapshot and preserves “旧数据 · 不作推荐” for fallback.
When valid phase scores are filtered out by the user threshold, the mobile
ranking explicitly says `暂无达到 ≥X 分的地点` instead of implying missing data.

### Files changed

- `src/app/fireglow/FireglowApp.tsx`
- `src/app/fireglow/FireglowSiteDetail.tsx`
- `src/app/fireglow/fireglow.css`
- `tests/e2e/fireglow-topic-ia.spec.ts`
- `tasks/todo.md`
- `docs/engineering-change-log/2026-09-29-fireglow-topic-ia.md`

### Protected boundaries

Do not modify `src/lib/fireglow.ts`, `src/lib/scoreThreshold.ts`,
`src/lib/fireglowOverlay.ts`, `src/app/api/fireglow/snapshot/route.ts`,
provider/cache/weather, ranking/scoring, snapshot worker, or CloudSea in this
package. `HTTP 200` with no usable scores remains unavailable; stale data is
never fresh; unknown remains distinct from zero; a phase with no scores is not
threshold-empty.

### Evidence

- `npm run check`: PASS — 65 Vitest files / 379 tests; lint, typecheck, build.
- P5-A topic IA E2E: 4 PASS / 4 project skips; desktop empty snapshot,
  disclosure and failed-date priority, mobile empty peek at 390×844 and
  812×375 with no horizontal overflow.
- Fireglow data integrity: 7 PASS / 5 project skips.
- Fireglow score threshold: 2 PASS; unknown marker: 1 PASS; refresh loop:
  1 PASS; Fireglow product integrity: 3 PASS / 3 project skips; mobile
  map-first `/fireglow`: 1 PASS.
- `git diff --check`: PASS.
- Full Chromium, cross-browser, real device, CI, production: `NOT_RUN`.

### Remote review result

Remote ChatGPT independently reviewed `4053a0e` → `156c31e` and returned
`DONE`. It confirmed the mobile threshold-empty follow-up, empty snapshot and
stale/phase boundaries, map/detail disclosures, protected Fireglow owners,
untouched CloudSea, and Owner preservation. The product/test tip is complete;
this handoff section is closed after the docs-only tip is reviewed.

### Remote review handoff

The product/test tip has been independently reviewed `DONE`. The docs-only
follow-up only aligns this handoff with the final evidence; after it is pushed,
remote ChatGPT should confirm the final tip and then plan P5-B CloudSea
evidence IA. P5-B starts only from this reviewed handoff.

PR: `NOT_CREATED — gh auth unavailable locally`
Merged: `NO`
Deployed: `NO`


## 2026-10-01 Emergency repair handoff (supersedes previous P5 close)
Base: d21165e88aa1a859aba917f24ea4c6c51c517edc. Branch: codex/restore-weather-unify-header-20260930.
Scope: production daily429 request amplification + equal four-product header layout. See docs/engineering-change-log/2026-10-01-weather-header-repair.md for cause and boundaries.
Local emergency evidence at 3d57fa4: lint/typecheck/build PASS; 66 Vitest files / 391 tests PASS; built header geometry 28 combinations PASS; mobile map-first 12/12 PASS. Deployment and fresh-provider recovery remain NOT_VERIFIED.
Remote Project instructions now authorize remote GitHub repair commits on a separate branch followed by exact-SHA local reception/testing; unavailable remote execution is NOT_RUN. Dirty Owner main is preserved. This is not a claim that upstream quota has recovered.


## 2026-10-01 Remote weather-route semantics follow-up

Review base: `3d57fa494b8609c11df63f531154aac9ff98eb45` (`codex/restore-weather-unify-header-20260930`).
Remote branch: `codex/weather-route-semantics-followup-20261001`.
Remote implementation/test-source head: `c61bc8da52345a211fe1a8643578bffe69a4642c`.
Engineering-log commit after implementation: `068e6b499af576e4fc4d586cb80b8bd9766b00b5`.
Final handoff branch tip is the commit containing this section; use the exact SHA returned with the remote handoff.

### Why this follow-up exists

Exact-SHA review found two remaining truth/route gaps in the otherwise sound emergency repair:

- direct `/api/stargazing-finder/weather` did not surface an active provider daily cooldown when no usable hourly data existed;
- `/api/forecast?cache_only=1` changed a still-fresh persistent disk response to stale solely because the server process had restarted.

A related header issue existed in the local refresh guards: their short cooldown could replace a longer provider daily `Retry-After`.

### Remote changes

- `src/lib/forecast.ts`
  - `openMeteoRateLimitHeaders(minimumRetryAfterSeconds)` returns the longer of local refresh cooldown and active provider cooldown, preserving `X-Weather-Limit`.
- `src/app/api/forecast/route.ts`
  - fresh persistent disk cache remains fresh for cache-only reads when original source timestamps are inside `FORECAST_CACHE_TTL_MS`;
  - stale-retained disk cache remains explicitly stale;
  - cache-only miss and refresh-suppressed responses keep the longer provider cooldown.
- `src/app/api/stargazing-finder/weather/route.ts`
  - active provider cooldown + no usable hourly data returns `429` with long `Retry-After`;
  - usable stale Finder data remains HTTP 200 but carries `X-Data-Stale:true` and provider cooldown metadata.
- `src/app/api/observing/snapshot/route.ts`, `src/app/api/fireglow/snapshot/route.ts`
  - local refresh suppression no longer overwrites a longer provider cooldown.
- Regression sources:
  - `tests/integration/stargazingFinderWeatherRoute.test.ts` (new)
  - `tests/integration/forecastRoute.test.ts`
  - `tests/unit/openMeteoRateLimit.test.ts`

No scoring, ranking, CloudSea pressure/model logic, ProductHeader geometry, map behavior, provider URL/model choice, or freshness age thresholds were changed.

### Test status and required local verification

REMOTE TEST EXECUTION: `NOT_RUN` — remote GitHub write tools do not provide the repository command/test executor.

Local Codex must run before integration:

1. `npm run test -- tests/unit/openMeteoRateLimit.test.ts tests/integration/forecastRoute.test.ts tests/integration/stargazingFinderWeatherRoute.test.ts`
2. `npm run check`
3. `npx playwright test tests/e2e/product-header-geometry.spec.ts --project=desktop`
4. `npx playwright test tests/e2e/mobile-map-first.spec.ts --project=mobile`
5. `git diff --check`

The header gates are regression checks because this remote follow-up does not edit header files.

### Production acceptance after local integration/deploy

Do not call weather PASS from build, container health, or page HTTP 200. Verify separately:

- actual public weather API response status;
- `Retry-After` and `X-Weather-Limit` under remaining daily quota cooldown;
- `X-Data-Stale` / cache-source headers;
- original `sourceFetchedAt` is unchanged on cache reuse;
- fresh disk cache stays fresh after process restart, stale retained cache stays stale;
- real usable hourly weather exists before declaring fresh-weather recovery.

At remote handoff time the upstream provider was still daily-429 and production fresh weather remained `NOT_VERIFIED`.

MERGED: `NO`.
DEPLOYED: `NO`.
