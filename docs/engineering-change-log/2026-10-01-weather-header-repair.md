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
- Production build PASS (Next.js 16.3.4) on the locally merged release candidate. Header geometry E2E covers 28 viewport/route combinations; mobile map-first 12 PASS.
- Publication to main / deployment: PENDING.
- Public CloudSea page still reports Open-Meteo HTTP429 for 2026-09-30 and 2026-10-01; its existing ranked rows are not verified fresh. Public header remains v1.0.22 until deployment.
- Real production fresh forecast: BLOCKED by upstream daily quota. No fresh-weather recovery claim is made from local fixtures, HTTP 200, or service health.

## Deployment method
Use local Next standalone artifact with exact build revision, overlay the existing Linux runner image, preserve the snapshot volume and rollback image. Do not compile Next on the1.8GiB ECS while serving production (previous build caused OOM). After deployment verify public build identity, all four header geometries, provider/cache timestamps, stale semantics and429Retry-After separately.

Review fixes: pure forecast/pressure policy modules keep Node disk logic outside client bundles; shared raw requests have their own25s timeout; browser quota cooldown uses cache-only reads to retain server cached points; short desktop legacy topic header overrides removed.