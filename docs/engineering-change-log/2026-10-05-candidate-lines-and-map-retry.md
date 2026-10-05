# Candidate line boxes and isolated map-retry gestures

## Exact baseline and evidence

Baseline `60e2c341a141e83ae448bff52d28e74bc706ad18`, tree `8e088b020f48285ad3ba26a5fedeb3253da56f52`, failed [CI 37274254365](https://github.com/Jovifei/Star_photo_addr/actions/runs/37274254365). Chromium finished with 256 passed / 124 applicability skips / 4 failed. Quality (80 files / 456 tests), Firefox/WebKit, container and live-data jobs passed. These are baseline results, not acceptance of this repair. The Chromium artifact SHA-256 is `0c940fa941f40e1465104588cfb5e27b398ac6686444a425d1355ed2445f6241`.

Actual screenshots and trace geometry established two product defects:

- At 200% text size, the candidate name had a 26px font and 37px glyph bounds inside a fixed 21px line box. The 20px metadata font had 29px glyph bounds inside another 21px line box. The rows overlapped and escaped the name/identity bounds on desktop and mobile. Checking the real text against these containers is the intended gate.
- Clicking the map-error retry control changed the selected location from `release-audit` to nearby map samples. Successive trace requests used coordinates `30.177875,120.717773` and `29.778181,121.838379`. Leaflet's internal click-disable flag did not exclude the independent native blank-map listener.

Two other failed measurements retained detached observing-marker dot elements. Unrelated grid/store renders constructed fresh Leaflet DivIcons, replacing their DOM while text transitions were being measured. This was not evidence that detached elements had a valid 200% result.

## Narrow changes

- Candidate name and metadata line-height is `max(21px, 1.5em)`: normal 13px/10px text retains its existing 21px rows; enlarged text gets enough vertical space. Text, scale, glyph-bound assertions and normal geometry are not reduced.
- The blank-map listener excludes `.map-render-status` and remembers a gesture that began there, including when the overlay disappears before pointer-up. This protects mouse, touch, keyboard-generated clicks and repeated retries without globally stopping map events or disabling valid blank-map selection.
- Each mounted observing marker owns one memoized icon keyed only by its color, selected state and Bortle grade. Ordinary renders retain actual Leaflet DOM; visual changes replace the icon. There is no global cache, coordinate key or unbounded retained color map. Unmount releases the marker and its DOM.
- Text measurement restores original inline values, waits for actual font-size transitions, and restarts a complete baseline/multiplier sample if current DOM membership changes. It records churn and fails at a bounded deadline. Every original selector target, including decorative spans, remains included; the final current nodes must all be connected and strictly measure 1x or 2x.
- Browser retry coverage activates actual desktop mouse/mobile touch, Enter and Space, repeats still-failing retries, then recovers. It checks unchanged location identity/coordinates, visible location name, map center/zoom and absence of new point-forecast requests, alongside all existing readability/safe-zone checks.

## Verification and remaining release gates

Native event regression: old source 5 failures / 2 passes, repaired source 7 passes. Real React-Leaflet marker integration: old icon construction 1 failure / 2 passes, memoized source 3 passes. Coverage includes visual-prop changes, click behavior, separate marker ownership and unmount cleanup. Independent review reran all 10 checks and found no blocking issues in the complete diff.

The final source passed `npm run check`: lint, TypeScript, 82 files / 466 tests and production build. Local browser launch remains blocked by the cloud execution environment, so these checks do not establish browser readability or interactions. The candidate is the commit containing this entry, directly based on the exact baseline above. Publication of this repair produced `2c351eb5e7f74725cbb6c3bd3acb1ff59ca67206`, tree `60d1b9a5dece983a913b44fc6ee25b6581631bc0`. The PR-body update was permission-blocked and not retried; its old success summary is not current acceptance.

Do not reuse older successful CI as acceptance. This candidate still needs its own full CI and actual desktop/mobile 100%/200% screenshot and metadata inspection before deployment. Physical-phone settings and actual browser zoom remain unverified. No deployment has occurred for this candidate; an existing production version and rollback point must be verified before the approved release.

## Follow-up: remaining desktop timeline line boxes

Exact repair `2c351eb5e7f74725cbb6c3bd3acb1ff59ca67206` [CI 37279341951](https://github.com/Jovifei/Star_photo_addr/actions/runs/37279341951) finished with Chromium 259 passed / 124 applicability skips / 1 failed. Quality (82 files / 466 tests, production audit zero), live-data, container and Firefox/WebKit (12 passes) succeeded. All candidate-name and map-retry regressions passed, including real mouse/touch, Enter/Space, repeated failure/recovery and unchanged selection/view/request assertions. The only failure is desktop 200% timeline glyph containment. Artifact SHA-256: `ed1a879d934fc6225e37a4d3ac9fd647172b7f79bd3c1ca785bf56638bbbff12`.

The actual 1440x1000 screenshots and geometry were independently inspected. All 2,203 sampled targets had settled at exactly 2x, with no DOM churn. At 100%, current time is 14px text / 20px glyph / 21px line box, and the night-range buttons are 11px text / 16px glyph / 29px control (21px line plus 8px padding). At 200%, current time is 28px text / 40px glyph but still a 21px line box, extending 9px below the toolbar; range text is 22px / 32px glyph inside the same 29px button.

The follow-up changes only the existing desktop workspace selectors for `.cloud-timeline-current` and `.cloud-timeline-range button` to `line-height: max(21px, 1.5em)`. Their 100% rows stay exactly 21px. At 200%, current time gets a 42px row and the range buttons get a 33px row plus existing padding. There is no changed text, font size, multiplier, viewport, timing policy, test tolerance, data or interaction behavior. The existing failing browser regression remains unchanged.

Original-resolution mobile 984x2132 PNGs were also checked individually: both failed-map and recovered-map images retain all four bottom navigation labels; the earlier reduced-size preview did not establish a navigation defect. Candidate full-sheet, map-error copy and layers control are readable in those recorded states. This is CSS text enlargement at viewport 375x812 / DPR 2.625 / visual viewport scale 1, not a physical-phone or browser-zoom acceptance.

This follow-up's final local source passed lint, types, 82 files / 466 tests and production build, with independent review of both selectors and normal/enlarged geometry. The commit containing this section is based directly on `2c351eb5e7f74725cbb6c3bd3acb1ff59ca67206`; its exact remote SHA and its own CI must be verified before release. No deployment has occurred. The failed parent run is not a pass for this candidate.
