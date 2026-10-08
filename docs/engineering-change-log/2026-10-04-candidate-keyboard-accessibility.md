# Candidate controls: independent keyboard actions

## Latest baseline and actual failure

On 2026-10-04 the remote main was `48f5562648e5dde086b387fc4065f4679f927c57`. It includes v1.0.27 recovery and hashed persistent batch caches plus the production acceptance receipt. PR50/51 are historical merged changes, not the continuation branch.

The existing PR49 branch was `8c53ded2c9d20620e955c952e63b8b52f8ea749d`. Its source-time formatter and automated accessibility gate are not in main. Its shadcn development classification is already equivalent in main, so integration retains main's `^4.16.2`, version 1.0.27 and all pre-existing lock package records; only the original axe development package is added. The latest main is integrated into the same branch without rewriting either history.

The prior [CI 37141820492](https://github.com/Jovifei/Star_photo_addr/actions/runs/37141820492) was **FAIL**, not pending or green: quality, live-data, container and cross-browser passed; Chromium had 235 passed, 122 applicability skips and five failed accessibility scans. All five reported serious `nested-interactive` on candidate cards. The card had `role=button` around remove and date buttons. Its parent keydown handler also intercepted Enter/Space from those children and selected the candidate instead of allowing their native action.

## Repair

- Keep each card as a named non-interactive group and preserve pointer selection on its background.
- Give candidate identity a native selection button, independent of removal and the seven date controls. Retain the layout and add a visible keyboard focus outline.
- Remove the parent keyboard handler; use native button keyboard behavior, with existing click propagation guards.
- Preserve scores, provider requests, timezone fix, cooldown recovery, SHA256 disk cache, version and all data-integrity gates.
- Preserve full-document default axe scanning, including serious/critical failures and complete result attachments. No rules are disabled or elements excluded.

## Verification

The integration-only tree passed lint, typecheck, 74 files / 430 tests and production build before this repair. The repaired component has four focused tests for native semantics, independent Enter/Space date/removal actions, and background pointer selection. A real keyboard desktop/mobile E2E is added alongside the existing axe scans.

Current cloud browser execution is blocked before app execution: installed Chromium fails local IPC `socket()` with `Operation not permitted`. The official Playwright browser download returned an invalid/truncated archive. No security setting or sandbox was changed. Browser and visual acceptance must come from the exact published candidate's CI or a supported independent executor, never from test discovery. Final repaired-tree aggregate checks passed: lint, typecheck, 75 files / 434 tests, production build; production dependency audit reports zero vulnerabilities. The isolated old-main component reproduces three failures (including actual Enter/Space parent selection) and one pass; repaired component passes all four. Exact-SHA CI and browser receipts remain pending publication.

No main push, PR merge, production deployment, cache deletion, credential or data-source configuration changes are part of this batch. Historical production receipts remain historical; no new production acceptance is claimed. `PENDING_REMOTE_PLANNING` and manual/scientific/physical-device gates remain open.
