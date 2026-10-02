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


## 2026-10-01 Emergency repair handoff — merged and deployed

Base: `d21165e88aa1a859aba917f24ea4c6c51c517edc`.
Merged `main` SHA: `bd23a7c442e18ae5eae449e46d5ed0a10a307c0d` (PR #39).
Remote route semantics PR #38 was merged into the release branch before #39.
Production image: `star-photo-addr:deploy-bd23a7c442e1`; public buildRevision: `bd23a7c442e1`.
The previous active image remains on the host for rollback. App and worker both use the original `star-photo_observing-snapshots` volume.

## Product result

- All four entry points now share desktop 65px header, 17px title, 13px navigation and 44px equal tabs. Phone uses the 48px top strip and four equal navigation targets; topic date/phase controls expand without increasing the top bar.
- Finder raw forecast batches persist/share exact model, coordinates, variables and range. Source timestamps are preserved across cache hits. Fresh cache is 3h; failure fallback is explicitly stale and limited to 6h.
- Provider 429 and the longest Retry-After propagate through point forecast, Finder, Fireglow and observing routes. Quota cooldown persists across process restart. Manual refresh does not bypass provider cooldown. Worker waits for provider Retry-After.
- Forecast/pressure policy imports are separated from server file I/O so browser bundles do not import `node:fs`.

## Verification

- Local `npm run check`: PASS — lint, TypeScript, 67 test files / 395 tests and production build.
- Product header E2E: 28 route/viewport combinations PASS, including 1440×500; mobile map-first: 12 PASS.
- New route regressions cover fresh versus stale disk cache, daily quota Retry-After, stale Finder fallback and provider response handling.
- Public CloudSea header was measured after deployment: 65px / 17px / 13px, 44px tabs.
- Production `/healthz`: app `star-weather-planner`, version 1.0.22, buildRevision bd23a7c442e1; app/worker healthy, restart count 0, original data volume mounted.
- Production best_match forecast for the sample location: HTTP 200, cache=memory, X-Data-Stale=false, 48 hourly records / 48 finite cloud values, model=best_match, sourceFetchedAt=2026-10-01T07:59:00Z.
- Production CloudSea snapshot for 2026-10-01, GFS: HTTP 200 memory hit, stale=false, surface 54/54 available, pressure 54/54 available, 50 sites scoreable across phases; visible morning ranking lists 48.
- The public page no longer shows the 429 banner and displays ranked sites. Fireglow worker had current-day fresh data; later fireglow dates remained stale on the last worker observation, so that multi-day range still needs observation.

## Remote review status

PR #38 contains the remote route-semantics follow-up. The complete merged/deployed tip has not yet received a final `DONE` from the existing ChatGPT conversation: in this environment its connector returned internal errors and the in-app browser could not open ChatGPT. Do not mark the remote final audit complete until it reviews exact SHA bd23a7c442e18ae5eae449e46d5ed0a10a307c0d and returns its verdict.

The recurring quiet heartbeat is configured to continue the weather/remote-handoff loop. The local Owner worktree `E:\project\Star_photo_addr` remains dirty on its original main and was preserved.

## 2026-10-01 Candidate forecast evidence repair — local product tip

Base: `main@7a572b538caad9a881066cdd8c301a161c1523d1`.
Branch: `codex/candidate-weather-evidence-20261001`.
Product commit: `f65f3b2349e2fb2a620c949fef9e7d09eb961922`.
Version: `v1.0.23`.

The candidate cards and seven-location matrix now retain fresh same-model cloud cover, precipitation probability, wind speed, model identity and `sourceFetchedAt` when night scoring is withheld. They state the missing field and continue to leave score/rank empty. Candidate scoring uses a separate model setting from the cloud raster; it defaults to Best Match and requests up to 64 candidates as one batch. The selected matrix row loads the same candidate-score model independently. The map raster remains on its existing ICON/GFS/AIFS model contract.

Local evidence before commit: `npm run check` PASS — lint, TypeScript, 68 test files / 399 tests and production build; `git diff --check` PASS. Candidate evidence/client tests: 9/9. Candidate presentation: desktop and mobile Best Match/ICON transitions passed; desktop data-state presentation 4 passed / 1 project skip; version history v1.0.23/1.0.22 passed.

Production source gate against the currently deployed `buildRevision=bd23a7c442e1`: no active quota marker was present; one bounded seven-location Best Match request across the public catalog areas shown in the screenshot returned `sourceFetchedAt=2026-10-01T10:08:25.354Z`, `stale=false`, and seven non-null night scores when evaluated by the local v1.0.23 scoring code. The following `cache_only=1` read returned HTTP 200 from memory with the same model and fresh state. Jovi's exact candidate coordinates are browser-local and were not read by this process, so this confirms the live source/scoring contract for those public area points rather than the exact saved list. v1.0.23 is not yet deployed and its page-level production acceptance remains pending.

Owner preservation: `E:\project\Star_photo_addr` remains on `main@3334e0c08f9ab2e481277628ce4ee875e2f1039e` with its pre-existing dirty files; no Owner files were edited.

PR: `#41 OPEN` — https://github.com/Jovifei/Star_photo_addr/pull/41.
Merged: `NO`.
Deployed: `NO`.
Remote review of product SHA: `PENDING`.

Next: send PR #41's current head SHA and this handoff to the existing ChatGPT conversation. Ask it to verify the candidate data/scoring contract against the last handoff, review model separation and request economy, discuss any technical disagreement, and propose the next product phase. Resolve its findings, then merge and deploy only after the fresh real-data and page checks pass again on the deployed v1.0.23 build.

## 2026-10-02 Screenshot follow-up — current production evidence

- Screenshot surface: `StarWindowTable`. Production `/healthz` still reports `bd23a7c442e1` / v1.0.22; PR #41/v1.0.23 is not deployed.
- The open page URL gives the selected point `(31.633617, 120.234375)`. A `cache_only=1` read for ICON returned HTTP 200 from memory, `stale=true`, `sourceFetchedAt=2026-10-01T14:17:00.742Z`, 192 hourly rows, cloud/precipitation/wind 189 valid each, and visibility 0. Best Match returned HTTP 429 `cache-only-miss` for this exact point. These reads did not call the supplier.
- A second Best Match cache-only read returned generic `Retry-After: 60` with no `X-Weather-Limit`. The 60 seconds is the route's cache-miss minimum and does not prove the persisted cooldown marker's absolute deadline.
- One ordinary Best Match request was attempted as a bounded production check, but automatic approval review rejected it because cooldown expiry was not reliably verified. The request was not dispatched; no supplier quota was consumed.
- Read-only source review found that failed candidate batches were silently caught when there is no same-model cache; the table then rendered generic `数据不足` without the request failure/retry state. The isolated worktree now preserves the safe server error and Retry-After in a status row while leaving scores/ranking withheld.
- RED/GREEN evidence: the new 429 test failed before the UI status existed, then passed on desktop and mobile (2/2). Final `npm run check` PASS: lint, typecheck, 68 test files / 399 tests, Next build. `git diff --check` PASS. These are local fixture/code checks only.
- Existing ChatGPT conversation attempted the exact PR #41 SHA review through the compare page and immutable raw-file URLs; it could not read their contents and returned `BLOCKED`. No exact remote review, new commit, merge, or deployment is claimed.
- Next gate: the async approval request is pending. The attempted ordinary Best Match request was rejected before dispatch by automatic approval review because the generic cache-miss `Retry-After: 60` could not prove that the persisted provider cooldown had expired. No supplier request was sent. Once Jovi supplies a read-only cooldown access path or authorizes one bounded single-point request, verify fresh exact-coordinate fields and score. The follow-up code is uncommitted; do not commit, merge, or deploy until production data passes and the remote exact-SHA review can read the source.

## 2026-10-02 Local integration for main refresh

- Fetched current `origin` refs. Local Owner `main@3334e0c08f9ab2e481277628ce4ee875e2f1039e` is 100 commits behind `origin/main@7a572b538caad9a881066cdd8c301a161c1523d1` and has no local-only commits. The 100 count is commit history, not 100 file changes.
- Candidate feature branch `origin/codex/candidate-weather-evidence-20261001@768300e02956e7437970b28a8f5f2e709aac9573` is exactly 3 commits ahead of current `origin/main`, based directly on `7a572b5`.
- Created local isolated integration worktree `C:\Users\Admin\.codex\worktrees\starphoto-main-refresh-20261002\Star_photo_addr` from `origin/main`, then fast-forwarded the candidate feature branch. The resulting tree includes the previously tested 429 status fix and matching handoff changes.
- Post-merge local verification passed: `npm run check` (lint, typecheck, 68 test files / 399 tests, Next build) and the desktop/mobile StarWindowTable 429 E2E (2/2) on temporary local port 3317. No weather-provider or production page requests were made by these tests.
- The Owner checkout is still dirty and unchanged. It was not pulled, reset, stashed, or overwritten. The local integration branch has not been pushed; PR #41 remains open. Merge to remote/deploy remain gated on exact-coordinate production weather acceptance and remote ChatGPT review.

## 2026-10-02 Functional consolidation release candidate

Supersedes prior Oct02 statements that Owner main remains 100 commits behind or that production cooldown expiry is unverified.

- Original E:\project\Star_photo_addr is clean main@7a572b538caad9a881066cdd8c301a161c1523d1. Owner changes backed up in ZIP and local snapshot ef15634ef7de914d6c5ea0a17f1189a666ec5194 before fast-forward.
- Integration a496632630a50b7a11ef940c4d0dde100b80ee3a includes all previously outstanding branch ancestry after functional audit/migration; historical branches retained.
- Candidate Best Match, request-error evidence, Next16.3.8, model-aware cloud/scoring capability, pressure shared persisted cooldown, strict pressure time axis, observing worker previous-night and timestamp/model/date checks integrated.
- Complete npm check PASS:70 test files410 tests, lint/typecheck/production build. Browser run7 PASS5 SKIPPED2 CHANGES_REQUIRED desktop selected-data loading; investigating hydration cleanup race. No deploy until resolved and rerun.
- Authoritative production cooldown marker absent; one bounded genuine Best Match request fresh sourceFetchedAt2026-10-02T05:23:26.681Z stalefalse. Saved response passes two-night actual scoring test. No fresh assertion about other points or rendered production page yet.
- PR41 updated and existing remote ChatGPT exact-SHA review now actively reads workspace/GitHub sources. Final remote verdict pending.
- Obsidian approved home profile incrementally registered star_photo_addr original root, retaining7 other mappings and backup. Mirror preview completed; no private deployment documents will be mirrored. Actual filtered sync follows final local main update.
- Production remains bd23a7c442e1/v1.0.22. Retain existing rollback image and original snapshot volume on deployment.

## 2026-10-02 Remote exact-SHA review follow-up — candidate/raster loading + pressure cooldown

Review source:
- PR #41 exact reviewed head: `a496632630a50b7a11ef940c4d0dde100b80ee3a`
- Base: `main@7a572b538caad9a881066cdd8c301a161c1523d1`
- Remote repair branch: `codex/candidate-pressure-review-followup-20261002`
- Product repair commits:
  - `1603fd823f7972d96999f010d4c7278f5b5be083` — decouple StarWindow selected-row loading from raster loading
  - `e69488a00e301ce21ada08516b752d643a273b97` — preserve shared provider cooldown on pressure refresh responses
- Regression-source commits:
  - `5300c7d1eb9883e9776be15975ec78480a1e0434` — selected-row/raster-loading browser contract
  - `c3626d9afb35d75e4fbef87a3c5a93934ffb6e8a` — pressure provider-cooldown precedence
- Consolidation review log commit: `fe8ad18f504bd1180454a78892d17d2300434f86`
- Final handoff branch tip is the commit containing this section; use the exact SHA returned by remote ChatGPT.

### Exact review result on a496632

Accepted:
- Candidate scoring is intentionally separate from the raster model. New sessions use `candidateForecastModel="best_match"`; `DEFAULT_CLOUD_STATE.model` remains `icon`. This is the preferred architecture because point-score completeness and map-raster continuity are different concerns. No Best Match fields are spliced into an ICON forecast.
- The candidate loader is one stable bounded batch per model/day/location set; six saved candidates are one request. The selected table row uses the same candidate-score model, reusing a same-point candidate cache when possible and otherwise requesting the selected coordinate separately.
- Fresh same-model ICON data with missing visibility retains raw cloud/precipitation/wind and original `sourceFetchedAt`, but `projectCandidateNight` keeps `evaluation=null`, reports the exact visibility blocker, and leaves score/rank withheld.
- Stale, model mismatch, source age and missing required scoring fields remain fail-closed.
- Pressure ingestion now uses the shared Open-Meteo provider slot / typed rate-limit error path.
- Worker observing identity treats Shanghai 00:00–05:00 as the previous observing night while Fireglow prewarm remains on the calendar date.
- Historical branch consolidation uses functional migration plus current-tree precedence; old branch contents are not allowed to overwrite newer provider/cache/UI semantics merely to create ancestry.

Remaining defects repaired remotely:
1. `StarWindowTable` selected rows still set `loading` from global raster `state.loading`. This could hide an already-ready Best Match candidate score while an independent ICON raster request was slow, matching the current desktop loading-timeout symptom. Loading now depends on the candidate forecast itself plus its own request error.
2. `/api/pressure-forecast` early force-refresh suppression returned only the local coordinator retry window. Response headers now merge that local window with the shared provider cooldown via `openMeteoRateLimitHeaders()`, so a daily provider cooldown cannot be shortened by a 60-second local guard.

Protected:
- no score weights changed;
- no required scoring fields changed;
- no cross-model weather filling;
- no candidate/raster default model change;
- no pressure-profile derivation or CloudSea scoring change;
- no ProductHeader/map layout change;
- no merge/deploy.

### Test status

REMOTE TEST EXECUTION: `NOT_RUN`.

The recorded local evidence at `a496632` (70 Vitest files / 410 tests, lint/typecheck/build PASS) applies only to that exact SHA. The PR browser gate was still unresolved at review time: 7 pass / 5 skip / 2 desktop loading failures. Those results do not validate this remote repair head.

Local Codex must run, from the final remote head:

1. `npm run test -- tests/integration/pressureRoute.test.ts tests/unit/candidateNightEvidence.test.ts tests/unit/candidateForecastClient.test.ts`
2. Desktop + mobile candidate data presentation including the new selected-row/raster-loading case:
   `npx playwright test tests/e2e/data-state-presentation.spec.ts --project=desktop --project=mobile`
3. The browser gate set that previously produced the two desktop loading failures; confirm zero assertion/timeouts before integration.
4. `npm run check`
5. `git diff --check`

Do not merge solely because static/unit tests pass. The browser loading failures must be reproduced/closed on the exact received head.

### Production acceptance boundary

Production remains the older deployed revision until local integration/deployment is explicitly completed. The recorded real Best Match source response (`sourceFetchedAt=2026-10-02T05:23:26.681Z`, `stale=false`, two nights scoring successfully) is useful provider/scoring evidence only; it is not post-deploy page acceptance for this branch.

After deployment verify separately:
- exact `/healthz` build revision/version;
- candidate Best Match selected/card/table provenance and score on real page coordinates;
- ICON raster remains independent;
- missing visibility still withholds score rather than filling from Best Match;
- pressure 429/fallback returns the shared long provider Retry-After when applicable;
- stale/source timestamps remain original;
- no browser loading timeout remains.

MERGED: `NO`.
DEPLOYED: `NO`.
