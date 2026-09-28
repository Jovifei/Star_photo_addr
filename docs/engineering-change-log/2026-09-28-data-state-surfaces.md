# Mobile Browser v2 P3-B — Data state surface alignment

Date: 2026-09-28
Remote plan: `c2c_b3e8` (`PLAN_READY`)
Package: `MOBILE-V2-P3B-STATE-SURFACE-ALIGNMENT`

## Scope

Reuse P3-A presentation vocabulary without sharing fact computation. The
timeline owns hourly field completeness; the observing map owns snapshot
request/stale/publishable-count facts. Provider Health remains in CloudControl.

## Boundaries

No changes to scoring, snapshot integrity, `missingNightInputs`,
`observationSnapshotIssue`, provider probes, cache, API, store request logic,
CloudTimeline hourly facts, or ObservingMapControl snapshot facts. Raw
`data-score-status` remains for compatibility. Unknown scores remain unknown,
not zero or low scores.

## Evidence

- Unit: 15 passed (`dataPresentation` + `timelineTrack`).
- P3-B surfaces pass individually: hourly ready/partial and fresh all-unknown
  snapshot withheld; P3A data-state tests remain green.
- P0/data refresh/workspace refresh: 13 passed.
- `npm run check`: PASS — 65 Vitest files / 377 tests, build.
- Full Chromium/cross-browser/device/CI/production: `NOT_RUN`.

## Review follow-up — remove legacy hourly presentation helper

Remote review identified a remaining second vocabulary in the unused exported
`forecastQualityLabel`. It is now removed; timeline presentation cases live in
`dataPresentation.test.ts`, while `timelineTrack.test.ts` retains only track
geometry/night grouping coverage. No hourly fact calculation changed.

The follow-up also updated the existing product-integrity assertion to the
`map-recommendation-eligibility` contract while retaining the raw
`data-score-status` and unknown-point wording.
