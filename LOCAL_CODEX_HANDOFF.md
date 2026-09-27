# Mobile Browser v2 — Local Codex Handoff

## Remote review source

- Repository: `Jovifei/Star_photo_addr`
- Source branch: `codex/mobile-browser-ia-v2-20260927`
- Source HEAD: `1a0a746ba6c38770e615a1f4f052eb4af8b60334`
- Implementation branch: `codex/mobile-home-priority-v2-20260927`
- Final local HEAD: `ac6b425c75fe0d6131fb1d8be23e51fef6999dbe`
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

After local execution, record commands and outputs with C2C, send `EXECUTED`, and ask remote ChatGPT to inspect branch `codex/mobile-home-priority-v2-20260927` at `ac6b425`. Do not merge `main` or deploy from this handoff.

