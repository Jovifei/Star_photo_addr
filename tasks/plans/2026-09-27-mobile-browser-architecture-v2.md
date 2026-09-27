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

