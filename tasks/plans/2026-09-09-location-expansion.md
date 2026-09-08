# 2026-09-09 curated photo-location expansion

## Goal

Add a small, source-backed set of popular photography destinations so the
homepage shortlist, Fireglow/star catalog, and CloudSea workspace offer more
useful choices. Release as `v1.0.7` with catalog provenance and regression
coverage.

## Scope and prohibitions

- Base: `main@5900bd8f01a17dddf52dafe1a22d4d382ae02b81`.
- Branch: `codex/location-expansion-20260909`.
- General catalog additions: Dongshan Island, Xiapu Dongbi, Weizhou Island,
  Dongfushan Island, Four Girls Mountain Maobi Liang, Yuanyang Bada, Jingmai
  Mountain Wengji, Emei Golden Summit, Shennong Peak, and Balang Mountain.
- CloudSea additions: Mao'er Mountain, Tianyou Peak, Shennong Peak, Balang
  Mountain, Yunhe Terraces, Jinfoshan, Wawushan, Subaoding, Jiuhuashan
  Tiantai Peak, and Yuanyang Bada.
- Expand the default homepage shortlist from four to a curated set of popular
  locations; preserve user LocalStorage candidates and all existing scoring.
- Bortle values remain reference metadata only. Coordinates/elevations are
  viewpoint approximations where an official source gives a range; the UI must
  not call them field measurements.
- Do not change scoring weights, pressure algorithms/thresholds, data-source
  contracts, map/navigation structure, Phase 2 sampling, or Planner/Finder
  architecture.

## Evidence and implementation sequence

1. **RED/data contracts** — add tests for new IDs, coordinate/elevation
   validity, expected catalog counts, CloudSea schema, and the dynamic E2E mock
   count before editing data. Expected status: tests fail only because the
   new records/counts are absent.
2. **Catalog data** — append records with unique IDs and non-zero elevations to
   `src/data/observingSites/catalog.json`; add CloudSea records to
   `src/lib/cloudseaSites.ts`; update E2E mocks and hard-coded count assertions
   to derive or reflect the new total. Expected status: focused tests pass and
   no duplicate coordinates/IDs are introduced.
3. **Homepage shortlist** — update `DEFAULT_CANDIDATE_SEEDS` and reset copy in
   `src/lib/constants.ts` / `src/components/CandidateList.tsx` to expose the
   curated choices without overwriting user candidates.
4. **Release metadata/docs** — run `npm version 1.0.7 --no-git-tag-version`,
   update root and docs changelogs plus an engineering record with source URLs,
   caveats, and rollback target. Keep historical counts in historical notes.
5. **Verification** — run `npm ci`, `npm run lint`, `npm run typecheck`,
   `npm run test`, `npm run build`, `npm run test:live`, `npm run check`, and
   local Chromium E2E. Inspect changed counts and data payload shape.
6. **Publish boundary** — use focused `codex:` commits, push the branch, open
   a PR, and wait for all required CI jobs before any merge/deploy decision.

## Rollback and stop conditions

- Rollback target: `5900bd8f01a17dddf52dafe1a22d4d382ae02b81`.
- Stop if a source cannot support a destination, a coordinate/elevation is
  uncertain enough to mislead the pressure model, a provider request contract
  changes, or any existing local/CI gate fails.
- Do not claim production release until the merged SHA, health version,
  catalog counts, and four-page production checks are freshly verified.
