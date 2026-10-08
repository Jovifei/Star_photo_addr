# Accessible names for candidate actions and workspace regions

## Evidence and bounded scope

The preceding candidate is `82d38d4708046203b7384ec032ca52e422da960c`, tree `d387c60b5df265d99660ee606fa4124fcc5181aa`, with ordered parents `8c53ded2c9d20620e955c952e63b8b52f8ea749d` and `48f5562648e5dde086b387fc4065f4679f927c57`. Its [CI 37248555047](https://github.com/Jovifei/Star_photo_addr/actions/runs/37248555047) completed all five jobs successfully: Chromium 244 passed / 122 applicability skips / zero failed, Firefox/WebKit 12 passed. All eight desktop/mobile axe and candidate-keyboard cases passed. That closes the former serious nested-interactive failure, not full accessibility compliance.

The [Chromium artifact](https://github.com/Jovifei/Star_photo_addr/actions/runs/37248555047/artifacts/11320432374) was downloaded and its SHA256 verified against GitHub: `1c7b3f55f3102062bac76f89d49dd2065e812083c5f38490cbab595a1f9f0379`. Six full axe JSON attachments retain lesser findings. Two directly actionable rules are scoped here:

- `empty-table-header` (minor): `.star-window-action-col` had no text for its candidate action column.
- `landmark-unique` (moderate): both sidebars were unnamed; the two hourly forecast scroll regions shared an identical generic label despite showing different contexts.

## Changes

- Add a visually hidden `候选操作` column heading with explicit `scope=col`.
- Name the input and evidence sidebars by purpose.
- Include existing matrix title and observing-night key in the scroll-region accessible name. Retain `tabIndex=0`, scroll behavior, table cells and keyboard time selection.
- Keep the full-document default axe scan and serious/critical gate; additionally fail these two scoped rules. No rule disablement, element exclusion or blanket downgrade.

No CSS, layout, score, source, cache, provider, version or dependency changes. Main landmark, heading hierarchy, other region findings and incomplete contrast/manual checks are not claimed fixed. Physical-device and scientific-data gates remain separate. This package is prepared independently of the frozen 82d38d4 deployment.

## Verification

- Original 82d38d4 component tree: all three new accessible-name regressions fail (RED).
- Repaired tree: all three focused component tests pass (GREEN).
- Final aggregate checks: lint, typecheck, 76 files / 437 tests and production build PASS. Independent read-only review found no blocker; its isolated focused run passed 3 files / 11 tests and diff-check.
- Browser/axe verification for this new package is pending its own exact published SHA; prior 82d38d4 CI does not validate these later edits.

## Transfer lesson from the preceding package

Large create-tree requests with inline content twice produced no result; after each coordinator interruption, a read-only lookup returned 404 for the expected tree. Interruption was not withdrawal of user authorization. Reusing known remote blobs and uploading only twelve actual changed blobs separately produced exact expected hashes; a SHA-only tree then preserved the reviewed tree identity. One explicit tree permission rejection was paused and retried once with verbatim user authorization, unchanged arguments; that retry succeeded. Commit and non-force original-branch publication preserved both parents. PR metadata remained denied after its permitted retry and was left unchanged, separately from successful code publication.

Never probe a write schema with placeholder content. Read tool metadata first. Never treat an uncertain write as success, blindly repeat it, or switch routes around a permission denial. Verify the exact remote tree, parents and branch, then wait for CI on the resulting published SHA. The connector-generated commit timestamp can differ from a local commit, so tree equality is essential and tests must be attributed accurately.
