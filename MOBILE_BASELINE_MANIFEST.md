# Mobile Browser Architecture v2 Baseline

Status: `BASELINE_RECONCILED`

## Source identities

- Owner workspace: `E:\project\Star_photo_addr`
- Owner HEAD at planning time: `3334e0c08f9ab2e481277628ce4ee875e2f1039e`
- Selected isolated baseline: `origin/main@5a054fd31bda0f743bdc68345ebb3916d0199294`
- Owner is behind the selected baseline by 35 commits.
- Historical deployment references: `60c348b`, `ec5abdd`, `349db7b`; these are history evidence until their trees are reproduced in the selected baseline.
- Isolated worktree: `C:\Users\Admin\.codex\worktrees\mobile-browser-ia-v2\Star_photo_addr`
- Phase 1/2 commit: `52036ed32d123fd38498fe26a892196c8c2be1d1`
- Phase 3 commit: `e0a68df0c4eebcc7229d4539406fb31ee82e774c`
- Review/documentation commit: `1a0a746ba6c38770e615a1f4f052eb4af8b60334`

## Owner workspace protection

The Owner worktree remains dirty and was not reset, cleaned, stashed, or copied into this worktree.

### Modified files

- `src/app/api/fireglow/snapshot/route.ts` — `KEEP / NEEDS_REVIEW`: empty Fireglow snapshot protection.
- `src/app/cloudsea/CloudSeaApp.tsx` — `KEEP / NEEDS_REVIEW`: date label changes.
- `src/app/fireglow/FireglowApp.tsx` — `KEEP / NEEDS_REVIEW`: date labels and empty score guard.
- `src/app/mobile-map-controls.css` — `KEEP / NEEDS_REVIEW`: S3 drawer geometry and touch targets.
- `src/components/CandidateList.tsx` — `KEEP / NEEDS_REVIEW`: date labels.
- `src/components/ObservingMapControl.tsx` — `KEEP / NEEDS_REVIEW`: date labels.
- `src/components/RecommendationQuickControls.tsx` — `KEEP / NEEDS_REVIEW`: date labels.
- `src/lib/nighttime.ts` — `KEEP / NEEDS_REVIEW`: shared date semantics.
- `tests/e2e/mobile-panel-dock.spec.ts` — `KEEP / NEEDS_REVIEW`: S3 drawer regression.
- `tests/e2e/viewport-recommendations.spec.js` — `KEEP / NEEDS_REVIEW`: viewport regression updates.
- `tests/unit/nighttime.test.ts` — `KEEP / NEEDS_REVIEW`: date semantics tests.
- `tasks/todo.md`, `tasks/lessons.md` — `OWNER DOCUMENTATION`: preserve in Owner workspace; do not use as the isolated baseline.

### Untracked files

`docs/ui-audit/`, `docs/engineering-change-log/2026-09-19-fireglow-empty-snapshot.md`, the two 2026-09-18/19 plans, and Fireglow route/data-integrity tests remain Owner artifacts. They are not silently copied into this isolated baseline. Their claims require verification against the selected tree.

## Current baseline facts

- Node requirement is `>=24`; this worktree uses Node `v24.18.0`.
- The selected tree contains the recent map-first mobile work and existing mobile E2E helpers.
- The RED suite below deliberately checks the next architecture contract, not historical deployment claims.
- No provider, cache, snapshot schema, score threshold, `.env`, production volume, or deployment state is changed in Phase 0.

## Classification rule

`KEEP` means preserve for later comparison or selective application. `SUPERSEDED` means verify against the selected baseline before reusing. `UNRELATED` means do not bring into the mobile v2 worktree. No classification authorizes deleting or overwriting Owner files.

The baseline reconciliation is closed for this isolated tree. The old RED evidence is historical; it turned GREEN in `52036ed`. Short landscape, full cross-browser, real-device, and production gates remain separate.

