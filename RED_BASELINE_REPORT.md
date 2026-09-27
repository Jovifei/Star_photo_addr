# MOBILE-V2-P0 RED Baseline Report

Date: 2026-09-27
Baseline: `origin/main@5a054fd31bda0f743bdc68345ebb3916d0199294`
Worktree: `C:\Users\Admin\.codex\worktrees\mobile-browser-ia-v2\Star_photo_addr`

## Commands

- `npm ci` — `PASS` (Node `v24.18.0`, npm `11.16.0`)
- `npm run build` — `PASS` (Next.js `16.3.4`)
- `npx playwright test tests/e2e/mobile-v2-baseline.spec.ts --project=mobile --reporter=line` — expected `RED`

## RED evidence

All three architecture-contract tests failed before any product UI edit:

1. Home shell at `390×844`: `.workspace-shell` computed `overflow: hidden` instead of the required native document-scroll contract.
2. Fireglow topic at `390×844`: `.fireglow-root` computed `overflow: hidden` instead of a document-scroll contract.
3. Home shell at `768×1024`: tablet layout still computed `overflow: hidden`.

The failures identify the current viewport cage directly. They are not provider failures and do not change weather, snapshot, score, or deployment state.

## Phase 0 decision

`BASELINE_RECONCILED` is not yet claimed. The isolated tree and exact SHA are known, Owner changes are preserved, and the RED suite is recorded. The next implementation phase may address the shell/document-scroll contract only after this report is reviewed against the preserved Owner changes.

