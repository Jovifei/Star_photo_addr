# Reference behavior bible

## Interaction model

- **Top bar:** fixed, click/input-driven. It remains above the map and contains filters, layer mode, search, date, export, and refresh actions.
- **Map:** pan/zoom-driven. Markers are click-driven; selecting a marker opens the bottom detail panel.
- **Legend:** click-driven collapse/expand. On desktop it is an upper-left overlay; on narrow screens it remains a compact overlay over the map.
- **Search:** click/input-driven. The field filters location names/provinces and exposes matching results below the field.
- **Filter controls:** select-driven. Bortle threshold, label visibility, observation date, and photography/visual mode change marker visibility and the legend wording.
- **Detail panel:** selection-driven and closable. It is hidden until a marker is selected; its content is a two-column location/weather view on wide screens and a stacked panel on narrow screens.

## Observed states

- Default page state: dark map, VIIRS 2023 layer button active, Bortle threshold `3级 (乡村)`, name-only labels, date selector set to tonight, photography/visual mode controls, and a green/degraded weather status block.
- Photography mode legend title: `📋 图例 (📷摄影模式: 光污染≤3级, 中低云>10%或高云>30%算有云)`.
- Visual mode legend title: `📋 图例 (👁肉眼模式: 光污染≤4级, 中低云≤30%不算有云, 高云≤70%不算有云, 仅看前半夜19:00-24:00)`.
- Legend expanded height at the inspected desktop width: about `346px`; collapsed height: about `44px`; collapse control changes from `−` to `+`.
- Marker click opens the bottom panel; close action returns to the map-only state.
- Marker labels remain compact location names with a small semantic color point. No weather detail, rain time, rating prose, or warning badge is rendered above a location; full cloud, rain, rating, and risk explanations are shown only in the selected detail panel.
- The status block shows a loaded/degraded/data date summary and count chips rather than hiding data while a request is in progress.

## Responsive behavior

- Desktop reference: fixed top bar, full map under it, floating legend at left, status/count block at upper right, and map attribution at lower right.
- Mobile reference: controls wrap into multiple compact rows, the legend stays within the map and is narrower, markers remain visible at map scale, and search/date controls retain touch-sized targets.
- No horizontal page overflow is intended; long lists and detail content should scroll inside their own surfaces.

## Visual tokens extracted from computed styles

- Page background: `rgb(10, 14, 39)` / `#0a0e27`.
- Top bar background: 135-degree gradient from `rgb(13, 27, 62)` to `rgb(26, 31, 78)`.
- Text: `rgb(224, 230, 237)` / `#e0e6ed`.
- Muted text: approximately `#99aabd` to `#7a8ab0`.
- Accent cyan: approximately `#00e5ff`; active layer border: `#e91e63`.
- Legend surface: `rgba(13, 27, 62, 0.92)`, `1px` blue border, `8px` radius, `10px 12px` padding.
- Base font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`.
- Body font size: `16px`; map UI font size: `12px`; legend font size: `13px`; primary heading font size: `20px` and weight `700`.
