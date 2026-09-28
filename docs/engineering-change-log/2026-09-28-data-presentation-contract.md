# Mobile Browser v2 P3-A — Data presentation contract

Date: 2026-09-28
Remote plan: `c2c_8f4c` (`PLAN_READY`)
Package: `MOBILE-V2-P3A-DATA-PRESENTATION-CONTRACT`

## What changed

- Added `src/lib/dataPresentation.ts` with pure mappers for Provider Health,
  Selected Data Validity, and Recommendation Eligibility.
- Added compact L2 current-data and recommendation-gate cards to
  `DecisionSummary`.
- Kept provider probe status in `CloudControl`, with a scope sentence that
  prevents “upstream available” from being read as “current recommendation
  valid”. Optional unconfigured/not-installed sources remain neutral.
- Added unit and E2E contracts for ready, partial, stale, withheld, eligible,
  provider degraded, and HTTP 200 with incomplete scoring fields.

## Boundaries

The mappers consume existing facts only. No scoring, forecast-integrity,
provider/cache/snapshot/API/store request logic changed. `ForecastAvailability`,
`forecastTrustIssue`, `missingNightInputs`, `evaluateNight`, and snapshot
semantics remain authoritative. `missing != 0`, `stale != fresh`,
`partial != available`, and HTTP 200 != valid recommendation remain intact.

## Evidence

- `npm run test -- tests/unit/dataPresentation.test.ts`: 7 passed.
- P3A E2E: 4 passed, 4 project skips.
- P0/data refresh/workspace refresh E2E: 13 passed, 5 project skips.
- `npm run check`: PASS — ESLint, TypeScript, 65 Vitest files / 377 tests,
  Next production build.
- Full Chromium/cross-browser/device/CI/production: `NOT_RUN`.
