# Page topology

1. **Fixed top filter bar**
   - Branding, subtitle, Bortle threshold select, VIIRS layer toggle, label visibility select, mode buttons, search, date select, export, refresh, and a link to the product merge plan.
   - Fixed above the map at `z-index: 1000`.

2. **Map stage**
   - Leaflet-style full-width map canvas with dark basemap, VIIRS 2023 layer, China/province outline, 242 location markers, compact name-only labels, map zoom controls, and attribution.
   - Weather/rain/rating details are deliberately not rendered as permanent map tooltips; selecting a marker opens the detail panel.
   - Owns pan/zoom and marker selection behavior.

3. **Legend overlay**
   - Upper-left floating surface with a collapse button, rating colors, risk badges, refresh time, forecast time window, and source notes.
   - Collapses to a compact bar without changing map layout.

4. **Status/count overlay**
   - Upper-right loaded state and counts for total locations, dark areas, weather matches, and fully qualified locations.

5. **Selection detail panel**
   - Hidden by default. Opens after a marker selection and presents location metadata, score/weather summary, 33-hour chart/table, risk notes, and actions.
   - On desktop it is a bottom sheet; on mobile it becomes a full-width bottom drawer with internal scrolling.

The clone keeps these sections route-scoped under `/stargazing-finder-dark`, uses the verified 242-location public snapshot and same-origin weather gateway, and links to `/integration-plan` for the cross-product merge design.
