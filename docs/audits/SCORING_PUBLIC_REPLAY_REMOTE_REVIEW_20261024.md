# 2026-10-24 Remote independent score/source review and public GFS replay

## Identity, reviewed revision, scope

- Repository: `Jovifei/Star_photo_addr`; workspace name `Star_photo_addr`; workspaceId `19420f082390`.
- Exact initial base: `da159975f7a32f02fa2b9ed869e4ec729e2553a4`.
- Remote branch: `codex/scoring-review-20261024` (independent; Owner `main` and untracked `reports/` preserved).
- Read both `docs/HANDOFF_SCORING_FULL_STAGE_20261024.md` and `docs/audits/SCORING_SOURCE_HARDENING_20261024.md`, actual code, fixed public replay file and source manifest.
- Current **release verdict: CHANGES_REQUIRED**. The submitted baseline has no exact-head hosted CI, fresh isolated image preflight or HTTPS page acceptance. Previous local 106 Vitest files /649 tests, Chromium 287/131 skips and Firefox/WebKit 12, production audit zero are previous *local* evidence, not tests executed by this remote agent.
- Remote repository command executor: **unavailable**; tests below are `NOT_RUN` remotely. No merge, deploy or provider refresh was performed.

## Independent A: code-path findings, not just test claims

### Stargazing / astronomy

