# Text-resize readability and stable drawer measurement

## Evidence first

Independent Windows Chromium 151.0.7922.34 inspection of frozen `82d38d4` blocked deployment despite its green CI. Both original 01:15 screenshots and explicitly separate 01:33 recheck screenshots were viewed before changing CSS. Recheck viewport: desktop 1440×1000/DPR1; mobile 375×812/DPR2.625. Actual inner dimensions were unchanged and visualViewport.scale remained1. This is synthetic text-only stress, **not browser zoom or physical-phone font scaling**.

The exact procedure snapshots computed font sizes for `button, span, p, label, h1, h2, h3, a, td, th, summary, input`, then sets each original pixel size×2 with important priority. Route: `/?lat=30.4694&lng=119.5978&name=release-audit&model=icon`; fixture-only data with external resources blocked. Desktop retains candidates/details; mobile sheet is full. The expected blocked-map banner is not evidence of a production outage.

Observed defects:

- Fixed65px desktop header and44px navigation targets allowed enlarged labels to collide with the next row.
- Candidate metrics retained four52px desktop or65px mobile cells while enlarged text required100–123px; nowrap plus overflow:hidden cut actual values. Some100% cells were already clipped.
- Mobile bottom navigation retained a fixed band and48px links; enlarged two-line labels were cut off.

Original screenshot hashes: desktop `62304b4d551b32fa6bfde13a423bed713b1c49cedd606fb440e1157d3d0bd0e7`, mobile `f9b3ad30cdfa8796e88af1c67045860a6c6ea801792e6c465e2f59927cd3e976`. Recheck hashes: desktop `d90a4ae5bdc12ad15f38f9c474478ad5117c449e42a7cc8c4d58b5820b307f4c`, mobile `abd51eb53a7214c24775643db32cfac97fbe5e69a02f1209a83d5fa362038fae`. Original runs did not record browser version/inner dimensions/DPR; recheck measurements are not retroactively assigned to them.

## Narrow repair

- Keep normal minimum sizes but let the desktop header, navigation and controls grow/wrap around their text.
- Let candidate metric cells wrap by intrinsic content width, with long content wrapping within the card instead of clipping.
- Let the compact navigation band grow and reserve its measured height in the owning app shell using ResizeObserver; disconnect and remove the owned CSS property on unmount.
- Allow filter labels to wrap within their grid cells. Do not reduce font sizes, remove labels, hide controls or change score/provider/cache logic.
- Add100% and measured200% regressions for complete navigation/metric text bounds, filter/header bounds, viewport overflow and the reserved mobile navigation area. Save metadata and screenshots for inspection. Existing typography/geometry, touch, date/phase and data-integrity suites remain active.

## Separate prior CI measurement race

Semantic candidate `a8dd209c5729aa39cff9d9a1a916d82ecb05ec3c` [CI37250604498](https://github.com/Jovifei/Star_photo_addr/actions/runs/37250604498) failed overall: Chromium243 passed/122 applicability skips/1 failed; other four jobs passed. Its eight axe/keyboard cases passed, including the stricter empty-table-header and landmark-unique checks. This is not full CI success.

The single failure was mobile-panel-dock:80, close target height47.99998474121094 versus strict48 minimum. Trace click completed at800737.608ms and layout evaluation began800798.108ms; frame evidence still shows the drawer entering. CSS uses a180ms transform transition. The trace does not record the exact computed transform at the measurement. Portrait now waits for the same identity transform already required by the landscape test before measuring. Both48px assertions remain unchanged; no tolerance, arbitrary sleep, skip or retry is added. This must pass its own browser verification and does not resolve the independent200% layout blocker by itself.

## Validation boundary

Final local aggregate checks pass: lint, typecheck, 77 files / 438 tests and production build. Independent review passed its isolated 3-file/9-test check and identified two baseline risks addressed before publication: preserve65px normal header through6px vertical padding, and use unitless metric-span line-height plus controlled event-status flex-basis. Real100%/200% screenshots, unchanged header geometry and the new browser assertions remain pending the exact candidate; static review is not visual acceptance. No production deployment is claimed. Physical devices, actual browser zoom and all unrelated accessibility findings remain separate gates.
