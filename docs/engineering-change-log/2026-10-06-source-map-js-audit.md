# Patch the source-map-js audit failure

[CI 37404323556](https://github.com/Jovifei/Star_photo_addr/actions/runs/37404323556), for exact head `5a46046ba6470fca6493a19dfe0866a2f182e60b` (tree `3fdc04905885feb7f9d37fb27f22a04c140d9b62`), stopped at the production dependency audit. Lint, types, tests and build in that job did not run; Chromium, cross-browser and container jobs were skipped. Live-data smoke passed. This run does not establish that the tooltip fixture repair passed in a browser.

The audit reported one high-severity finding: [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), affecting source-map-js before 1.2.2. Malformed indexed source-map offsets can block the event loop. The [upstream 1.2.2 release](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2) includes the fix.

The production dependency path is Next 16.3.8 → PostCSS 8.5.23 → source-map-js. Development CSS tooling shares the same installed source-map-js package. Every parent requirement permits 1.2.2 through `^1.2.1`.

The repair changes only the existing lockfile node's version, registry tarball URL and integrity hash, from 1.2.1 to 1.2.2. The URL and integrity come from the official npm registry. Package names/count, every other resolved version, dependency classification, package.json, product source and the reviewed tooltip fixture are unchanged. No broad audit-fix upgrade or security-gate exception is used.

Validation passed: clean `npm ci`, production audit zero findings, all three existing build-dependency boundary checks, and `npm run check` (lint, types, 82 files / 466 tests and production build). Independent review verified all 812 lockfile nodes, the official registry metadata and these saved results without finding a blocking issue. The new published candidate then needs its own complete CI and actual browser screenshots. Local checks and previous successful runs are not substitutes for that gate. Deployment remains pending.
