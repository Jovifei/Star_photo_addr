# 2026-10-01 Weather request economy and equal product headers

## Problem and verified cause
Production main d21165e returned forecast HTTP502 with upstream Open-Meteo daily HTTP429. Its provider cooldown was 30 seconds (120-second maximum); generic errors lost Retry-After. Old point forecast disk entries exceeded the six-hour retention and correctly could not become fresh data. Nationwide Finder requests were independently repeated across date/phase routes and process restarts. Official free-tier quota reference: https://open-meteo.com/en/pricing .

Desktop screenshots and Playwright measurement showed topic headers at189px while home/sites were65px at1920x1080. The right control slot wrapped multiple segmented groups and expanded the header.

## Implementation
- ProductHeader owns desktop65px, title17px, navigation13px and equal tab widths. Topic date/phase settings expand as a dismissible panel; current values remain visible. Existing mobile48px strip and four equal48px navigation targets are retained.
- Typed provider429, long Retry-After and category propagate to browser and snapshot routes. Daily cooldown is persisted with no credentials; absent supplier reset uses a conservative24-hour window, not a claimed reset time. Manual refresh does not bypass supplier cooldown.
- Finder exact model/coordinate/variable/range raw forecasts persist and coalesce for3h; canonical coverage permits cross-date reuse. Original sourceFetchedAt survives reuse. Invalid/failed responses never replace valid raw data. Six-hour retention remains a separate upper validity bound.
- Worker defaults to3h, respects Retry-After, and does not prewarm through quota cooldown. Docker context excludes old .deploy archives.

## Evidence and remaining boundary
- lint/typecheck PASS;66 test files391tests PASS at local gate (additional focused cache tests follow).
- Development route geometry:28 combinations across1920/1440/1200/960/390/320 and1440x500 widths PASS; Escape and outside-pointer dismissal PASS.
- Production build / built CSS geometry / publication / deployment: PENDING at this document version.
- Real production fresh forecast: BLOCKED by upstream daily quota at predeployment check. No fresh-weather recovery claim is made from local fixtures or service health.

## Deployment method
Use local Next standalone artifact with exact build revision, overlay the existing Linux runner image, preserve the snapshot volume and rollback image. Do not compile Next on the1.8GiB ECS while serving production (previous build caused OOM). After deployment verify public build identity, all four header geometries, provider/cache timestamps, stale semantics and429Retry-After separately.

Review fixes: pure forecast/pressure policy modules keep Node disk logic outside client bundles; shared raw requests have their own25s timeout; browser quota cooldown uses cache-only reads to retain server cached points; short desktop legacy topic header overrides removed.

## Remote exact-SHA review follow-up

Remote review of emergency product/test head `3d57fa494b8609c11df63f531154aac9ff98eb45` found two bounded route-semantics gaps after the local gates:

1. `/api/stargazing-finder/weather` did not propagate an active provider daily cooldown when all Finder records were unusable, so the direct Finder route could return a generic/error-shaped response without the long provider `Retry-After`.
2. `/api/forecast?cache_only=1` marked every persistent disk hit stale after a process restart, even when the original provider timestamp was still inside the fresh TTL. Local refresh cooldowns could also overwrite a longer provider cooldown header.

Remote repair branch: `codex/weather-route-semantics-followup-20261001`.
Remote implementation/test-source head before handoff docs: `c61bc8da52345a211fe1a8643578bffe69a4642c`.

The follow-up keeps scoring and pressure/cloud-sea algorithms untouched. It:
- merges local refresh and provider cooldown headers using the longer `Retry-After`;
- makes direct Finder weather return provider `429` when no usable hourly data exists under an active provider cooldown, while usable stale Finder data stays `200 + X-Data-Stale:true` with provider cooldown metadata;
- keeps a persistent forecast disk hit fresh when its original timestamp is still inside `FORECAST_CACHE_TTL_MS`, and marks it stale only after that fresh bound;
- adds focused route/unit regression sources for these contracts.

Remote execution capability does not include the repository test runner. Therefore all tests for the remote follow-up are `NOT_RUN` remotely and must be executed by local Codex before integration. The already-recorded local emergency evidence at `3d57fa4` remains separate: 66 Vitest files / 391 tests PASS, lint/typecheck/build PASS, built header geometry 28 combinations PASS, mobile map-first 12/12 PASS. No deployment or fresh-provider recovery claim is made here.
