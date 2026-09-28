# Mobile Browser v2 — Local Codex Handoff

## Remote review source

- Repository: `Jovifei/Star_photo_addr`
- Source branch: `codex/mobile-browser-ia-v2-20260927`
- Source HEAD: `1a0a746ba6c38770e615a1f4f052eb4af8b60334`
- Product implementation commit: `ac6b425c75fe0d6131fb1d8be23e51fef6999dbe`
- Remote branch: `codex/mobile-home-priority-v2-20260927`
- Remote reviewed tip: `3fa6446c1a9957e5b67958bec6224916694070ae` (resolve the branch tip again before receiving work)
- Base: `origin/main@5a054fd31bda0f743bdc68345ebb3916d0199294`
- Owner workspace: `E:\project\Star_photo_addr` (dirty; preserve it)

## Completed and reviewed

- `52036ed`: portrait/tablet document-scroll contract.
- `e0a68df`: reusable `AdaptiveSheet` and mobile map-tools migration.
- `1a0a746`: baseline/review documents.
- Mobile filter remained the open content-priority gap: it used the old absolute `.location-filter-controls` popup in the received branch.

## This handoff implementation — complete

`MOBILE-V2-P1-HOME-CONTENT-PRIORITY` moves mobile/tablet filter controls into `AdaptiveSheet` while keeping desktop inline controls. It preserves the search/location/filter 48px row, current store state, localStorage semantics, map selection, and all fail-closed data rules.

Files changed:

- `src/components/MapSearchCard.tsx`
- `src/app/mobile-map-first.css`
- `tests/e2e/mobile-content-flow.spec.ts`
- `tests/e2e/mobile-home-priority.spec.ts`

PR: not created because local `gh` is not authenticated. The implementation branch is pushed and ready for a draft PR.

## Acceptance

- Mobile 320/390/768/1024: filter sheet has `role=dialog`, `aria-modal=true`, focus restore, Escape/backdrop close, stable `scrollY`, and one internal vertical scroll body.
- Desktop 1200/1440: recommendation controls remain inline and no mobile filter dialog appears.
- `npm run typecheck`, `npm run lint`, `npm run build` pass.
- Focused mobile and desktop E2E pass.
- No changes to provider, cache, snapshot, score, `.env`, or fail-closed semantics.
- Verification: typecheck PASS, lint PASS, build PASS, mobile 11 passed, desktop inline 2 passed.

## Next remote review

LOCAL_CODEX_NEXT:

1. Fetch `origin` and resolve `origin/codex/mobile-home-priority-v2-20260927` again.
2. Do not modify, reset, clean, stash, or overwrite Owner dirty `main`.
3. Use a new isolated worktree from the resolved remote tip.
4. Rerun the focused tests and `npm run check`; run full Chromium/cross-browser only for merge review.
5. Keep physical-device validation manual and separate from Playwright.
6. Record execution output and send `EXECUTED` to remote ChatGPT for review.

Do not merge `main` or deploy from this handoff.

## Next cycle — P2-A home context hierarchy

Remote planning/review task: `c2c_9a7e`
Source branch: `codex/mobile-home-priority-v2-20260927`
Source head: `667f16746c4982624673ce7491b93ca977d3379c`
Implementation branch: `codex/mobile-home-context-v2-20260928`
Base tip: `667f16746c4982624673ce7491b93ca977d3379c`
Package: `MOBILE-V2-P2A-HOME-CONTEXT-HIERARCHY`

### Product result

`HomeContextStrip` is a read-only mobile context line rendered before the map.
It shows the selected night, existing forecast model, active forecast time, and
known update time. Unknown values stay explicit. The command row remains one
48px search/location/filter row, the map-first budget remains intact, and
desktop inline controls are unchanged.

### Files

- `src/components/HomeContextStrip.tsx`
- `src/components/PerseidsApp.tsx`
- `src/app/mobile-map-first.css`
- `tests/e2e/mobile-home-context.spec.ts`
- `tasks/plans/2026-09-27-mobile-browser-architecture-v2.md`
- `docs/engineering-change-log/2026-09-28-mobile-home-context-hierarchy.md`

### Evidence

- `npm run check`: PASS — lint, typecheck, 64 Vitest files / 370 tests, build.
- Focused E2E: mobile context 4 PASS; desktop context 2 PASS; map-first 16
  PASS; content-flow/home-priority 11 PASS; related desktop inline 4 PASS.
- `git diff --check`: PASS.
- Provider/cache/snapshot/score/fail-closed rules: unchanged.
- Full Chromium/cross-browser, real device, CI, and production: `NOT_RUN`.

### Remote review handoff

The final pushed tip must be resolved from
`origin/codex/mobile-home-context-v2-20260928` after push; this handoff does
not self-reference its own commit. Remote ChatGPT should independently read
the branch diff and the latest execution output, verify that the context strip
does not add command-bar height or data semantics, and return `DONE`,
`CHANGES_REQUIRED`, or `BLOCKED`.

PR: `NOT_CREATED — gh auth unavailable locally`
Merged: `NO`
Deployed: `NO`

### Protected rules

Do not alter `forecastIntegrity.ts`, scoring, provider/cache/snapshot/API code,
Fireglow/CloudSea data semantics, or the map-first gesture contract in this
package. Preserve `missing != 0`, `stale != fresh`, and `partial != available`.

## Next cycle — P2-B decision/provenance disclosure

Remote planning task: `c2c_5d1b`
Source branch: `codex/mobile-home-context-v2-20260928`
Source head: `2c551b485553bbe7bfc69dfbf896f23be3957b83`
Implementation branch: `codex/mobile-decision-summary-v2-20260928`
Base tip: `2c551b485553bbe7bfc69dfbf896f23be3957b83`
Package: `MOBILE-V2-P2B-DECISION-PROVENANCE`

### Product result

Keep the L2 decision and trust reason visible. Put long forecast-instance
metadata in one native `details` disclosure with keyboard-visible summary;
remove the duplicate `.observation-provenance` from `ObservationDetails`.
`ForecastAvailability` stays in place. Do not move provenance into an
`AdaptiveSheet`, change score/integrity semantics, or start P3.

### Files

- `src/components/workspace/DecisionSummary.tsx`
- `src/components/ObservationDetails.tsx`
- `src/components/PerseidsApp.tsx`
- `src/components/workspace/workspace-shell.css`
- `src/app/mobile-map-first.css`
- `tests/e2e/decision-summary-disclosure.spec.ts`
- `tests/e2e/forecast-integrity-p0.spec.ts`
- `tasks/plans/2026-09-27-mobile-browser-architecture-v2.md`
- `docs/engineering-change-log/2026-09-28-mobile-decision-summary-provenance.md`

### Evidence

- RED captured before implementation.
- `npm run check`: PASS — lint, typecheck, 64 Vitest files / 370 tests, build.
- P2-B focused mobile/desktop disclosure: PASS.
- P0 stale/integrity: 8 PASS; workspace/content regression: 23 PASS.
- `git diff --check`: PASS.
- Full Chromium/cross-browser/device/CI/production: `NOT_RUN`.

Remote review must resolve the pushed branch tip again after commit. Do not
merge or deploy.

### Review follow-up

Remote review identified a presentation-only UTC timestamp issue in
`HomeContextStrip`. The follow-up parses ISO timestamps and formats them with
the explicit `Asia/Shanghai` timezone; it does not change forecast data or
validity. The focused E2E now checks the displayed update time against the
timestamp conversion. Re-resolve the branch tip after the follow-up commit;
the prior implementation evidence remains valid.

