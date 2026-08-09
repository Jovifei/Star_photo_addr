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
