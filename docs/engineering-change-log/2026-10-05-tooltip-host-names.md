# Keep fallback map tooltip names through fade-out

## Exact failure and scope

[CI37253658291](https://github.com/Jovifei/Star_photo_addr/actions/runs/37253658291) on `4bb6c1dbfbf1637907518fd450fd1584d8da9f1e` failed overall: Chromium247 passed /122 applicability skips /1 failed; quality, live-data, container and Firefox/WebKit passed. The existing four-product header geometry and all four100%/200% text tests passed; both drawer cases passed with the strict48px minimum intact. These targeted passes do not make the overall CI green.

The remaining mobile dark-sky scan reported serious `aria-tooltip-name` on seven `.chinese-fallback-label` tooltip hosts. Full axe JSON shows each host empty, opacity0 and offscreen. The failure screenshot and trace were inspected before editing. Leaflet's installed `DivOverlay.onRemove` retains the host for a200ms fade; React removes portal text sooner. Thus the fading host briefly retains role=tooltip without any accessible name. Merely waiting longer before axe would miss the actual transient defect.

## Repair

On each fallback Tooltip's add lifecycle, copy the same curated `label.name` into the Leaflet host's aria-label. The label remains identical to the visible city name and survives the transient portal cleanup. Do not change the tooltip role, visible text, positioning, opacity, timing, map/provider configuration or label-selection algorithm. No aria-hidden workaround, excluded element, disabled axe rule or forced test retry is used.

## Verification

Two focused component tests check both visible text/host identity and the retained name after simulated portal clearing; the mocked lifecycle is explicitly a unit model, not a real-browser fade test. A new browser regression records missing names with MutationObserver from navigation through two zoom transitions, so it can catch a transient failure rather than waiting until all retired nodes disappear. Existing default full-document axe scans remain unchanged.

Final aggregate checks passed: lint, typecheck, 79 files / 441 tests and production build. Independent review also ran the actual MapContainer/React-Leaflet/Leaflet lifecycle: moveend removes two CircleMarkers, the host stays connected with empty text and opacity0, retains its original accessible name and is removed after the200ms fade. The same test on old source fails for unnamed retiring hosts. This integration regression is included with jsdom SVG/3D capability shims and cleanup restoring them; it does not mock overlay hosts or removal timing. Two focused modeled-lifecycle tests also reproduce RED on old source and GREEN on repaired source. Exact published browser CI remains pending. Prior successful targeted tests do not validate this later candidate. Production deployment remains gated on complete CI and independent visual acceptance.

## Screenshot correction

The text-resize evidence now captures the actual viewport (`fullPage:false`). Full-page capture of a mobile map workspace with fixed/transformed sheets can include offscreen content and change the visual viewport during capture; such a long image is not proof a hidden sheet was open in the measured375×812 viewport. Font multiplier, text bounds, navigation reservation, geometry assertions and recorded metadata are unchanged. Actual viewport screenshots still require inspection, and physical-device/browser-zoom verification remains separate from synthetic text-only stress.