- `src/lib/absoluteForecastTime.ts` uses true UTC epoch when present, and the hour scorer `src/lib/hourScore.ts` computes Sun/Moon through `astronomyAt(Date(hourInstantMs(...)))`. Unknown site elevation remains unknown in UI but astronomy calculations may use a finite sea-level observer, never relabeling a measured height.
- `src/lib/forecastIntegrity.ts` requires cloud, wind, gust, precipitation, visibility, weather code, temperature/humidity/dew point. Missing `visibility` cannot become 0 or pass `scoreCoreWeather`. `forecastTrustIssue` withholds stale, wrong model, missing identity or over-age data.
- The Sun altitude limits in `hourScore.ts` cap ordinary daylight at 39 and intermediate twilight at 69; this is a conservative **product index** threshold, not a calibrated event probability. USNO astronomical/nautical twilight limits are −18°/−12° ([USNO definitions](https://aa.usno.navy.mil/faq/RST_defs)).
- `src/lib/scoring.ts` finds three strictly consecutive, unblocked hours, preserves whole-night weather hazards, does not allow twilight outside the chosen dark window to veto that dark window, and rejects malformed observer input. `candidateNightEvidence.ts` holds raw same-model weather alongside an explicit withheld evaluation and guards coordinate identity.
- No independently demonstrated new astronomy scoring defect in the reviewed code; real field hit rate is **NOT_CALIBRATED**.

### CloudSea

- `cloudLayers.ts` derives height in MSL and AGL separately using model DEM; `cloudsea.ts` checks all cloud decks for an enveloping layer and uses `pressureIntegrity.ts` for six distinct valid pressure levels. CloudSea condition scores are not event probabilities.
- `evaluateCloudSeaWindow` uses a target-hour denominator, strict majority of scoreable hours, published **window mean** separately from best known hour/peak, and keeps unknown vertical evidence `null` instead of synthesizing a cloud base/top. `cloudseaWindowSelection.ts` prefers published means and retains known peak evidence when none can publish.
- **Confirmed defect C1 (date contamination):** the initial `evaluateCloudSeaWindow(site, hourly, windowHours, pressure)` deduplicates hour-of-day across the entire input, without selecting the desired calendar date. A fixed 48-hour real provider run for `2026-10-22` incorrectly took `2026-10-21T08:00` (index 0, missing surface cloud/precipitation) instead of `2026-10-22T08:00` (index 24, complete). Thus a requested morning 05–08 window could be reported as 3/4 rather than 4/4; with only two scoreable hours it withholds the mean instead of publishing the independently traceable 8/100 index. This does not establish an observed cloud sea on that date.
- **Confirmed defect C2 (partial vs stale):** `buildCloudSeaSnapshot` emitted a null `sourceFetchedAt` record for every missing site and every missing pressure response. The common `snapshotSourceAgeMs()` takes the maximum over all emitted source entries; therefore a partial snapshot with a real, fresh surface source was treated as infinitely stale by the CloudSea route `snapshotJson()`. Absence belongs in coverage, not in an invented acquisition-time record.
- **Applied bounded correction:** optional `targetDate` gates all hourly selection; `buildCloudSeaSnapshot` passes its actual date to morning/evening windows. Provenance now emits entries only for a source actually received, but retains an invalid/null timestamp entry when a **present** source lacks valid acquisition time. If no sources exist, age remains infinite. Provider cache, model identity, source ages, weighting and pressure-profile mathematics are unchanged.

### Fireglow

- `fireglow.ts` selects morning/evening from actual solar position and derivative, not fixed Chinese clock windows; `parseShanghaiTime` accepts seconds and rejects illegal wall-clock values. `fireglowOverlay.ts` and `FIRE_GLOW_INDEX_BANDS` are index ranges, not probability bands.
- `src/app/api/fireglow/snapshot/route.ts` checks `scoreModelVersion` and `providerValidationVersion` before accepting persisted scored data, retains legacy files without treating their old score as current, and leaves zero-score empty snapshot uncacheable. No demonstrated new Fireglow implementation bug from this read.

### Open-Meteo source, units, caches and UI

- `providerWeatherIntegrity.ts` enforces explicit `hourly_units`, legal value bounds and matched hourly lengths. `forecast.ts`, Finder and pressure parser use UTC epoch where supplied; a local wall-clock must not be treated as UTC. `pressureIntegrity.ts` counts **distinct** legal pressure levels. A missing optional provider field cannot be silently renamed as another unit.
- `snapshotProvenance.ts` preserves original `sourceFetchedAt`, separate `providerRunAt` and `transport.servedAt`. `generatedAt` or filesystem mtime must not revive an old source. The review change does not touch these shared helpers.
- CloudSea source completeness is still explicitly tracked by `surface` and `pressure` summaries. A site with complete surface and absent pressure is `partial/degraded`, not automatically stale; unknown vertical relation is not a low score. Other valid same-model sites retain real evidence and scoreable values.
- Raw request and response status are **not** evidence of actual capture success, provider forecast accuracy, or prediction probability. The pressure model's `elevation` (194m in the fixture) differs from the public catalog summit 861m; they are different spatial concepts, not directly interchangeable.

## Independent B: immutable public provider run replay

- Source: Open-Meteo **Single Runs** GFS Seamless, `run=2026-10-21T00:00` UTC. Initialisation time is not availability/download time; no historical `sourceFetchedAt` is invented.
- Source manifest: `tests/fixtures/public-single-run-gfs-20261021-source.json`. Raw input: `tests/fixtures/public-single-run-gfs-20261021.json`, copied byte-for-byte from the existing untracked Owner report without altering Owner files. Expected SHA-256: `88208d4c95e68a02cade14fc6a4b63a895979c0ce1f49d6e4cdf4e42c54961b6`; byte count 13092.
- Exact requested public location: `cs-fuzhishan` 29.708,120.952, summit 861m. Provider returned grid 29.697365,120.9375, model elevation 194m; coordinates are deliberately not claimed identical.
- The payload uses `hourly_units.time=unixtime`, `wind_speed_10m=m/s`, pressure cloud/RH/temperature/geopotential heights. Full 48-hour axis begins at `2026-10-21T08:00` Shanghai and ends `2026-10-23T07:00`. Desired `2026-10-22 05–08` corresponds to input indices `21,22,23,24`.
- Independent inspection of actual provider arrays and unchanged formula: low-cloud `0,34,0,0`, index 22 has no continuous deck, other three hours are score 8 (`clear`); the **correct forecast window mean is 8/100 from 3 scoreable of 4 target hours**, surface 4/4, pressure 4/4. Without date filtering, index `0` (Oct 21 08:00) supplants index `24`; this input has missing surface cloud/precipitation at index 0, giving surface only 3/4 and scoreable only 2/4, hence null published mean. The independent arithmetic is a reasoning audit; the new Vitest contract needs to be run by local Codex.
- Test: `tests/integration/cloudseaPublicSingleRun.test.ts` checks the exact fixture hash, UTC-to-Shanghai epoch axis, correct date selection and score/coverage, plus a separate recent-time synthetic **partial provenance** case. It explicitly distinguishes archive forecast input from an observed cloud-sea event.
- Open-Meteo Single Runs official description: https://open-meteo.com/en/docs/single-runs-api . The source is a **fixed model run**, not a photographic field label, and its UTC initialisation time must not be misrepresented as public availability. Data attribution: Open-Meteo, CC BY 4.0, https://open-meteo.com/en/terms . Fixture is attributed and is not labelled as probability or ground truth.

## Cross-consumer and release gate

- Consumers of window score/evidence: CloudSea map overlay excludes null scores, ranking compares published window **mean**, detail and popup disclose mean/peak/coverage, mobile summary treats `unknown` and global partial separately. New date-scoped `buildCloudSeaSnapshot` feeds the same corrected results to all without changing their individual presentation contracts.
- The new test covers the parser/scorer path and partial-source metadata; local Codex must also run `cloudseaRoute`, `cloudseaCoverage`, `cloudseaWindowSelection`, CloudSea presentation/browser cases, `fireglowCacheVersion`, `nightAstronomySafety`, `providerWeatherIntegrity`, then `npm run check`.
- Remote tests: **NOT_RUN** (GitHub write connector has no Node/Playwright executor). Previous local baseline gates remain evidence for `da159975` only, not this branch.
- Hosted exact-HEAD CI, isolated Linux image preflight, HTTPS site with genuine weather source and Jovi's two field observations are separate **PENDING/BLOCKED** gates; do not merge or deploy from this audit.
- No reports were removed or overwritten. Data source access remains the official public GFS fixture; no new supplier requests or paid API services are required.

## Next long phase, bounded

1. Local Codex receives the exact remote head, verifies raw fixture checksum, runs focused tests, full `npm run check`, browser gates and `git diff --check`; returns original execution output. Repair any RED before acceptance. Cross-consumer gate must prove partial+fresh source stays eligible only where actual window facts permit scoring.
2. Remote independently reviews local results and exact SHA. Only after zero blockers consider merge; archive user original reporting safely; avoid overwriting raw/past reports.
3. Publish only with exact artifact SHA, CI success, image dependencies and rollback proof. On HTTPS verify /healthz identity and actual provider/model/raw age/degradation/score/mean/peak on three surfaces; browser success/HTTP200 is not data success.
4. For probability calibration, first collect actual timestamped location/photograph observations and original issued forecasts; group by site/weather event, season and lead time. Current score stays a condition index, not a probability, and no two user field reports are forged into a calibration dataset.
