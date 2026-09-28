# Mobile Browser v2 P2-A — Home context hierarchy

Date: 2026-09-28
Remote plan: `c2c_9a7e` (`PLAN_READY`)
Package: `MOBILE-V2-P2A-HOME-CONTEXT-HIERARCHY`

## Why

P1 moved advanced filters into `AdaptiveSheet`, which restored the map-first
budget but hid the identity of the forecast currently on screen. The mobile
home therefore needs a compact read-only context line without turning the
primary decision into a modal or expanding the command bar.

## What changed

- Added `src/components/HomeContextStrip.tsx`.
- Rendered it in the home canvas immediately before `MapStage`, so the 48px
  search/location/filter command row and its `<=112px` map-first budget stay
  unchanged.
- The strip presents the selected night, the existing forecast model, the
  active forecast time, and a known fetch time. Missing values remain explicit
  (`未选择`, `未知模型`, `更新时间未知`); no `0` or synthetic weather value is
  introduced.
- Added compact one-line, ellipsis-safe mobile CSS. Desktop hides the strip and
  keeps inline recommendation controls unchanged.
- Added `tests/e2e/mobile-home-context.spec.ts` for 320/390/768/1024 mobile
  viewports and 1200/1440 desktop behavior.

## Boundaries

This package does not modify provider requests, cache, snapshots, scoring,
forecast integrity, API routes, localStorage semantics, map gestures, or
Fireglow/CloudSea presentation. The existing rules remain:

`missing != 0`, `stale != fresh`, `partial != available`, and HTTP 200 does not
mean a valid recommendation.

## Evidence

- RED before implementation: the four mobile cases failed because
  `home-context-strip` was absent.
- `npm run check`: PASS — ESLint, TypeScript, 64 Vitest files / 370 tests, and
  Next production build.
- Focused E2E: mobile context 4 passed; desktop context 2 passed; map-first 16
  passed; content-flow/home-priority 11 passed; related desktop inline 4
  passed.
- `git diff --check`: PASS.
- Full Chromium/cross-browser, real device, CI, and production checks:
  `NOT_RUN` for this package.

## Review follow-up — UTC timestamp presentation

Remote review found that `fetchedAt` is emitted as a UTC ISO timestamp. The
follow-up now parses the timestamp and formats it explicitly in
`Asia/Shanghai`, instead of slicing the raw `T##:##` text. The E2E contract
also checks the rendered update time against the timestamp's Shanghai value.

- `npm run lint`: PASS
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `mobile-home-context` mobile/desktop: 6 passed (6 project skips)
- `git diff --check`: PASS
- Provider/cache/snapshot/score/fail-closed rules: unchanged
- Full Chromium/cross-browser, real device, CI, and production: `NOT_RUN`
