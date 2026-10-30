# CloudSea pressure provider quality and legacy cache gates

## Problem

Retained real GFS025 captures contain 293 out-of-range pressure values (all
`101`) across 19 CloudSea sites, concentrated in 725/775 hPa cloud cover and
relative humidity. The previous parser rejected the whole site for the entire
day, and a malformed numeric series could be silently excluded. Separately, a
legacy window without `pressureStatus` could be misread as pressure evidence
because `undefined !== "unavailable"` is true in JavaScript.

## Change

- `src/lib/pressureProviderIntegrity.ts` adds a pressure-only classifier.
  Unit, time-axis, array-length, finite-number, and grid-identity faults stay
  fatal. A finite out-of-range value is recorded as
  `{ field, rawValue, reason: "out-of-range" }` on the affected site, epoch,
  and pressure level, with the affected field set to `null`. Values are never
  clamped, reinterpreted, or crossed as unknown layers.
- The parse entry is the only producer of quality evidence. It stamps
  `qualitySchema`, `qualityValidatorVersion`, and `qualityValidatedAt` only
  after all strict validation succeeds. Consumers fail closed when any marker
  is missing, mismatched, or unparsable; a timestamp alone is not provenance.
- `pressureIntegrity` rejects any sample with a provider issue; a polluted hour
  fails closed before the low-cloud clear shortcut and cannot form decks,
  cloud-top bounds, or inversion evidence across the unknown level. Clean hours
  at the same site remain scoreable, and `expectedHours` keeps the original
  window denominator.
- `CloudSeaPressureSummary` distinguishes `receivedSites`, `partialSites`, and
  complete `availableSites`. `buildCloudSeaSnapshot` stamps a snapshot-level
  quality marker only when every received response carries full provenance.
  The snapshot route caches only snapshots with the marker, integer received/
  partial counts, and complete coverage; partial data is neither available nor
  stale and cannot enter the complete fresh cache.
- `presentCloudSeaSnapshot` derives legacy coverage counts only from windows
  with an explicit `available`/`partial` status and positive `pressureHours`;
  presentation never fabricates provenance or erases a fail-closed reason.
- The shared surface/Fireglow/Finder validator is unchanged; default model,
  score thresholds, six-level minimum, 750 m gap rule, and 150 m margins are
  unchanged.

## Verification

- Failing-first regressions: out-of-range values previously scored 91 via the
  low-cloud shortcut, a schema without provenance or a forged validator version
  scored, a complete-looking legacy snapshot without the quality marker was
  cached as fresh, a `pressureStatus`-less window counted as received evidence,
  and legacy in-cloud wording repair erased a withheld reason. All are RED
  before the fix and GREEN after.
- Full local gates on the final combined tree: `npm run check` (lint,
  TypeScript, 115 test files / 743 tests, production build), complete Chromium
  and Firefox/WebKit suites re-run after the last fix; results recorded in the
  release receipt for this candidate.
- Intermittent-risk records kept: one Finder test timed out once under full
  load (passed in isolation and on rerun, timeout not extended), and the first
  CI run of PR #60 had one mobile navigation width failure that also
  reproduced on the old baseline (second run passed; assertion unchanged).

## Limits

- ICON Global still cannot provide visibility in China; the unmodified
  data-source gate may keep failing until Jovi decides the default scoring
  model. No cross-model field filling.
- The condition index remains an uncalibrated engineering indicator, not an
  observed event probability. Real-world hit-rate validation is separate.
