# Mobile / Tablet Browser Architecture v2

Source: remote ChatGPT plan `c2c_7b4e`, based on the selected workspace connector and current project documents.

## Outcome

Build a mobile-first browser architecture with five explicit layers:

1. native document scroll;
2. content-first information architecture;
3. secondary sheets for tools and explanations;
4. explicit map interaction mode;
5. truthful provider/data/recommendation states.

The first executable package is `MOBILE-V2-P0`: baseline reconciliation plus a RED mobile acceptance suite. It must not change product UI.

## Eight work packages

0. Reconcile the Owner dirty worktree, exact baseline SHA, historical SHAs, and a clean isolated worktree. `DONE` at `52036ed`.
1. Define mobile information architecture. At 390×844 keep header/navigation/actions within 170–180 CSS px and make the map visible. Put the current judgement in document flow; keep advanced filters in a secondary sheet. The first home filter sheet batch is `DONE` at `ac6b425`.
2. Establish one document scroll owner. Remove competing viewport cages and nested vertical scrollers; keep only sheet bodies vertically scrollable and the hourly matrix horizontally scrollable.
3. Create one adaptive sheet primitive for modal semantics, backdrop, scroll lock, focus trap/restore, Escape, safe areas, orientation changes, and reduced motion. Reuse existing Base UI/shadcn dependencies after license metadata review.
4. Define map gesture ownership: preserve the current map-first default direct pan/zoom contract; the former explicit “move map” mode is `SUPERSEDED_BY_MAP_FIRST_CONTRACT`. Resize observers and legend placement remain separate work.
5. Centralize presentation of provider health, selected-data validity, and recommendation eligibility. Preserve `missing != 0`, `stale != fresh`, `partial != available`, and fail-closed score rules.
6. Re-layout Fireglow and CloudSea with current context first, map, status, ranking, detail, and long explanations in sheets. Preserve empty snapshot and partial pressure protections.
7. Measure interaction performance and remove gesture/layout contention. Use short transform/opacity transitions and `prefers-reduced-motion`; do not add forced smooth scrolling or virtualize without profiling.
8. Run the full device, screenshot, browser, CI, and production gates. Real iPhone/Android evidence remains separate from Playwright evidence.

## Open-source/tool boundary

Use `ui-ux-pro-max` as design guidance only; do not copy unlicensed source. Prefer existing Base UI/shadcn primitives, Leaflet/React-Leaflet, and Playwright. Treat undocumented-license projects as concept-only until their license is verified. Do not add a second UI framework or replace the map engine.

## First package completion

`BASELINE_RECONCILED` requires a clean isolated tree, exact SHA relationships, preserved Owner changes, and a recorded RED baseline. Product UI changes start only after that report.

## P2-A route reconciliation and execution (2026-09-28)

Remote review task `c2c_9a7e` supersedes the old information-architecture
assumptions while preserving the map-first contract:

- Mobile L0/L1 stays thin: search, location, and filter entry remain one row.
- L2 “今晚判断” remains primary content in the document flow.
- L3 filters and map tools remain secondary `AdaptiveSheet` content.
- Desktop `>=1200px` keeps the three-column workbench and inline controls.
- The former explicit Move Map mode and mobile all-filters-visible layout are
  `SUPERSEDED_BY_MAP_FIRST_CONTRACT` and must not be reintroduced.

The next finite package is `MOBILE-V2-P2A-HOME-CONTEXT-HIERARCHY`, based on
`origin/codex/mobile-home-priority-v2-20260927@667f167`. It adds only a
read-only mobile context strip for the selected night, forecast model, active
forecast time, and known update time. It must consume existing store values,
show explicit unknown labels, and never calculate or reinterpret score/data
validity. P2-B provenance reduction, P3 data-state presentation, topic IA,
short-landscape, desktop IA, and full gates remain separate later packages.

Status: `EXECUTED_LOCALLY_PENDING_REMOTE_REVIEW`.

Review follow-up: remote audit found a UTC-to-local display ambiguity in the
compact update time. The isolated branch now uses an explicit Shanghai
timezone conversion and a focused E2E assertion; no data or scoring contract
changed.

## P2-B decision/provenance disclosure (2026-09-28)

Remote task `c2c_5d1b` fixes the next boundary after P2-A:

- L2 “今晚判断” and stale/model-mismatch/invalid trust reasons stay visible.
- L3 forecast-instance metadata becomes one native `<details>` disclosure in
  `DecisionSummary`, default closed on mobile and desktop.
- `ObservationDetails` stops duplicating the same forecast provenance; it keeps
  astronomy score, window, dark-sky, moon, galaxy, confidence, and candidates.
- `ForecastAvailability` remains in the existing order and is not folded into
  this package.
- P3 data-state presentation, provider health DTOs, map UI, and topic IA stay
  separate.

Package: `MOBILE-V2-P2B-DECISION-PROVENANCE`
Base: `origin/codex/mobile-home-context-v2-20260928@2c551b4`
Suggested branch: `codex/mobile-decision-summary-v2-20260928`
Status: `EXECUTING_LOCALLY`.

Remote review follow-up added an explicit mobile post-expansion horizontal
overflow assertion; product scope remains unchanged.

## P3-A data presentation contract (2026-09-28)

Remote task `c2c_8f4c` fixes the display boundary without merging the four
underlying fact sources. The three axes are:

- Provider Health: independent `/api/data-status` probe state.
- Selected Data Validity: current location/model/time forecast facts and
  existing integrity results.
- Recommendation Eligibility: whether an existing `NightEvaluation` may be
  published as a recommendation decision.

P3-A adds pure mappers from existing facts to presentation DTOs, a compact L2
data/recommendation block, and a provider-panel scope sentence. It does not
reimplement scoring/integrity, put provider health in the store, or start P3-B
CloudTimeline/ObservingMapControl vocabulary work.

Review follow-up: raw forecast identity is now preserved for integrity error
classification, explicit invalid reasons outrank generic stale fallback, and
P0/refresh tests cover unavailable/stale → withheld recommendation states.

Package: `MOBILE-V2-P3A-DATA-PRESENTATION-CONTRACT`
Base: `origin/codex/mobile-decision-summary-v2-20260928@952577fa`

## P3-B state surface alignment (2026-09-28)

Remote task `c2c_b3e8` keeps each surface's fact owner and shares only the
presentation contract. `presentHourlyDataValidity` maps CloudTimeline's
existing source/stale/hour/missing-field facts; `presentMapRecommendationEligibility`
maps ObservingMapControl's snapshot/request/stale/publishable-count facts.
Provider Health remains CloudControl-only. Raw snapshot status and unknown
scores remain intact.

Package: `MOBILE-V2-P3B-STATE-SURFACE-ALIGNMENT`
Base: `origin/codex/data-state-presentation-v2-20260928@7462417`
Suggested branch: `codex/data-state-surfaces-v2-20260928`

Review follow-up: legacy `forecastQualityLabel` presentation text was removed;
hourly status cases now live in the P3 mapper contract tests.

Review follow-up also aligned the existing product-integrity unknown-score test
with the new map eligibility contract without removing raw snapshot status.

