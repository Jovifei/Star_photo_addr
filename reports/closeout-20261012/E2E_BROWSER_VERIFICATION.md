# Browser verification — 2026-10-12

## Fixed code revision

- Project: `Jovifei/Star_photo_addr`
- Branch: `codex/data-boundaries-20261012`
- Browser-tested code commit: `875eda6a4a9c7aeb9d8b8900c087edf881506c04`
- Parent: `b8050a06e1a0194cf7c9cb73b1d4f39cfcd3122d`
- Main remained at the recorded baseline: `cd54bc4a02ae06503e45f6a3a88c04ba9cfeed10`.

## Browser coverage

The new `tests/e2e/map-gesture-browser.spec.ts` suite was run in the repository's local Playwright production-server configuration. It used the already-installed Chrome executable, desktop Chromium for the FireGlow UI check, and Pixel 7 mobile emulation for touch input. No browser was installed.

Provider responses were fixtures: the Open-Meteo and geocoding helpers plus explicit synthetic FireGlow snapshots handled app APIs; tile images returned a one-pixel PNG; other HTTPS requests were aborted. No live weather/provider response or paid service was used.

Results: **3 passed, 3 skipped by project guard, 0 failed**. The three executed cases verified:

1. **MapCanvas:** a touch drag moved the map without selecting; a two-finger pinch zoomed without selecting; Chrome delivered `pointercancel` without selecting; and the next valid tap created the selected-sample marker.
2. **BlankMapPicker:** the same drag, pinch, cancel and recovery sequence worked; the recovered tap rendered the picked marker and coordinate summary; tapping the picked marker did not change the summary.
3. **FireGlow dawn date:** the morning phase showed the requested calendar day, then the three-day view showed the expected date labels and synthetic scores (`84`, `65`, `42`) with the selected site's `06:12` peak time.

The touch run found that Leaflet did not copy the pick marker's `pathOptions.className` to its SVG path. `BlankMapPicker` now applies `topic-pick-marker` through the Leaflet layer ref, matching the existing `MapCanvas` marker pattern. This makes the existing blank-tap exclusion effective for the selected marker.

## Other checks

- `npm run build`: passed on Next.js 16.3.8; compilation, TypeScript, and all 11 static pages completed.
- `npm run lint`: passed.
- `npm test`: **100 test files passed, 582 tests passed**.
- `git diff --cached --check`: clean before the code commit.
- The screenshot below is from the synthetic desktop FireGlow run. SHA-256: `9ed0ca59896b23f0c0db5b6ebc5069694c9227799ddb44784bc49d8a6af07a19`.

## Remote and CI status

The repository's `.github/workflows/ci.yml` runs on pushes to `main` and pull requests to `main` (and the named overnight forecast branch), as well as manual and scheduled triggers. A pull request to `main` would run `live-data-smoke` (`npm run test:live`) against live providers, contrary to this task's no-live-weather constraint. No pull request or CI run was started.

`gh auth status` confirmed that this environment is not logged into GitHub, so I could not inspect whether this branch already has a PR. I left the remote untouched: pushing could update an unknown existing PR and trigger its live-provider smoke job. The code is committed on the authorized repair branch, and the reviewable single-commit patch is saved alongside this report. No force push, merge, deployment, device install, or credential change occurred.

## Artifacts

- Source/test patch: `reports/closeout-20261012/e2e-browser-verification.patch`
- FireGlow screenshot: `reports/closeout-20261012/fireglow-dawn-calendar-day.png`
- Browser test source: `tests/e2e/map-gesture-browser.spec.ts`
