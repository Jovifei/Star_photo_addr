# Mobile Browser v2: Home Filter Sheet

Status: `CANDIDATE_PUSHED_PENDING_REMOTE_REVIEW`

## Scope

Mobile and tablet advanced recommendation filters now open in the shared `AdaptiveSheet`. Search, location, and filter controls stay in one 48px row. Desktop widths keep `RecommendationQuickControls` inline.

The sheet owns backdrop, scroll lock, focus trap/restore, Escape, safe-area padding, and reduced-motion behavior through the existing primitive. Recommendation state, sliders, B1–B4 controls, localStorage behavior, map selection, and fail-closed data rules are unchanged.

## Evidence

- Branch: `codex/mobile-home-priority-v2-20260927`
- HEAD: `ac6b425c75fe0d6131fb1d8be23e51fef6999dbe`
- Base: `codex/mobile-browser-ia-v2-20260927@1a0a746`
- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm run build`: PASS
- Mobile focused suite: 11 passed
- Desktop inline controls: 2 passed
- PR: not created locally because `gh auth login` is required; branch is pushed.

## Boundaries

No provider, cache, snapshot, score, `.env`, deployment, or production changes. Full E2E, cross-browser, real-device, CI, merge, and deployment remain pending remote review.

