# Consistent source-update timestamps

## Observed production issue

A bounded, read-only cloud-browser inspection of the deployed public homepage on 2026-10-03 found contradictory update labels for the same selected location. The original source timestamp was `2026-10-03T05:15:00.573Z`: the context strip and decision summary showed `13:15`, while the forecast-availability line showed `22:15` in the browser's local timezone.

The visible application version was v1.0.26. The browser could not open `/healthz` (`net::ERR_BLOCKED_BY_CLIENT`), so this inspection does not independently reverify the exact runtime SHA from the existing deployment receipt. The `src` tree in that receipt's `4527f4d` and the dependency-only candidate `30fbead` is identical. This pre-existing display bug was not introduced by the dependency classification change.

## Minimal correction

- Share `formatSourceUpdateTime` across `HomeContextStrip`, `ForecastAvailability` and `decisionSummary`.
- Display source-update labels in `Asia/Shanghai`, matching the workspace's forecast and observing-night labels. Explicit `hourCycle: h23` keeps midnight at `00:mm`.
- Preserve each caller's existing absent/invalid timestamp copy. The availability success and stale/error paths use the same formatter.
- Leave raw ISO timestamps, source evidence attributes, weather requests, scoring, cache rules and UI layout unchanged.
- Keep this unreleased change separate from dependency-inventory commit `30fbead`, on the same existing work branch and draft PR #49. PR #49 now contains both the dependency boundary correction and this timestamp display fix; earlier dependency-only scope statements apply only to `30fbead`.

## Verification

- Browser RED before the fix: Firefox with timezone `UTC` showed availability `数据更新 05:15` instead of `数据更新 13:15`, after context-strip and summary assertions had passed.
- Seven unit cases cover UTC/Los Angeles/Shanghai environments, UTC and explicit-offset inputs, midnight, and null/undefined/empty/invalid timestamps.
- Three timezone contexts were added to the existing cross-browser smoke file, so both the full Chromium matrix and Firefox/WebKit CI execute them. The browser clock, source timestamp and fixture hourly axis are fixed together. Assertions cover all three labels plus unchanged raw ISO source evidence.
- `STAR_BUILD_CPUS=2 NEXT_TELEMETRY_DISABLED=1 npm run check`: PASS, lint, TypeScript, 74 files / 428 tests and production build.
- Rebuilt local Firefox: PASS, all six smoke cases including UTC, America/Los_Angeles and Asia/Shanghai timestamp scenarios. The original regression is GREEN in all three contexts; raw UTC evidence remains unchanged.
- Independent read-only final review: PASS; checked final source/test diff, aggregate results and all six Firefox terminal results.
- Exact-commit GitHub full CI for this follow-up: PENDING. The earlier [run 37098113035](https://github.com/Jovifei/Star_photo_addr/actions/runs/37098113035) passed all five jobs for dependency-only `30fbead` (73 files/421 tests, Chromium228 passed/122 applicability skips, Firefox/WebKit6 passed); those results do not validate this new source change.

## Public-page inspection boundaries

At the available 1180×757 viewport, all four product entry points rendered without horizontal overflow. ICON missing visibility correctly withheld the selected-location score. Fireglow showed a modeled condition index for a ranked point; Cloudsea showed a modeled score and cloud-layer relationship; Darksky preserved context and labeled annual night-light reference/unknown dark-sky data truthfully. These checks do not establish physical-phone responsiveness, current freshness of every provider/point, scientific forecast accuracy, or the previous-night boundary after midnight.

No login, geolocation grant, forced refresh, cache clear, merge, production deployment or main synchronization occurred. Existing production overnight visual acceptance and PENDING_REMOTE_PLANNING remain separate gates.
