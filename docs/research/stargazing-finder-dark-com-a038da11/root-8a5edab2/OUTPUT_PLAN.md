# Website clone output plan

## Source

- URL: `https://stargazing-finder-dark.com/`
- Normalized origin: `https://stargazing-finder-dark.com`
- Site key: `stargazing-finder-dark-com-a038da11`
- Normalized pathname: `/`
- Page key: `root-8a5edab2`

## Destination

- Application root: `E:/project/Star_photo_addr`
- Destination route: `/stargazing-finder-dark`
- Reason: the existing `/` route and the existing `/planner`, `/sites`, and `/viirs` routes are user-authored product surfaces. The clone is isolated to a new route so those routes remain intact.
- Component namespace: `src/components/sites/stargazing-finder-dark-com-a038da11/root-8a5edab2/`
- Asset namespace: `public/sites/stargazing-finder-dark-com-a038da11/root-8a5edab2/`
- Research namespace: `docs/research/stargazing-finder-dark-com-a038da11/root-8a5edab2/`
- Screenshot namespace: `docs/design-references/stargazing-finder-dark-com-a038da11/root-8a5edab2/`

## Delivered output

- `src/app/stargazing-finder-dark/page.tsx`
- A route-scoped client page that reproduces the map/filter/list/detail/review/export workflow with a verified 242-location public snapshot.
- A same-origin Open-Meteo weather gateway returns 33-hour per-location data with retry, partial failure, stale state, and null-safe fields.
- Local province boundaries and the target site's public VIIRS 2023 WMTS are used with CARTO dark fallback; no source-site backend, account system, analytics, visit counter, or Cloudflare Beacon is copied.
- Existing product routes and shared data APIs must remain buildable and unchanged unless a shared import requires a minimal additive adjustment.

## Fidelity audit

- Core business workflow: covered — map, Bortle/date/mode/label filters, search, VIIRS layer, weather status, location detail, 33-hour table/chart, review, and export.
- Intentional differences: access counter and third-party analytics are removed; the current export is dependency-free Excel-compatible `.xls` rather than native `.xlsx`; the target's private backend is not called.
- Current visual correction: permanent map labels show only location names. Rain/cloud/rating explanations stay in the selected location detail surface and are not painted over the map.
- Integration destination: `/integration-plan` documents how `/`, `/planner`, and `/stargazing-finder-dark` can share one observation session without replacing existing routes.

## Verification

- Desktop reference: `desktop-reference.png` at 1440px.
- Mobile reference: `mobile-reference.png` at 390px.
- Behavior notes: `BEHAVIORS.md`.
- Page topology: `PAGE_TOPOLOGY.md`.
- Component specs: one spec per built section under `components/`.
