# MOBILE-V2 Phase 1/2 First Batch Report

Baseline: `origin/main@5a054fd31bda0f743bdc68345ebb3916d0199294`
Implementation worktree: `C:\Users\Admin\.codex\worktrees\mobile-browser-ia-v2\Star_photo_addr`

## Change

`src/app/mobile-map-first.css` now releases the viewport cage for portrait and normal tablet layouts (`max-width: 1199px`, `min-height: 521px`): the shell, workspace body/canvas, map stage, and Fireglow/CloudSea roots use document flow and visible overflow. The map keeps a bounded first-screen height; sheet bodies remain the intentional nested vertical scrollers. Short landscape remains deferred to a separate batch.

## Verification

- `npm run build` — `PASS`.
- `npx playwright test tests/e2e/mobile-v2-baseline.spec.ts --project=mobile --reporter=line` — `3 passed`.
- `npx playwright test tests/e2e/mobile-content-flow.spec.ts tests/e2e/mobile-map-first.spec.ts --project=mobile --reporter=line` — `19 passed`.

No provider, cache, snapshot schema, score, environment, volume, merge, or deployment change was made.

