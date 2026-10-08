# Shared forecast-time boundary and settled text measurement

## Exact failing evidence

Readability candidate `e06c0915fa736ad4b6e8b2c8bae87a403404e469` has the approved local candidate's tree `a99e8a20327d3e8d7ff740d48637c14343b1b62f`. [CI 37265305020](https://github.com/Jovifei/Star_photo_addr/actions/runs/37265305020) failed overall: Chromium 255 passed / 124 applicability skips / 5 failed; quality, live-data, container and Firefox/WebKit passed. All five failures were in the newly added control-readability tests. The existing four resize screenshots were actually viewed: complete candidate names, full desktop time, wrapped map-error copy and the contained mobile layers label improved, but these observations do not make the failing candidate ready to release.

The Chromium artifact SHA-256 is `6e10797dde63f2ce319a1d7b31641f24b4b3ba5a93f1bd02aa90408524a3a9`.

Two independent causes were established from the recorded trace and source:

- Four 200% cases wrote the requested font size and read computed size in the same JavaScript task. Each recorded 178 samples still at ratio 1. The after-snapshot contained the correct important inline size, while the loaded CSS had font-size transitions through `transition: all` (150–160 ms). The next-frame wait was after the assertion and never ran. This was an invalid measurement of the transition's starting state.
- The first desktop forecast tick was visible, enabled and successfully clicked. The trace requested `2026-10-05T00:00`, then approximately 95 ms later requested `2026-10-05T12:00`. The point forecast contained the 00:00 hour with stale=false. The rail took the first 73 source hours, starting at midnight; the score slider admitted its separate current-hour window or the selected observation night. The latter reset the explicitly offered selection. This is an actual shared-state conflict, not a click failure.

## Narrow repair

The store now owns one stable forward-window start. The compact rail, top score slider and lazily mounted observing settings all use that same 72-hour boundary. It is initialized with the existing China-time clock and updated only by the existing initial-clock correction; ordinary selection does not move it. A clock correction retains any already changed location-night/hour selection.

The rail includes only actual source hours in that forward window and retains its first and last available boundary probes, including daytime endpoints between six-hour marks. Missing source hours are not invented. The score slider can still select a missing hour inside its time domain; current labels and missing-data state remain on that hour instead of silently switching to another value.

Observation-night selection remains separate. A valid historical or later night matrix selection is preserved outside the compact rail. The current time and `data-active-time` report the real selected hour. Both score controls explicitly label an outside-window observation-night choice, while their range thumbs and aria-valuetext continue to describe the actual forward slider value. The observing settings request and identify the real selected hour rather than the thumb fallback. An explicit matrix click carries the night that the matrix is currently displaying.

Independent review exposed two related boundary failures, both reproduced before correction: selecting 05:00 in a later displayed matrix reset to the start hour, and selecting a missing 13:00 hour could borrow the 20:00 cloud value for the current-hour summary. The matrix click now carries its displayed night; the unrelated summary-hour fallback is removed. No forecast calculation, scoring rule, provider request implementation or map behavior is changed.

The text test now restores original sizes, waits for actual font-size transitions to finish, reads its baseline, applies the requested multiplier, waits again, and reads settled sizes. It records requested, immediate and settled values plus transition outcomes before the strict multiplier assertions. It does not disable animation, exclude controls, lower the multiplier or add a fixed-duration sleep.

## Verification and remaining gates

The new component integration uses the real timeline and score-control components with reactive test state, plus the real store for initial-clock cases. The initial source reproduced the midnight-to-noon selection conflict. Additional review cases reproduced the matrix reset and wrong-hour summary. The repaired suite covers 15 cases including first/last boundaries, all three browser-process timezones, midnight, historical and later observation nights, missing source hours, honest slider labels, initial-clock correction, stable window ownership, late settings mounting and historical-hour provenance in settings.

Local lint, TypeScript, 80 files / 456 tests and production build pass. Independent review also passed the 15 new integration cases and the existing timeline/nighttime/store checks. The four explicit failing-before assertions above have corresponding passing-after results. A separate old-settings isolation probe timed out without an assertion result and is not counted as a demonstrated RED.

Local aggregate and exact-commit CI results must be distinguished. Browser execution remains unavailable in the cloud shell; local component checks are not a substitute for Chromium screenshots. The final candidate must pass its own full CI and have the new 100%/200% images inspected. Physical-device settings, actual browser zoom and unrelated moderate/incomplete accessibility findings remain separate gates. No production deployment is claimed.
