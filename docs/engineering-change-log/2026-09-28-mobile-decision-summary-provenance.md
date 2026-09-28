# Mobile Browser v2 P2-B — DecisionSummary provenance disclosure

Date: 2026-09-28
Remote plan: `c2c_5d1b` (`PLAN_READY`)
Package: `MOBILE-V2-P2B-DECISION-PROVENANCE`

## Scope

Keep the L2 decision and trust reason in the default reading path. Move only
long forecast-instance metadata into one native details disclosure. Remove the
duplicate weather provenance paragraph from `ObservationDetails` so a mobile
data sheet does not show two competing sources of truth.

## Protected boundaries

The package does not change scoring, forecast integrity, provider/cache/snapshot
code, API routes, store data state, Fireglow/CloudSea semantics, or the
`ForecastAvailability` component. `stale`, model mismatch, and invalid-data
reasons remain visible in the trust summary. The rules remain:

`missing != 0`, `stale != fresh`, `partial != available`, and HTTP 200 does not
mean a valid recommendation.

## Evidence

- RED: `decision-summary-disclosure.spec.ts` failed because the disclosure and
  trust summary did not exist and duplicate provenance was still rendered.
- `npm run check`: PASS — ESLint, TypeScript, 64 Vitest files / 370 tests, and
  Next production build.
- P2-B focused E2E: mobile and desktop disclosure tests PASS.
- P0 stale/forecast integrity E2E: 8 passed, 2 project skips; stale reason
  remains visible and the 94 score stays withheld.
- Workspace/content regression: 23 passed, 19 project skips.
- Full Chromium/cross-browser/device/CI/production: `NOT_RUN`.
