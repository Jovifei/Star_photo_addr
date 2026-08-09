# Publication task

- [x] Inspect repository docs, architecture, branch topology, and worktree state
- [x] Run relevant validation and summarize the implemented product scope
- [ ] Create one squashed publication commit while preserving the latest development branch
- [ ] Push the validated state to `master` and recheck remote/local refs

## Review

- `npm run check`: PASS — lint 0 errors (3 existing unused-variable warnings), typecheck PASS, 12 Vitest files / 95 tests PASS, Next production build PASS.
- `PORT=4178 npm run test:e2e`: PASS — desktop 6/6, mobile 5/5, 11 passed / 1 skipped. The default `:3000` was occupied by unrelated WSL/Docker listeners, so the configured alternate port was used.
- `npm run test:live`: PASS on retry — Open-Meteo returned 2 locations, 48 surface hours, and 10 pressure levels.
- Product scope: Next.js App Router with `/`, `/sites`, `/planner`, `/viirs` compatibility redirect, same-origin forecast/geocode APIs, shared URL state bridge, weather/astronomy scoring, interpolated three-layer cloud map with cross-midnight timeline, recommendation locations, multi-location/multi-night planner table, responsive/accessibility fixes, and licensed-asset fail-closed degradation.
- Publication strategy: preserve `main` and `codex/product-integration-final`; create `master` from `origin/main` with the complete integrated tree as one squashed commit.
