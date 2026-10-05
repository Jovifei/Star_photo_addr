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

The final source passed `npm run check`: lint, TypeScript, 82 files / 466 tests and production build. Local browser launch remains blocked by the cloud execution environment, so these checks do not establish browser readability or interactions. The candidate is the commit containing this entry, directly based on the exact baseline above. Its published SHA/tree and its own full CI are recorded in PR 49's latest verification section.

Do not reuse older successful CI as acceptance. This candidate still needs its own full CI and actual desktop/mobile 100%/200% screenshot and metadata inspection before deployment. Physical-phone settings and actual browser zoom remain unverified. No deployment has occurred for this candidate; an existing production version and rollback point must be verified before the approved release.
