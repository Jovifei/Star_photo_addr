# Keep complete control text readable at 100% and 200%

## Evidence and scope

The tooltip candidate `4ddd8d0dfd5166ba762f84d418279108c8d9f63f` passed [CI 37260937792](https://github.com/Jovifei/Star_photo_addr/actions/runs/37260937792): all five jobs, 79 unit/contract/integration files with 441 tests, Chromium 250 passed / 122 applicability skips / 0 failures or flakes, and Firefox/WebKit 12 passed. The PR merge checkout `8f7e4a7164d0cb3af14d95335f741e7c2c32d6fe` has the same tree `d61402d7db0264b668af62712048358de826ab94` as that candidate.

All four `fullPage:false` text-resize screenshots from artifact 11324394541 were actually inspected before this repair. Desktop is 1440×1000 at DPR 1; mobile is 375×812 at DPR 2.625, producing 984×2132 physical pixels. Both keep visualViewport.scale 1. All 72 recorded text ratios are exactly 1 or 2. This is computed-font-size stress, not browser zoom or a physical-phone font-size setting. Mobile screenshots are scrolled to the first candidate; their recorded headerBottom is -372, so they do not establish header visibility.

The original assertions covered navigation, candidate metrics and selected header/filter text. They did not cover the defects visible in the actual images:

- The desktop current time is ellipsized even at 100%.
- At 200%, the core candidate name is reduced to “宝…” or “宝兴…”, so distinct locations cannot be identified reliably. An accessible name or a hover title alone does not restore the visible name on a phone.
- The desktop time controls are squeezed while the playback-speed group receives the grid column intended for the track.
- The map failure explanation becomes a narrow column and runs beneath the hourly panel.
- The mobile map-tool label grows outside its fixed-height button.

Frozen screenshot SHA-256 values: desktop 100% `8bdda90bf1a19d7995d02cca4283425959aa2e2da08b75e5966c139d60b96ecd`; desktop 200% `b01f60760ffe14f8463074b69637d30643ba714221ddbd871f0bfbdd4f62ec66`; mobile 100% `cf5ce3aa835d585fcf080bd5ced0a0031aa0fe7c33bab17d096aade1f6efe859`; mobile 200% `68f4ac9385df798db0a73a3928290ebd4be75d22cd0a9c0a80f6cbe3bc2da270`.

## Minimal repair

- Let candidate identity and score groups wrap when their combined intrinsic widths no longer fit. Display the full location name, wrapping inside the card when necessary.
- Keep desktop timeline groups in their existing source order. Give spare width to the actual scrollable track, keep the full current time, and let groups wrap when enlarged. The collapsed toolbar takes the height its text needs. Preserve local track scrolling and keep tick labels from shrinking into one another.
- Wrap the map failure explanation and retry button as separate items when the text grows. Retain their established status lane, message, retry handler and mobile minimum target size.
- Let the mobile map-tool rail and button grow around the label while retaining their normal minimum dimensions and position.

No content is removed, no font multiplier is reduced, and no forecast, score, source, map event or provider behavior changes. The existing header/navigation and metric regressions remain unchanged.

## Verification boundary

Targeted browser coverage checks complete text ranges against their controls, non-overlap between timeline groups, local scrolling reachability, map-status containment, and failed retry followed by successful recovery. It records viewport screenshots and measured geometry for inspection, rather than treating passing assertions alone as visual acceptance.

Local lint, TypeScript, 79 files / 441 tests and production build pass. Test discovery lists 12 new project cases: 10 applicable cases and two desktop-only layouts excluded from the mobile project. Independent source review confirms the CSS changes are scoped to the observed layout causes. These results do not constitute a browser execution or an inspection of the repaired screenshots.

The current cloud shell cannot launch Chromium: both the ordinary and approved elevated probe stop at `socket() failed: Operation not permitted`. The available cloud browser also rejects the local preview address with `ERR_BLOCKED_BY_CLIENT`. No local real-browser RED/GREEN result is claimed. The baseline defects are evidenced by the frozen CI screenshots; the new candidate must pass its own browser CI and its output images must be inspected afterward.

Production remains gated on complete CI and independent visual acceptance. Physical devices, actual browser zoom and the unrelated moderate/incomplete axe findings remain separate checks.
