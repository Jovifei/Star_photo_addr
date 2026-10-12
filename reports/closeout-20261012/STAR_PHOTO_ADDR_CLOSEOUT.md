# Star_photo_addr closeout - 2026-10-12

## Start state and ownership

- Workspace: E:\project\Star_photo_addr; readable at task start.
- Starting branch/SHA: main / cd54bc4a02ae06503e45f6a3a88c04ba9cfeed10; starting worktree was clean.
- Repair branch: codex/data-boundaries-20261012, created from that exact baseline. main remains at the baseline.
- The source thread 01a115dd-b886-72ea-881b-350cee61d0ec was idle. The only active Star_photo_addr task found was this delegated run; no separate same-project writer or pre-existing user edit was found.
- No model override or model switch was made. The executor did not expose a model identifier for independent verification. No usage, environment, or dependency-install blocker was found.
- Read the repository guidance, .agents/skills/ui-ux-pro-max/SKILL.md, current engineering handoff, and the installed Next 16.3 client, Route Handler, and fetch guidance. .codegraph/ exists, but no CodeGraph tool was available in this run.

## Audited findings and fixes

1. **CloudSea wind units:** added wind_speed_unit=ms to the Open-Meteo surface request, matching the scoring thresholds and UI labels.
2. **429 retry/cooldown propagation:** the surface request now uses the shared Open-Meteo provider slot, records 429 cooldowns, stops retrying a 429, and forwards Retry-After on degraded, fallback, and error responses. A transient 502 without an active cooldown still receives the existing retry; a 502 while a concurrent provider cooldown is active now retains the cooldown header.
3. **FireGlow date boundary:** dawn and evening hour collection now filters to the requested local date before scoring, so a later date cannot enter the selected date's window.
4. **FireGlow source freshness:** snapshot transport now keeps a regenerated snapshot stale when its original source is older than the 30-minute freshness window.
5. **Map touch selection:** touch tracking now uses pointer identity and a document-level multi-touch generation, cancels the tap after multi-pointer/cancel/drag sequences, suppresses a synthesized click after cancellation, and continues to select on the next valid tap.

## Reproduction and verification

- Baseline red run: 4 focused files, 32 tests, 7 expected failures (25 passed), reproducing the five audited defects.
- Cross-marker expansion: the additional multi-touch case failed on the local-only pointer guard (1 failed / 5 passed), confirming that a second touch on another marker could still select the first.
- Final full Vitest: **99 files passed, 576 tests passed**.
- npm run lint: exit 0.
- npm run typecheck: exit 0.
- npm run build: exit 0; Next 16.3.8 compiled and generated all 11 static pages.
- git diff --check: clean.
- Focused and full-check output is retained under tmp/closeout-20261012-*.log; these logs are not included in the project-hub report.

## Delivered state

- Code commit: 737daed694c7bcfc4d36883456ff39a7d6623aa5 (fix: close weather and map data boundaries).
- Code commit tree: d467b6d3e0f0b22273693aba5c2253f945878777.
- Code commit parent: cd54bc4a02ae06503e45f6a3a88c04ba9cfeed10.
- The code commit was pushed to origin without force before the report commits. The two report commits remained local when a subsequent normal push could not connect to github.com port 443; no retry was attempted. The branch tracks origin/codex/data-boundaries-20261012 and is two documentation commits ahead.
- No pull request was created. No CI, browser E2E, device install, deployment, credential edit, or paid external service call was performed. Push and local tests are not final project acceptance.

## Reporting blocker

The owner-authorized project-hub template was generated as event 5db1f5e1-19f9-4ca5-8092-7e68153eca85 at expected revision 10. Sending it was rejected with invalid reported_status because the supplied in_progress value was not accepted. The pending JSON was preserved at E:\project\codex-project-hub\reports\star-photo-addr-5db1f5e1-19f9-4ca5-8092-7e68153eca85.json; no successful hub update is claimed, and the rejected event was not overwritten or retried.

A direct progress-message attempt to the source thread returned thread not found. This closeout is delivered with the completed delegated task.
