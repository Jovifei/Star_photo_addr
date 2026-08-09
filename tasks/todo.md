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
